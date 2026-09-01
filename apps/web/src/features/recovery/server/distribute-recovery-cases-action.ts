"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { distributeCasesEquitably } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { RecoveryTriageActionState } from "./recovery-action.types";
import type { Prisma } from "@repo/database";

/**
 * Distribución en lote de casos de campaña — SPEC-030 BR-028 a BR-030b y
 * BR-050b.
 *
 * Tres modos sobre una selección de casos `OPEN` (o `ASSIGNED` sin gestión,
 * BR-030b):
 * - `DIRECTA`: todo el lote a un asesor concreto.
 * - `EQUITATIVA`: reparto en ronda entre los asesores elegibles marcados del
 *   equipo, con diferencia máxima de un caso (BR-028c) y exclusión de
 *   ausentes registrada (BR-028b).
 * - `COLA`: el lote pasa al pool del equipo sin nominar asesor; la toma
 *   posterior es atómica (BR-028).
 *
 * El reparto manual entre equipos (BR-028) se compone con estas piezas:
 * "seleccionar los primeros N" + un modo por equipo, cada sub-lote auditado.
 */
const distributionRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

interface DistributableCase {
  id: string;
  status: "OPEN" | "ASSIGNED";
  assignedTeamId: string | null;
  assignedUserId: string | null;
  claimedAt: Date | null;
  portabilityEligibleAt: Date | null;
  lastSightingAt: Date;
  lastAttemptAt: Date | null;
}

