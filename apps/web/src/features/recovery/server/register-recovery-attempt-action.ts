"use server";

import { revalidatePath } from "next/cache";

import {
  countOnSameLimaDay,
  eligibleFromReportedDate,
  getInternalRecoveryNextTouchAt,
  impedimentReasons,
  isBaseRecoveryResolutionDue,
  limaDayStartFromIso,
  limaMorningFromIso,
  noContactReasons,
  parseLimaDateTimeLocal,
  resolveRecoveryAttemptConsequence,
} from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";
import { readUuid } from "@/server/forms/read-form";
import { formatLimaDateTime } from "@repo/ui/format";

import {
  commitmentSlotRange,
  recoveryCaseAccessWhere,
} from "./recovery-case-access";

import type {
  CampaignAttemptInlineState,
  SendOrderToRecoveryActionState,
} from "./recovery-action.types";
import type { RecoveryWorkView } from "@repo/validation";

interface AttemptInput {
  caseId: string;
  channel: string;
  result: string;
  reason: string;
  phoneUsed: string | null;
  observation: string | null;
  scheduledAtRaw: string;
  pauseDaysRaw: string;
  interestedNext: string;
  followUpDate: string;
  reportedDate: string;
  serviceNumber: string;
  needsSupervisor: boolean;
  /** BR-090: clave de idempotencia; solo la bandeja la envía. */
  clientRequestId: string | null;
}

type AttemptOutcome =
  | { kind: "INVALID"; message: string }
  | { kind: "NOT_FOUND" }
  | {
      kind: "DONE";
      /** El reenvío encontró el intento ya guardado (BR-090). */
      replayed: boolean;
      holderName: string;
      result: string;
      observation: string | null;
      phoneUsed: string | null;
      status: string;
      attemptsToday: number | null;
      nextActionAt: Date | null;
      mustResolve: boolean;
      isBaseCase: boolean;
      /** BR-016: otra cita del mismo asesor en el mismo tramo de 15 minutos. */
      slotClash: string | null;
      /** SPEC-049 BR-001: la consecuencia en una frase y la vista destino. */
      summary: string;
      workView: RecoveryWorkView;
    };

function readAttemptInput(formData: FormData): AttemptInput {
  const text = (key: string, max: number) =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, max);

  return {
    caseId: text("caseId", 80),
    channel: text("channel", 20),
    result: text("result", 40),
    reason: text("reason", 20),
    phoneUsed: text("phoneUsed", 15) || null,
    observation: text("observation", 2000) || null,
    scheduledAtRaw: text("scheduledAt", 40),
    pauseDaysRaw: text("pauseDays", 2),
    interestedNext: text("interestedNext", 20),
    followUpDate: text("followUpDate", 10),
    reportedDate: text("reportedDate", 10),
    serviceNumber: text("serviceNumber", 15),
    needsSupervisor: formData.get("needsSupervisor") === "on",
    clientRequestId: readUuid(formData.get("clientRequestId")),
  };
}

/**
 * Registro de un intento de contacto — SPEC-030 BR-032 a BR-036, BR-066;
 * SPEC-049 BR-001 a BR-006. El intento es inmutable; sus efectos sobre el
 * caso (estado, reloj, cita, pausa, teléfono, habilitación) salen de la
 * tabla de consecuencias de `@repo/validation` y se aplican en la misma
 * transacción.
 */
const channels = new Set(["LLAMADA", "WHATSAPP", "SMS", "PRESENCIAL", "OTRO"]);

const results = new Set([
  "SIN_RESPUESTA",
  "INTERESADO",
  "INTERESADO_CON_PEDIDO",
  "TIENE_PEDIDO",
  "RECHAZA",
  "NO_CONTACTAR",
  "AGENDA",
  "NUMERO_ERRADO",
  "NO_CUMPLE_30D",
  "YA_ACTIVO",
  "DATOS_INVALIDOS",
  "VENDIDO",
  "IMPEDIMENTO",
  // Se acepta por compatibilidad con clientes viejos; ya no se ofrece.
  "CANCELADO",
]);

const openStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

function invalid(message: string): AttemptOutcome {
  return { kind: "INVALID", message };
}

