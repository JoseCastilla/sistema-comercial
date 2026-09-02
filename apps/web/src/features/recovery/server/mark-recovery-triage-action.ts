"use server";

import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { RecoveryTriageActionState } from "./recovery-action.types";

const triageRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);
const teamAssignRoles = new Set(["ADMIN", "BACKOFFICE"]);

/**
 * BR-023: el chequeo de pedido enviado es manual; el triage marca en lote el
 * resultado. `EN_ESPERA` deja el caso `WAITING` y reaparece mañana (BR-024);
 * `LIBERADO` lo deja `OPEN`, disponible para asignar (BR-026).
 *
 * BR-022b: `ASIGNAR_EQUIPO` entrega un bloque de casos a un equipo para que
 * su supervisor filtre su propia base y la reparta. Solo `ADMIN` y
 * `BACKOFFICE` mueven casos entre equipos; un supervisor opera únicamente
 * dentro de los suyos (BR-029). Los asesores no ejecutan nada de esto
 * (BR-049).
 */
export async function markRecoveryTriageAction(
  previousState: RecoveryTriageActionState,
  formData: FormData,
): Promise<RecoveryTriageActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!triageRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const decision = formData.get("decision");

  if (
    decision !== "EN_ESPERA" &&
    decision !== "LIBERADO" &&
    decision !== "ASIGNAR_EQUIPO"
  ) {
    return {
      type: "error",
      message: "No se reconoce la acción. Recarga la página.",
    };
  }

  const caseIds = formData
    .getAll("caseIds")
    .filter((value): value is string => typeof value === "string");

  if (caseIds.length === 0) {
    return {
      type: "error",
      message: "Selecciona al menos un caso para marcar.",
    };
  }

  if (decision === "ASIGNAR_EQUIPO") {
    return assignTeam(
      membership.organization.id,
      membership.role,
      session.user.id,
      caseIds,
      formData.get("teamId"),
    );
  }

  const supervisorTeamIds =
    membership.role === "SUPERVISOR"
      ? await resolveSupervisedTeamIds(
          membership.organization.id,
          session.user.id,
        )
      : null;

  const targetStatus = decision === "EN_ESPERA" ? "WAITING" : "OPEN";
  const eventType =
    decision === "EN_ESPERA" ? "TRIAGE_WAITING" : "TRIAGE_RELEASED";

  /**
   * Tres cosas distintas dejan un caso sin mover, y confundirlas manda a
   * buscar el problema donde no está: que ya estuviera en ese estado, que
   * ya no admita el cambio, o que no pertenezca a los equipos de quien lo
   * intenta. Solo la última es un asunto de permisos.
   */
  const outcome = await database.$transaction(async (transaction) => {
    const reachable = await transaction.recoveryCase.findMany({
      where: {
        id: { in: caseIds },
        organizationId: membership.organization.id,
        ...(supervisorTeamIds
          ? { assignedTeamId: { in: supervisorTeamIds } }
          : {}),
      },
      select: { id: true, status: true },
    });

    const actionable = reachable.filter((item) =>
      ["TRIAGE", "WAITING", "OPEN"].includes(item.status),
    );
    const changing = actionable.filter((item) => item.status !== targetStatus);

    const tally = {
      changed: changing.length,
      alreadyThere: actionable.length - changing.length,
      closed: reachable.length - actionable.length,
      outOfReach: caseIds.length - reachable.length,
    };

    if (changing.length === 0) {
      return tally;
    }

    await transaction.recoveryCase.updateMany({
      where: { id: { in: changing.map((item) => item.id) } },
      data: { status: targetStatus },
    });

    await transaction.recoveryCaseEvent.createMany({
      data: changing.map((item) => ({
        organizationId: membership.organization.id,
        caseId: item.id,
        type: eventType,
        actorUserId: session.user.id,
        previousStatus: item.status,
        newStatus: targetStatus,
        observation:
          decision === "EN_ESPERA"
            ? "Chequeo manual: el cliente aún tiene un pedido en curso."
            : "Chequeo manual: sin pedido en curso, disponible para asignar.",
      })),
    });

    return tally;
  });

  revalidatePath("/recovery/triage");
  revalidatePath("/admin/recovery-base");

  return describeTriageOutcome(decision, outcome);
}

interface TriageTally {
  changed: number;
  alreadyThere: number;
  closed: number;
  outOfReach: number;
}