export async function distributeRecoveryCasesAction(
  previousState: RecoveryTriageActionState,
  formData: FormData,
): Promise<RecoveryTriageActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!distributionRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const mode = String(formData.get("mode") ?? "").trim();
  const caseIds = formData
    .getAll("caseIds")
    .filter((value): value is string => typeof value === "string");

  if (mode !== "DIRECTA" && mode !== "EQUITATIVA" && mode !== "COLA") {
    return { type: "error", message: "Elige cómo quieres repartir los casos." };
  }
  if (caseIds.length === 0) {
    return {
      type: "error",
      message: "Selecciona al menos un caso para distribuir.",
    };
  }

  const supervisedTeamIds =
    membership.role === "SUPERVISOR"
      ? (
          await database.commercialTeamMember.findMany({
            where: {
              organizationId: membership.organization.id,
              userId: session.user.id,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: { status: "ACTIVE" },
            },
            select: { teamId: true },
          })
        ).map((item) => item.teamId)
      : null;

  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  // Cada modo trae su propio selector de equipo en el formulario.
  const teamId = String(
    formData.get(mode === "COLA" ? "poolTeamId" : "equitableTeamId") ?? "",
  ).trim();
  const participantIds = formData
    .getAll("participantIds")
    .filter((value): value is string => typeof value === "string");

  // BR-050b: elegir casos concretos para uno mismo es la puerta a quedarse
  // con los mejores leads. La equitativa sí puede incluirlo: ahí decide el
  // sistema.
  if (
    mode === "DIRECTA" &&
    membership.role === "SUPERVISOR" &&
    targetUserId === session.user.id
  ) {
    return {
      type: "error",
      message:
        "No puedes asignarte casos por selección directa. Inclúyete en una distribución equitativa o pide a administración que te asigne.",
    };
  }

  const outcome = await database.$transaction(async (transaction) => {
    const candidates = await transaction.recoveryCase.findMany({
      where: {
        id: { in: caseIds },
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: { in: ["OPEN", "ASSIGNED"] },
        ...(supervisedTeamIds
          ? { assignedTeamId: { in: supervisedTeamIds } }
          : {}),
      },
      select: {
        id: true,
        status: true,
        assignedTeamId: true,
        assignedUserId: true,
        claimedAt: true,
        portabilityEligibleAt: true,
        lastSightingAt: true,
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        services: {
          where: { discardedAt: null, portabilityCheckedAt: null },
          take: 1,
          select: { id: true },
        },
      },
    });

    const now = new Date();

    // BR-030b: un caso asignado solo se redistribuye en lote si no tiene
    // gestión desde su asignación; con gestión iniciada, la reasignación es
    // individual y humana (BR-030).
    const distributable: DistributableCase[] = candidates
      .map((item) => ({
        id: item.id,
        status: item.status as "OPEN" | "ASSIGNED",
        assignedTeamId: item.assignedTeamId,
        assignedUserId: item.assignedUserId,
        claimedAt: item.claimedAt,
        portabilityEligibleAt: item.portabilityEligibleAt,
        lastSightingAt: item.lastSightingAt,
        lastAttemptAt: item.attempts[0]?.createdAt ?? null,
      }))
      .filter(
        (item) =>
          item.status === "OPEN" ||
          item.claimedAt === null ||
          item.lastAttemptAt === null ||
          item.lastAttemptAt.getTime() < item.claimedAt.getTime(),
      );

    if (distributable.length === 0) {
      return { kind: "NONE" as const, skipped: candidates.length };
    }

    // BR-083: distribuir sin verificar se advierte pero no se bloquea. Si la
    // herramienta de consulta falla, la operación decide asumir el costo.
    const unverifiedCount = candidates.filter(
      (item) => item.services.length > 0,
    ).length;

    // BR-028c/BR-078: el reparto respeta el orden de prioridad de la cola —
    // habilitaciones vencidas primero, luego lo más reciente.
    const ordered = [...distributable].sort((left, right) => {
      const leftOverdue =
        left.portabilityEligibleAt !== null &&
        left.portabilityEligibleAt.getTime() <= now.getTime();
      const rightOverdue =
        right.portabilityEligibleAt !== null &&
        right.portabilityEligibleAt.getTime() <= now.getTime();
      if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
      return right.lastSightingAt.getTime() - left.lastSightingAt.getTime();
    });

    const skipped = candidates.length - distributable.length;

    const result =
      mode === "COLA"
        ? await applyPoolMode(transaction, {
            organizationId: membership.organization.id,
            actorUserId: session.user.id,
            supervisedTeamIds,
            teamId,
            cases: ordered,
            skipped,
          })
        : mode === "DIRECTA"
          ? await applyDirectMode(transaction, {
              organizationId: membership.organization.id,
              actorUserId: session.user.id,
              supervisedTeamIds,
              targetUserId,
              cases: ordered,
              skipped,
              now,
            })
          : await applyEquitableMode(transaction, {
              organizationId: membership.organization.id,
              actorUserId: session.user.id,
              supervisedTeamIds,
              teamId,
              participantIds,
              cases: ordered,
              skipped,
              now,
            });

    return result.kind === "DONE" ? { ...result, unverifiedCount } : result;
  });

  if (outcome.kind === "NONE") {
    return {
      type: "error",
      message:
        outcome.skipped > 0
          ? "Los casos seleccionados ya tienen gestión iniciada o no pertenecen a tus equipos: el reparto masivo solo aplica a casos sin trabajar."
          : "Ninguno de los casos seleccionados está disponible para repartir en tus equipos.",
    };
  }
  if (outcome.kind === "TEAM_INVALID") {
    return { type: "error", message: "El equipo destino no está activo o no es uno de tus equipos." };
  }
  if (outcome.kind === "TARGET_INVALID") {
    return {
      type: "error",
      message:
        "El asesor destino no está activo con venta habilitada en tus equipos.",
    };
  }
  if (outcome.kind === "PARTICIPANTS_INVALID") {
    return {
      type: "error",
      message:
        "Marca al menos un asesor participante del equipo; solo cuentan los activos con venta habilitada.",
    };
  }

  revalidatePath("/recovery/distribute");
  revalidatePath("/recovery/triage");
  revalidatePath("/recovery/campaigns");
  revalidatePath("/admin/recovery-base");

  const skippedSuffix =
    outcome.skipped > 0
      ? ` ${outcome.skipped} caso(s) quedaron fuera por tener gestión iniciada.`
      : "";
  const unverifiedSuffix =
    "unverifiedCount" in outcome && (outcome.unverifiedCount ?? 0) > 0
      ? ` Ojo: ${outcome.unverifiedCount} caso(s) van sin verificación de portabilidad.`
      : "";

  return {
    type: "success",
    message: `${outcome.message}${skippedSuffix}${unverifiedSuffix}`,
  };
}