async function registerRecoveryAttempt(
  input: AttemptInput,
): Promise<AttemptOutcome> {
  const { session, membership } = await requireCommercialAccess();
  const {
    caseId,
    channel,
    result,
    phoneUsed,
    observation,
    scheduledAtRaw,
    pauseDaysRaw,
    clientRequestId,
  } = input;
  const now = new Date();

  if (!caseId || !channels.has(channel)) {
    return invalid("Completa el canal y el resultado del intento.");
  }
  if (!results.has(result)) {
    return invalid("Elige qué pasó en la llamada antes de guardar.");
  }

  // Motivo: por qué no contestó (opcional, «no contesta» por defecto) o qué
  // impide la venta (obligatorio).
  let reason: string | null = null;
  if (result === "SIN_RESPUESTA") {
    reason = noContactReasons.includes(input.reason as never)
      ? input.reason
      : "NO_CONTESTA";
  } else if (result === "IMPEDIMENTO") {
    if (!impedimentReasons.includes(input.reason as never)) {
      return invalid("Di qué impide la venta: problema de huella u otro.");
    }
    reason = input.reason;
  }

  // Hora acordada: AGENDA siempre; INTERESADO cuando eligió llamada acordada.
  let scheduledAt: Date | null = null;
  const wantsAppointment =
    result === "AGENDA" ||
    (result === "INTERESADO" && input.interestedNext === "cita");
  if (wantsAppointment) {
    // SPEC-048 BR-001: la hora es de Lima, no de la zona del servidor.
    scheduledAt = scheduledAtRaw ? parseLimaDateTimeLocal(scheduledAtRaw) : null;
    if (!scheduledAt) {
      return invalid("Una llamada acordada necesita fecha y hora.");
    }
    if (scheduledAt.getTime() <= now.getTime()) {
      return invalid("La fecha acordada debe estar en el futuro.");
    }
  }

  // Fecha de seguimiento: INTERESADO con seguimiento o IMPEDIMENTO.
  let followUpDate: string | null = null;
  const wantsFollowUp =
    result === "IMPEDIMENTO" ||
    (result === "INTERESADO" && input.interestedNext === "seguimiento");
  if (wantsFollowUp) {
    const morning = input.followUpDate
      ? limaMorningFromIso(input.followUpDate)
      : null;
    if (!morning) {
      return invalid("Indica la fecha del seguimiento.");
    }
    if (morning.getTime() <= now.getTime() && result === "IMPEDIMENTO") {
      return invalid("La fecha del seguimiento debe ser posterior a hoy.");
    }
    followUpDate = input.followUpDate;
  }

  if (result === "NO_CONTACTAR" && (observation?.length ?? 0) < 10) {
    return invalid(
      "Escribe qué dijo el cliente (al menos 10 caracteres): es la evidencia para cerrarlo.",
    );
  }
  if (result === "IMPEDIMENTO" && (observation?.length ?? 0) < 5) {
    return invalid("Describe el impedimento en la observación.");
  }
  if (result === "NUMERO_ERRADO" && !phoneUsed) {
    return invalid("Di qué número estaba errado.");
  }

  let reportedDate: string | null = null;
  if (result === "NO_CUMPLE_30D" && input.reportedDate) {
    const day = limaDayStartFromIso(input.reportedDate);
    if (!day) return invalid("La fecha de portación no es válida.");
    if (day.getTime() > now.getTime()) {
      return invalid("La fecha de portación no puede ser futura.");
    }
    reportedDate = input.reportedDate;
  }

  const pauseDays: 1 | 2 = pauseDaysRaw === "2" ? 2 : 1;

  const outcome = await database.$transaction(async (transaction) => {
    // El asesor solo gestiona sus casos asignados (BR-029b); la supervisión,
    // dentro de sus equipos. Una sola definición para todas las acciones.
    const access = await recoveryCaseAccessWhere(transaction, {
      userId: session.user.id,
      role: membership.role,
      organizationId: membership.organization.id,
    });

    const recoveryCase = await transaction.recoveryCase.findFirst({
      where: {
        ...access,
        id: caseId,
        status: { in: [...openStatuses] },
      },
      select: {
        id: true,
        source: true,
        status: true,
        claimedAt: true,
        createdAt: true,
        firstContactAt: true,
        holderName: true,
        assignedUserId: true,
        phones: {
          select: { phoneNumber: true, invalidMarkedAt: true },
        },
        services: {
          where: { discardedAt: null },
          select: {
            id: true,
            serviceNumber: true,
            portabilityEligibleAt: true,
          },
        },
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { createdAt: true },
        },
      },
    });

    if (!recoveryCase) return { kind: "NOT_FOUND" as const };

    const isBaseCase = recoveryCase.source === "NATIONAL_BASE";

    /**
     * BR-090: un reenvío del mismo formulario —doble clic, reintento tras un
     * corte— trae la misma clave. Encontrarla significa que el primer envío
     * ya hizo todo su trabajo, incluidos los efectos sobre el caso: se
     * devuelve lo que ya existe y no se toca nada.
     */
    if (clientRequestId) {
      const replayed = await transaction.recoveryCaseAttempt.findUnique({
        where: {
          caseId_clientRequestId: { caseId: recoveryCase.id, clientRequestId },
        },
        select: { result: true, observation: true, phoneUsed: true },
      });

      if (replayed) {
        const current = await transaction.recoveryCase.findUniqueOrThrow({
          where: { id: recoveryCase.id },
          select: { status: true, nextActionAt: true },
        });

        return {
          kind: "DONE" as const,
          replayed: true,
          holderName: recoveryCase.holderName,
          result: String(replayed.result),
          observation: replayed.observation,
          phoneUsed: replayed.phoneUsed,
          status: String(current.status),
          attemptsToday: isBaseCase
            ? countOnSameLimaDay(
                recoveryCase.attempts.map((attempt) => attempt.createdAt),
                now,
              )
            : null,
          nextActionAt: current.nextActionAt,
          mustResolve: false,
          isBaseCase,
          slotClash: null,
          summary: "",
          workView: "ahora" as const,
        };
      }
    }

    // NO_CUMPLE_30D: la línea afectada. Con una sola activa, es esa.
    let affectedService: (typeof recoveryCase.services)[number] | null = null;
    if (result === "NO_CUMPLE_30D") {
      affectedService =
        recoveryCase.services.length === 1
          ? (recoveryCase.services[0] ?? null)
          : (recoveryCase.services.find(
              (service) => service.serviceNumber === input.serviceNumber,
            ) ?? null);
      if (!affectedService) {
        return {
          kind: "INVALID" as const,
          message: "Di cuál de las líneas del caso no cumple los 30 días.",
        };
      }
    }

    const attempt = await transaction.recoveryCaseAttempt.create({
      data: {
        organizationId: membership.organization.id,
        caseId: recoveryCase.id,
        actorUserId: session.user.id,
        channel: channel as never,
        result: result as never,
        reason: reason as never,
        phoneUsed,
        observation,
        nextActionAt: scheduledAt,
        followUpAt: followUpDate ? limaMorningFromIso(followUpDate) : null,
        needsSupervisor: result === "IMPEDIMENTO" && input.needsSupervisor,
        affectedServiceId: affectedService?.id ?? null,
        clientRequestId,
      },
      select: { id: true },
    });

    /**
     * SPEC-048 BR-003/BR-005: registrar cualquier resultado atiende la cita
     * pendiente del caso —hubo llamada—, y una cita nueva se crea después
     * de cerrar la anterior (un caso tiene a lo sumo una pendiente).
     */
    await transaction.recoveryCaseCommitment.updateMany({
      where: { caseId: recoveryCase.id, status: "PENDING" },
      data: {
        status: "DONE",
        resolvedAttemptId: attempt.id,
        closedByUserId: session.user.id,
        closedAt: now,
      },
    });

    const managedSince = recoveryCase.claimedAt ?? recoveryCase.createdAt;
    // Incluye el intento recién creado en el conteo del día (BR-032).
    const attemptsToday =
      countOnSameLimaDay(
        recoveryCase.attempts.map((attempt) => attempt.createdAt),
        now,
      ) + 1;

    // BR-002: el teléfono errado queda marcado; se cuenta qué queda.
    let validPhonesLeft = 0;
    if (result === "NUMERO_ERRADO" && phoneUsed) {
      await transaction.recoveryCasePhone.updateMany({
        where: {
          caseId: recoveryCase.id,
          phoneNumber: phoneUsed,
          invalidMarkedAt: null,
        },
        data: { invalidMarkedAt: now },
      });
      const validContacts = recoveryCase.phones.filter(
        (phone) => phone.invalidMarkedAt === null && phone.phoneNumber !== phoneUsed,
      ).length;
      const otherLines = recoveryCase.services.filter(
        (service) => service.serviceNumber !== phoneUsed,
      ).length;
      validPhonesLeft = validContacts + otherLines;
    }

    // BR-003: fecha informada por el cliente y habilitación consolidada.
    let caseEligibleAt: Date | null | undefined = undefined;
    let anyWorkableLine = false;
    if (result === "NO_CUMPLE_30D" && affectedService) {
      const eligibleFromClient = reportedDate
        ? eligibleFromReportedDate(reportedDate)
        : null;
      if (reportedDate) {
        await transaction.recoveryCaseService.update({
          where: { id: affectedService.id },
          data: {
            portabilityReportedAt: limaDayStartFromIso(reportedDate),
            // La fecha verificada por el reporte manda sobre la informada.
            portabilityEligibleAt:
              affectedService.portabilityEligibleAt ?? eligibleFromClient,
          },
        });
      }
      const eligibles = recoveryCase.services.map((service) =>
        service.id === affectedService!.id
          ? (service.portabilityEligibleAt ?? eligibleFromClient)
          : service.portabilityEligibleAt,
      );
      const known = eligibles.filter((value): value is Date => value !== null);
      caseEligibleAt =
        known.length > 0
          ? new Date(Math.min(...known.map((value) => value.getTime())))
          : null;
      // BR-040: una línea sin dato es trabajable; la ausencia nunca detiene.
      anyWorkableLine = recoveryCase.services.some(
        (service) =>
          service.id !== affectedService!.id &&
          (service.portabilityEligibleAt === null ||
            service.portabilityEligibleAt.getTime() <= now.getTime()),
      );
    }

    const consequence = resolveRecoveryAttemptConsequence({
      result,
      reason,
      now,
      attemptsToday,
      managedSince,
      isBaseCase,
      pauseDays,
      scheduledAt,
      followUpDate,
      reportedDate,
      caseEligibleAt: caseEligibleAt ?? null,
      anyWorkableLine,
      validPhonesLeft,
      phoneUsed,
      needsSupervisor: input.needsSupervisor,
    });

    // BR-085/BR-086/BR-005: las líneas entran a la próxima exportación.
    if (isBaseCase && consequence.marksLinesForRevalidation) {
      await transaction.recoveryCaseService.updateMany({
        where: { caseId: recoveryCase.id, discardedAt: null },
        data: { needsRevalidation: true },
      });
    }

    await transaction.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        status: consequence.status,
        firstContactAt: recoveryCase.firstContactAt ?? now,
        nextActionAt: consequence.nextActionAt,
        ...(caseEligibleAt !== undefined
          ? { portabilityEligibleAt: caseEligibleAt }
          : {}),
      },
    });

    let slotClash: string | null = null;

    if (consequence.createsCommitment && scheduledAt) {
      const created = await transaction.recoveryCaseCommitment.create({
        data: {
          organizationId: membership.organization.id,
          caseId: recoveryCase.id,
          scheduledAt,
          originAttemptId: attempt.id,
          createdByUserId: session.user.id,
          clientRequestId,
        },
        select: { id: true },
      });

      // BR-016: otra llamada acordada del mismo asesor en el mismo tramo se
      // advierte; nunca se rechaza ni se mueve sola.
      if (recoveryCase.assignedUserId) {
        const clash = await transaction.recoveryCaseCommitment.findFirst({
          where: {
            organizationId: membership.organization.id,
            status: "PENDING",
            id: { not: created.id },
            scheduledAt: commitmentSlotRange(scheduledAt),
            case: { assignedUserId: recoveryCase.assignedUserId },
          },
          select: { case: { select: { holderName: true } } },
        });
        slotClash = clash?.case.holderName ?? null;
      }
    }

    const mustResolve =
      consequence.status === "IN_PROGRESS" &&
      consequence.workView === "ahora" &&
      (isBaseCase
        ? isBaseRecoveryResolutionDue(managedSince, now)
        : getInternalRecoveryNextTouchAt(managedSince, now) === null);

    return {
      kind: "DONE" as const,
      replayed: false,
      holderName: recoveryCase.holderName,
      result,
      observation,
      phoneUsed,
      status: consequence.status,
      attemptsToday: isBaseCase ? attemptsToday : null,
      nextActionAt: consequence.nextActionAt,
      isBaseCase,
      slotClash,
      summary: consequence.summary,
      workView: consequence.workView,
      mustResolve,
    };
  });

  return outcome;
}