/**
 * Traduce el recuento a una frase que diga qué pasó de verdad. Sin esto, un
 * supervisor que marca «en espera» casos que el cruce ya había puesto en
 * espera recibía un mensaje sobre sus equipos y se iba a revisar permisos.
 */
function describeTriageOutcome(
  decision: "EN_ESPERA" | "LIBERADO",
  tally: TriageTally,
): RecoveryTriageActionState {
  const estado = decision === "EN_ESPERA" ? "en espera" : "listos para repartir";
  const restos: string[] = [];

  if (tally.alreadyThere > 0) {
    restos.push(`${tally.alreadyThere} ya estaban ${estado}`);
  }

  if (tally.closed > 0) {
    restos.push(`${tally.closed} ya están cerrados`);
  }

  if (tally.outOfReach > 0) {
    restos.push(`${tally.outOfReach} no pertenecen a tus equipos`);
  }

  const cola = restos.length > 0 ? ` · ${restos.join(", ")}` : "";

  if (tally.changed > 0) {
    return {
      type: "success",
      message:
        decision === "EN_ESPERA"
          ? `${tally.changed} caso(s) quedaron en espera y reaparecerán en la revisión de mañana${cola}.`
          : `${tally.changed} caso(s) quedaron listos para repartir${cola}.`,
    };
  }

  // Nada cambió porque no hacía falta: es un aviso, no un error del usuario.
  if (tally.alreadyThere > 0 && tally.closed === 0 && tally.outOfReach === 0) {
    return {
      type: "error",
      message: `Los ${tally.alreadyThere} caso(s) seleccionados ya estaban ${estado}: no había nada que cambiar.`,
    };
  }

  if (restos.length === 0) {
    return {
      type: "error",
      message: "No encontramos esos casos. Recarga la página y vuelve a intentarlo.",
    };
  }

  return {
    type: "error",
    message: `Ningún caso cambió: ${restos.join(", ")}.`,
  };
}

async function assignTeam(
  organizationId: string,
  role: string,
  actorUserId: string,
  caseIds: string[],
  teamIdValue: FormDataEntryValue | null,
): Promise<RecoveryTriageActionState> {
  if (!teamAssignRoles.has(role)) {
    redirect("/access-denied");
  }

  if (typeof teamIdValue !== "string" || teamIdValue.length === 0) {
    return { type: "error", message: "Selecciona el equipo destino." };
  }

  const team = await database.commercialTeam.findFirst({
    where: { id: teamIdValue, organizationId, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  if (!team) {
    return { type: "error", message: "El equipo destino no está activo." };
  }

  const affected = await database.$transaction(async (transaction) => {
    const updatable = await transaction.recoveryCase.findMany({
      where: {
        id: { in: caseIds },
        organizationId,
        status: { in: ["TRIAGE", "WAITING", "OPEN"] },
        // Cuidado con el NULL de SQL: `NOT (columna = X)` también excluye a
        // los casos sin equipo, que son justamente los recién cargados.
        OR: [
          { assignedTeamId: null },
          { assignedTeamId: { not: team.id } },
        ],
      },
      select: { id: true, status: true, assignedTeamId: true },
    });

    if (updatable.length === 0) {
      return 0;
    }

    await transaction.recoveryCase.updateMany({
      where: { id: { in: updatable.map((item) => item.id) } },
      data: { assignedTeamId: team.id },
    });

    await transaction.recoveryCaseEvent.createMany({
      data: updatable.map((item) => ({
        organizationId,
        caseId: item.id,
        type: "ASSIGNED_TO_TEAM" as const,
        actorUserId,
        observation: `Base entregada al equipo ${team.name} para su triage y reparto.`,
        metadata: {
          teamId: team.id,
          previousTeamId: item.assignedTeamId,
        },
      })),
    });

    return updatable.length;
  });

  revalidatePath("/recovery/triage");
  revalidatePath("/admin/recovery-base");

  if (affected === 0) {
    return {
      type: "error",
      message: "Los casos seleccionados ya pertenecen a ese equipo.",
    };
  }

  return {
    type: "success",
    message: `${affected} caso(s) asignados al equipo ${team.name}. Su supervisor ya los ve en su bandeja.`,
  };
}

async function resolveSupervisedTeamIds(
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const memberships = await database.commercialTeamMember.findMany({
    where: {
      organizationId,
      userId,
      memberRole: "SUPERVISOR",
      isActive: true,
      team: { status: "ACTIVE" },
    },
    select: { teamId: true },
  });

  return memberships.map((item) => item.teamId);
}