async function applyPoolMode(
  transaction: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorUserId: string;
    supervisedTeamIds: string[] | null;
    teamId: string;
    cases: DistributableCase[];
    skipped: number;
  },
) {
  if (
    !input.teamId ||
    (input.supervisedTeamIds !== null &&
      !input.supervisedTeamIds.includes(input.teamId))
  ) {
    return { kind: "TEAM_INVALID" as const };
  }

  const team = await transaction.commercialTeam.findFirst({
    where: {
      id: input.teamId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    select: { id: true, name: true },
  });

  if (!team) return { kind: "TEAM_INVALID" as const };

  await transaction.recoveryCase.updateMany({
    where: { id: { in: input.cases.map((item) => item.id) } },
    data: {
      status: "OPEN",
      assignedTeamId: team.id,
      assignedUserId: null,
      claimedAt: null,
      // BR-076: un caso en el pool no tiene SLA.
      nextActionAt: null,
    },
  });

  await transaction.recoveryCaseEvent.createMany({
    data: input.cases.map((item) => ({
      organizationId: input.organizationId,
      caseId: item.id,
      type: "ASSIGNED_TO_TEAM" as const,
      actorUserId: input.actorUserId,
      previousStatus: item.status,
      newStatus: "OPEN" as const,
      observation: `Enviado a la cola del equipo ${team.name}; la toma es por bloque y atómica.`,
      metadata: {
        mode: "COLA",
        teamId: team.id,
        previousTeamId: item.assignedTeamId,
        previousAssignedUserId: item.assignedUserId,
      },
    })),
  });

  return {
    kind: "DONE" as const,
    skipped: input.skipped,
    message: `${input.cases.length} caso(s) enviados a la cola del equipo ${team.name}.`,
  };
}

async function applyDirectMode(
  transaction: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorUserId: string;
    supervisedTeamIds: string[] | null;
    targetUserId: string;
    cases: DistributableCase[];
    skipped: number;
    now: Date;
  },
) {
  if (!input.targetUserId) return { kind: "TARGET_INVALID" as const };

  const target = await transaction.commercialTeamMember.findFirst({
    where: {
      userId: input.targetUserId,
      salesEnabled: true,
      isActive: true,
      isPrimary: true,
      team: {
        organizationId: input.organizationId,
        status: "ACTIVE",
        ...(input.supervisedTeamIds
          ? { id: { in: input.supervisedTeamIds } }
          : {}),
      },
      user: { status: "ACTIVE" },
    },
    select: { teamId: true, user: { select: { name: true } } },
  });

  if (!target) return { kind: "TARGET_INVALID" as const };

  await transaction.recoveryCase.updateMany({
    where: { id: { in: input.cases.map((item) => item.id) } },
    data: {
      status: "ASSIGNED",
      assignedUserId: input.targetUserId,
      // BR-029: asignar a un asesor coloca el caso en su equipo.
      assignedTeamId: target.teamId,
      claimedAt: input.now,
      // BR-076: los relojes de campaña corren desde la asignación.
      nextActionAt: input.now,
    },
  });

  await transaction.recoveryCaseEvent.createMany({
    data: input.cases.map((item) => ({
      organizationId: input.organizationId,
      caseId: item.id,
      type: "ASSIGNED_TO_USER" as const,
      actorUserId: input.actorUserId,
      previousStatus: item.status,
      newStatus: "ASSIGNED" as const,
      metadata: {
        mode: "DIRECTA",
        targetUserId: input.targetUserId,
        targetTeamId: target.teamId,
        previousAssignedUserId: item.assignedUserId,
        lotSize: input.cases.length,
      },
    })),
  });

  return {
    kind: "DONE" as const,
    skipped: input.skipped,
    message: `${input.cases.length} caso(s) asignados a ${target.user.name}.`,
  };
}