/**
 * La consecuencia operativa del resultado, en una frase (BR-001). Es lo que
 * el asesor necesita saber justo después de guardar.
 */
function describeAttemptOutcome(
  outcome: Extract<AttemptOutcome, { kind: "DONE" }>,
): string {
  const parts: string[] = [];
  if (outcome.summary) parts.push(outcome.summary);
  if (outcome.slotClash) {
    parts.push(
      `Ojo: a esa misma hora ya tienes una llamada acordada con ${outcome.slotClash}.`,
    );
  }
  if (outcome.mustResolve) {
    parts.push("La cadencia se agotó: este caso entra en resolución obligatoria.");
  }

  return parts.join(" ");
}

/**
 * Acción de la ficha: mensaje en prosa y revalidación de las colas, porque
 * el asesor sale de la ficha hacia su cola y quiere verla ya reordenada.
 */
export async function registerRecoveryAttemptAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const outcome = await registerRecoveryAttempt(readAttemptInput(formData));

  if (outcome.kind === "INVALID") {
    return { type: "error", message: outcome.message };
  }

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message:
        "El caso no existe, ya se resolvió o no pertenece a tus equipos.",
    };
  }

  revalidatePath("/recovery/sales");
  revalidatePath("/recovery/campaigns");
  revalidatePath("/recovery/agenda");

  const suffix = describeAttemptOutcome(outcome);

  return {
    type: "success",
    message: `Intento registrado para ${outcome.holderName}.${suffix ? ` ${suffix}` : ""}`,
  };
}

