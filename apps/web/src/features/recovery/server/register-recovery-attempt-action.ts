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

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";

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

export async function registerRecoveryAttemptAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const caseId = String(formData.get("caseId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const result = String(formData.get("result") ?? "").trim();
  const phoneUsed =
    String(formData.get("phoneUsed") ?? "")
      .trim()
      .slice(0, 15) || null;
  const observation =
    String(formData.get("observation") ?? "")
      .trim()
      .slice(0, 2000) || null;
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const pauseDaysRaw = String(formData.get("pauseDays") ?? "").trim();

  if (!caseId || !channels.has(channel) || !results.has(result)) {
    return {
      type: "error",
      message: "Completa el canal y el resultado del intento.",
    };
  }

  let scheduledAt: Date | null = null;
  if (result === "AGENDA") {
    scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return {
        type: "error",
        message: "Una agenda necesita fecha y hora de la próxima llamada.",
      };
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return {
        type: "error",
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

    const now = new Date();
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
      },
    });

    const isBaseCase = recoveryCase.source === "NATIONAL_BASE";
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

      await transaction.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          status: result === "YA_ACTIVO" ? "WAITING" : "SCHEDULED",
          firstContactAt: recoveryCase.firstContactAt ?? now,
          nextActionAt: result === "YA_ACTIVO" ? null : getNextLimaMorning(now),
        },
      });

      return {
        kind: "DONE" as const,
        holderName: recoveryCase.holderName,
        result,
        attemptsToday,
        mustResolve: false,
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
      holderName: recoveryCase.holderName,
      result,
      attemptsToday: isBaseCase ? attemptsToday : null,
      mustResolve:
        result !== "AGENDA" &&
        result !== "RECHAZA" &&
        result !== "CANCELADO" &&
        (isBaseCase
          ? isBaseRecoveryResolutionDue(managedSince, now)
          : getInternalRecoveryNextTouchAt(managedSince, now) === null),
    };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message:
        "El caso no existe, ya se resolvió o no pertenece a tus equipos.",
    };
  }

  revalidatePath("/recovery/sales");
  revalidatePath("/recovery/campaigns");

  const suffix =
    outcome.result === "VENDIDO"
      ? " Vincula la orden nueva para resolverlo como recuperado."
      : outcome.result === "YA_ACTIVO"
        ? " Pasa a verificación: el caso no se cierra hasta que el reporte o tu supervisor lo confirmen."
        : outcome.result === "INTERESADO_CON_PEDIDO"
          ? " Agendado para mañana: vuelve a llamarlo para ver si el pedido anterior cayó; el cruce lo vigila en paralelo."
          : outcome.mustResolve
            ? " La cadencia se agotó: este caso entra en resolución obligatoria."
            : outcome.attemptsToday !== null && outcome.attemptsToday < 3
              ? ` Llevas ${outcome.attemptsToday} de 3 intentos exigidos hoy.`
              : "";

  return {
    type: "success",
    message: `Intento registrado para ${outcome.holderName}.${suffix}`,
  };
}