async function applyEquitableMode(
  transaction: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorUserId: string;
    supervisedTeamIds: string[] | null;
    teamId: string;
    participantIds: string[];
    cases: DistributableCase[];
    skipped: number;
    now: Date;
  },
) {
  if (
    !input.teamId ||
    (input.supervisedTeamIds !== null &&
      !input.supervisedTeamIds.includes(input.teamId))
  ) {
    return { kind: "TEAM_INVALID" as const };
  }

  const team = await transaction.commercialTeam.findFirst({
    where: {
      id: input.teamId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    select: { id: true, name: true },
  });

  if (!team) return { kind: "TEAM_INVALID" as const };

  // BR-028b: los elegibles son los activos con venta habilitada del equipo;
  // los deseleccionados quedan registrados como excluidos del lote.
  const eligibleMembers = await transaction.commercialTeamMember.findMany({
    where: {
      teamId: team.id,
      salesEnabled: true,
      isActive: true,
      isPrimary: true,
      user: { status: "ACTIVE" },
    },
    select: { userId: true, user: { select: { name: true } } },
  });

  const eligibleIds = new Set(eligibleMembers.map((item) => item.userId));
  const participants = [...new Set(input.participantIds)].filter((userId) =>
    eligibleIds.has(userId),
  );

  if (participants.length === 0) {
    return { kind: "PARTICIPANTS_INVALID" as const };
  }

  const excluded = eligibleMembers
    .map((item) => item.userId)
    .filter((userId) => !participants.includes(userId));

  // BR-028c: el residuo va a quienes tienen menos casos de campaña abiertos.
  const openCounts = await transaction.recoveryCase.groupBy({
    by: ["assignedUserId"],
    where: {
      organizationId: input.organizationId,
      source: "NATIONAL_BASE",
      status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
      assignedUserId: { in: participants },
    },
    _count: { _all: true },
  });
  const openByUser = new Map(
    openCounts.map((item) => [item.assignedUserId, item._count._all]),
  );

  const assignments = distributeCasesEquitably({
    orderedCaseIds: input.cases.map((item) => item.id),
    advisors: participants.map((userId) => ({
      userId,
      openCases: openByUser.get(userId) ?? 0,
    })),
  });

  const previousAssigneeByCase = new Map(
    input.cases.map((item) => [item.id, item.assignedUserId]),
  );
  const previousStatusByCase = new Map(
    input.cases.map((item) => [item.id, item.status]),
  );

  const byUser = new Map<string, string[]>();
  for (const assignment of assignments) {
    const list = byUser.get(assignment.userId) ?? [];
    list.push(assignment.caseId);
    byUser.set(assignment.userId, list);
  }

  for (const [userId, userCaseIds] of byUser) {
    await transaction.recoveryCase.updateMany({
      where: { id: { in: userCaseIds } },
      data: {
        status: "ASSIGNED",
        assignedUserId: userId,
        assignedTeamId: team.id,
        claimedAt: input.now,
        nextActionAt: input.now,
      },
    });
  }

  await transaction.recoveryCaseEvent.createMany({
    data: assignments.map((assignment) => ({
      organizationId: input.organizationId,
      caseId: assignment.caseId,
      type: "ASSIGNED_TO_USER" as const,
      actorUserId: input.actorUserId,
      previousStatus: previousStatusByCase.get(assignment.caseId) ?? "OPEN",
      newStatus: "ASSIGNED" as const,
      metadata: {
        mode: "EQUITATIVA",
        targetUserId: assignment.userId,
        targetTeamId: team.id,
        previousAssignedUserId:
          previousAssigneeByCase.get(assignment.caseId) ?? null,
        lotSize: assignments.length,
        participants,
        excluded,
      },
    })),
  });

  const nameByUser = new Map(
    eligibleMembers.map((item) => [item.userId, item.user.name]),
  );
  const summary = [...byUser.entries()]
    .map(([userId, list]) => `${nameByUser.get(userId) ?? userId}: ${list.length}`)
    .join(", ");

  return {
    kind: "DONE" as const,
    skipped: input.skipped,
    message: `${assignments.length} caso(s) repartidos en ${team.name} (${summary}).${
      excluded.length > 0
        ? ` ${excluded.length} asesor(es) quedaron excluidos y registrados en el lote.`
        : ""
    }`,
  };
}
