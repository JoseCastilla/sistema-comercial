"use server";

import { revalidatePath } from "next/cache";

import {
  countOnSameLimaDay,
  getBaseRecoveryNextTouchAt,
  getInternalRecoveryNextTouchAt,
  getInternalRecoveryPauseUntil,
  getNextLimaMorning,
  isBaseRecoveryResolutionDue,
} from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type {
  CampaignAttemptInlineState,
  SendOrderToRecoveryActionState,
} from "./recovery-action.types";

const attemptDateFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface AttemptInput {
  caseId: string;
  channel: string;
  result: string;
  phoneUsed: string | null;
  observation: string | null;
  scheduledAtRaw: string;
  pauseDaysRaw: string;
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
    };

function readAttemptInput(formData: FormData): AttemptInput {
  return {
    caseId: String(formData.get("caseId") ?? "").trim(),
    channel: String(formData.get("channel") ?? "").trim(),
    result: String(formData.get("result") ?? "").trim(),
    phoneUsed:
      String(formData.get("phoneUsed") ?? "")
        .trim()
        .slice(0, 15) || null,
    observation:
      String(formData.get("observation") ?? "")
        .trim()
        .slice(0, 2000) || null,
    scheduledAtRaw: String(formData.get("scheduledAt") ?? "").trim(),
    pauseDaysRaw: String(formData.get("pauseDays") ?? "").trim(),
    clientRequestId: readUuid(formData.get("clientRequestId")),
  };
}

function readUuid(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : null;
}


/**
 * Registro de un intento de contacto — SPEC-030 BR-032 a BR-036, BR-066.
 * El intento es inmutable; sus efectos sobre el caso (estado, reloj, agenda,
 * pausa) se aplican en la misma transacción.
 *
 * BR-031: la cadencia es por fuente. El carril interno usa los toques
 * D1/D3/D7 desde la asignación; la base nacional exige tres intentos en el
 * día (BR-032) y reaparece a la mañana siguiente con el mínimo cumplido,
 * hasta la resolución obligatoria del séptimo día (BR-058). La agenda
 * (BR-034) y la pausa por rechazo (BR-033) valen igual en ambos carriles.
 */
const channels = new Set(["LLAMADA", "WHATSAPP", "SMS", "PRESENCIAL", "OTRO"]);

const results = new Set([
  "SIN_RESPUESTA",
  "INTERESADO",
  "INTERESADO_CON_PEDIDO",
  "RECHAZA",
  "AGENDA",
  "NUMERO_ERRADO",
  "NO_CUMPLE_30D",
  "YA_ACTIVO",
  "DATOS_INVALIDOS",
  "VENDIDO",
  "CANCELADO",
]);

const openStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

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

  if (!caseId || !channels.has(channel) || !results.has(result)) {
    return {
      kind: "INVALID",
      message: "Completa el canal y el resultado del intento.",
    };
  }

  let scheduledAt: Date | null = null;
  if (result === "AGENDA") {
    scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return {
        kind: "INVALID",
        message: "Una agenda necesita fecha y hora de la próxima llamada.",
      };
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return {
        kind: "INVALID",
        message: "La fecha agendada debe estar en el futuro.",
      };
    }
  }

  const pauseDays = pauseDaysRaw === "2" ? 2 : 1;

  const outcome = await database.$transaction(async (transaction) => {
    const supervisedTeamIds =
      membership.role === "SUPERVISOR"
        ? (
            await transaction.commercialTeamMember.findMany({
              where: {
                userId: session.user.id,
                memberRole: "SUPERVISOR",
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              select: { teamId: true },
            })
          ).map((item) => item.teamId)
        : null;

    const recoveryCase = await transaction.recoveryCase.findFirst({
      where: {
        id: caseId,
        organizationId: membership.organization.id,
        status: { in: [...openStatuses] },
        // El asesor solo gestiona sus casos asignados (BR-029b); la
        // supervisión, dentro de sus equipos.
        ...(membership.role === "AGENT"
          ? { assignedUserId: session.user.id }
          : {}),
        ...(supervisedTeamIds
          ? {
              OR: [
                { assignedTeamId: { in: supervisedTeamIds } },
                { originalTeamId: { in: supervisedTeamIds } },
                { assignedUserId: session.user.id },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        source: true,
        status: true,
        claimedAt: true,
        createdAt: true,
        firstContactAt: true,
        holderName: true,
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { createdAt: true },
        },
      },
    });

    if (!recoveryCase) return { kind: "NOT_FOUND" as const };

    const isBaseCase = recoveryCase.source === "NATIONAL_BASE";
    const now = new Date();

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
        select: {
          result: true,
          observation: true,
          phoneUsed: true,
        },
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
        };
      }
    }

    await transaction.recoveryCaseAttempt.create({
      data: {
        organizationId: membership.organization.id,
        caseId: recoveryCase.id,
        actorUserId: session.user.id,
        channel: channel as never,
        result: result as never,
        phoneUsed,
        observation,
        nextActionAt: scheduledAt,
        clientRequestId,
      },
    });
    const managedSince = recoveryCase.claimedAt ?? recoveryCase.createdAt;
    // Incluye el intento recién creado en el conteo del día (BR-032).
    const attemptsToday =
      countOnSameLimaDay(
        recoveryCase.attempts.map((attempt) => attempt.createdAt),
        now,
      ) + 1;

    /**
     * BR-085: "ya es Movistar" es una afirmación, no una prueba — el caso
     * pasa a verificación (WAITING, conserva a su asesor) y sus líneas
     * entran a la próxima exportación. BR-086: "interesado con pedido en
     * curso" agenda solo para mañana y también entra a revalidación diaria:
     * el cruce vigila si el pedido ajeno prospera o cae.
     */
    if (
      isBaseCase &&
      (result === "YA_ACTIVO" || result === "INTERESADO_CON_PEDIDO")
    ) {
      await transaction.recoveryCaseService.updateMany({
        where: { caseId: recoveryCase.id, discardedAt: null },
        data: { needsRevalidation: true },
      });

      const verificationNextAction =
        result === "YA_ACTIVO" ? null : getNextLimaMorning(now);

      await transaction.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          status: result === "YA_ACTIVO" ? "WAITING" : "SCHEDULED",
          firstContactAt: recoveryCase.firstContactAt ?? now,
          nextActionAt: verificationNextAction,
        },
      });

      return {
        kind: "DONE" as const,
        replayed: false,
        holderName: recoveryCase.holderName,
        result,
        observation,
        phoneUsed,
        status: result === "YA_ACTIVO" ? "WAITING" : "SCHEDULED",
        attemptsToday,
        nextActionAt: verificationNextAction,
        mustResolve: false,
        isBaseCase,
      };
    }

    // BR-034: la agenda suspende la cadencia; BR-033: el rechazo pausa 1–2
    // días; el resto sigue la cadencia de su fuente (BR-031). La cancelación
    // pausa igual que el rechazo y no cierra el caso: si el resultado se
    // registró por error se corrige sin perder el historial del intento.
    const nextActionAt =
      result === "AGENDA"
        ? scheduledAt
        : result === "RECHAZA" || result === "CANCELADO"
          ? getInternalRecoveryPauseUntil(now, pauseDays)
          : isBaseCase
            ? getBaseRecoveryNextTouchAt(attemptsToday, now)
            : (getInternalRecoveryNextTouchAt(managedSince, now) ?? now);

    await transaction.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        status: result === "AGENDA" ? "SCHEDULED" : "IN_PROGRESS",
        firstContactAt: recoveryCase.firstContactAt ?? now,
        nextActionAt,
      },
    });

    return {
      kind: "DONE" as const,
      replayed: false,
      holderName: recoveryCase.holderName,
      result,
      observation,
      phoneUsed,
      status: result === "AGENDA" ? "SCHEDULED" : "IN_PROGRESS",
      attemptsToday: isBaseCase ? attemptsToday : null,
      nextActionAt,
      isBaseCase,
      mustResolve:
        result !== "AGENDA" &&
        result !== "RECHAZA" &&
        result !== "CANCELADO" &&
        (isBaseCase
          ? isBaseRecoveryResolutionDue(managedSince, now)
          : getInternalRecoveryNextTouchAt(managedSince, now) === null),
    };
  });

  return outcome;
}

/**
 * La consecuencia operativa del resultado, en una frase. Es lo que el asesor
 * necesita saber justo después de guardar: cuántos intentos van, si el caso
 * entró en verificación, si toca vincular la venta.
 */
function describeAttemptOutcome(
  outcome: Extract<AttemptOutcome, { kind: "DONE" }>,
): string {
  if (outcome.result === "VENDIDO") {
    return "Vincula la orden nueva desde la ficha para resolverlo como recuperado.";
  }
  if (outcome.result === "YA_ACTIVO") {
    return "Pasa a verificación: el caso no se cierra hasta que el reporte o tu supervisor lo confirmen.";
  }
  if (outcome.result === "INTERESADO_CON_PEDIDO") {
    return "Agendado para mañana: vuelve a llamarlo para ver si el pedido anterior cayó; el cruce lo vigila en paralelo.";
  }
  if (outcome.mustResolve) {
    return "La cadencia se agotó: este caso entra en resolución obligatoria.";
  }
  if (outcome.attemptsToday !== null && outcome.attemptsToday < 3) {
    return `Llevas ${outcome.attemptsToday} de 3 intentos exigidos hoy.`;
  }

  return "";
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
        ? attemptDateFormatter.format(outcome.nextActionAt)
        : null,
      mustResolve: outcome.mustResolve,
    },
  };
}