/**
 * Acción de la bandeja (BR-090): devuelve los datos confirmados para que la
 * fila se actualice sola, y **no revalida la bandeja**. Revalidarla
 * reordenaría la lista bajo las manos del asesor y la fila que acaba de
 * gestionar saltaría a otra posición; la página es dinámica, así que la
 * próxima navegación ya la trae reconciliada. La cola de ventas sí se
 * revalida: no está en pantalla.
 */
export async function registerCampaignAttemptInlineAction(
  previousState: CampaignAttemptInlineState,
  formData: FormData,
): Promise<CampaignAttemptInlineState> {
  void previousState;

  /**
   * Un fallo inesperado —la base no responde, un cliente desactualizado—
   * no puede tumbar la bandeja entera con una pantalla de error: el asesor
   * perdería el borrador y el sitio donde estaba (§7). Vuelve como estado
   * de error, el formulario sigue ahí con lo escrito, y la misma clave de
   * idempotencia hace que el reintento no duplique nada si el primero sí
   * llegó a guardarse.
   */
  let outcome: AttemptOutcome;

  try {
    outcome = await registerRecoveryAttempt(readAttemptInput(formData));
  } catch (error) {
    console.error("Fallo al registrar la gestión desde la bandeja", error);

    return {
      type: "error",
      message:
        "No se pudo guardar la gestión. Lo que escribiste sigue aquí: vuelve a intentarlo.",
    };
  }

  if (outcome.kind === "INVALID") {
    return { type: "error", message: outcome.message };
  }

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message:
        "Este caso ya no está a tu cargo o se resolvió. Actualiza la cola para verlo.",
      unmanageable: true,
    };
  }

  /**
   * Aquí no se revalida **ninguna** ruta, ni siquiera otra. En Next, una
   * revalidación dentro de una acción devuelve también el árbol fresco de la
   * página actual, y la bandeja se reordenó bajo las manos del asesor con la
   * primera versión: la fila que acababa de gestionar saltó al fondo y el
   * desplazamiento la siguió. Las colas son dinámicas y se traen frescas en
   * la siguiente navegación; la fila ya tiene los datos confirmados.
   */
  return {
    type: "success",
    message: outcome.replayed
      ? `La gestión de ${outcome.holderName} ya estaba guardada.`
      : `Gestión guardada para ${outcome.holderName}.`,
    detail: describeAttemptOutcome(outcome),
    attempt: {
      result: outcome.result,
      observation: outcome.observation,
      phoneUsed: outcome.phoneUsed,
      status: outcome.status,
      attemptsToday: outcome.attemptsToday,
      nextActionAtLabel: outcome.nextActionAt
        ? formatLimaDateTime(outcome.nextActionAt)
        : null,
      mustResolve: outcome.mustResolve,
      workView: outcome.workView,
    },
  };
}
