"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { baseRecoveryPoolTakeLimit } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { returnStaleBaseCasesToPool } from "./return-stale-base-cases";

import type { RecoveryTriageActionState } from "./recovery-action.types";
import type { Prisma } from "@repo/database";

/**
 * Toma atómica por bloque desde el pool del equipo — SPEC-030 BR-028,
 * BR-029b, BR-050 y BR-078.
 *
 * El asesor no vuelve al pool después de cada llamada: recibe hasta 10 casos
 * que cumplen su filtro en una sola operación. La atomicidad la garantiza el
 * `updateMany` condicional: un caso que otro asesor tomó primero ya no
 * cumple `assignedUserId = null` y simplemente no entra al bloque (AC-013).
 */
const takeRoles = new Set(["AGENT", "SUPERVISOR"]);

export async function takeRecoveryPoolBlockAction(
  previousState: RecoveryTriageActionState,
  formData: FormData,
): Promise<RecoveryTriageActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!takeRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const requestedRaw = Number.parseInt(
    String(formData.get("blockSize") ?? ""),
    10,
  );
  const blockSize = Math.min(
    baseRecoveryPoolTakeLimit,
    Math.max(1, Number.isNaN(requestedRaw) ? baseRecoveryPoolTakeLimit : requestedRaw),
  );
  const department =
    String(formData.get("department") ?? "")
      .trim()
      .slice(0, 100) || null;
  const planContains =
    String(formData.get("plan") ?? "")
      .trim()
      .slice(0, 100) || null;

  // La membresía vendedora define el equipo cuyo pool se puede tomar.
  const sellingMembership = await database.commercialTeamMember.findFirst({
    where: {
      organizationId: membership.organization.id,
      userId: session.user.id,
      salesEnabled: true,
      isActive: true,
      isPrimary: true,
      team: { status: "ACTIVE" },
      user: { status: "ACTIVE" },
    },
    select: { teamId: true, team: { select: { name: true } } },
  });

  if (!sellingMembership) {
    return {
      type: "error",
      message:
        "No tienes venta habilitada en un equipo activo, así que no puedes tomar casos del pool.",
    };
  }

  // BR-077: antes de tomar, lo abandonado vuelve al pool.
  await returnStaleBaseCasesToPool(membership.organization.id);

  const poolWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    status: "OPEN",
    assignedTeamId: sellingMembership.teamId,
    assignedUserId: null,
    // BR-050: un supervisor vendedor no toma casos que él mismo liberó del
    // triage. Un asesor no libera casos, así que el filtro no le quita nada.
    events: {
      none: { type: "TRIAGE_RELEASED", actorUserId: session.user.id },
    },
    ...(department
      ? { department: { equals: department, mode: "insensitive" } }
      : {}),
    ...(planContains
      ? {
          services: {
            some: {
              discardedAt: null,
              planRaw: { contains: planContains, mode: "insensitive" },
            },
          },
        }
      : {}),
  };

  const outcome = await database.$transaction(async (transaction) => {
    const now = new Date();

    // BR-078/BR-039: primero las habilitaciones vencidas — su ventana es más
    // corta —, después lo más reciente.
    const overdue = await transaction.recoveryCase.findMany({
      where: {
        ...poolWhere,
        portabilityEligibleAt: { not: null, lte: now },
      },
      orderBy: { portabilityEligibleAt: "asc" },
      take: blockSize,
      select: { id: true },
    });

    const remaining = blockSize - overdue.length;
    const recent =
      remaining > 0
        ? await transaction.recoveryCase.findMany({
            where: {
              ...poolWhere,
              id: { notIn: overdue.map((item) => item.id) },
            },
            orderBy: { lastSightingAt: "desc" },
            take: remaining,
            select: { id: true },
          })
        : [];

    const candidateIds = [...overdue, ...recent].map((item) => item.id);

    if (candidateIds.length === 0) {
      return { kind: "EMPTY" as const };
    }

    // Toma atómica: solo se lleva los que siguen libres al ejecutarse.
    await transaction.recoveryCase.updateMany({
      where: {
        id: { in: candidateIds },
        status: "OPEN",
        assignedUserId: null,
      },
      data: {
        status: "ASSIGNED",
        assignedUserId: session.user.id,
        claimedAt: now,
        nextActionAt: now,
      },
    });

    const taken = await transaction.recoveryCase.findMany({
      where: { id: { in: candidateIds }, assignedUserId: session.user.id },
      select: { id: true },
    });

    if (taken.length === 0) {
      return { kind: "RACED" as const };
    }

    await transaction.recoveryCaseEvent.createMany({
      data: taken.map((item) => ({
        organizationId: membership.organization.id,
        caseId: item.id,
        type: "ASSIGNED_TO_USER" as const,
        actorUserId: session.user.id,
        previousStatus: "OPEN" as const,
        newStatus: "ASSIGNED" as const,
        metadata: {
          mode: "TOMA_POOL",
          teamId: sellingMembership.teamId,
          blockSize,
          filters: { department, plan: planContains },
        },
      })),
    });

    return { kind: "DONE" as const, taken: taken.length };
  });

  if (outcome.kind === "EMPTY") {
    return {
      type: "error",
      message: department || planContains
        ? "El pool de tu equipo no tiene casos libres que cumplan ese filtro."
        : "El pool de tu equipo está vacío por ahora.",
    };
  }
  if (outcome.kind === "RACED") {
    return {
      type: "error",
      message:
        "Otros asesores tomaron esos casos primero. Vuelve a intentar: el pool se reparte en orden de llegada.",
    };
  }

  revalidatePath("/recovery/campaigns");
  revalidatePath("/recovery/distribute");

  return {
    type: "success",
    message: `Tomaste ${outcome.taken} caso(s) del pool de ${sellingMembership.team.name}. Trabájalos hoy: cada uno exige tres intentos si no responden.`,
  };
}
