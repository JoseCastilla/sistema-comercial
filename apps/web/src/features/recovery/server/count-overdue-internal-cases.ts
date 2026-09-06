import "server-only";

import {
  classifyInternalRecoveryDue,
  salesRecoveryOpenStatuses,
} from "@repo/validation";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

export interface OverdueCountAccess {
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

/**
 * SPEC-045 PL-02: la alerta flotante y la bandeja de Recupero de ventas
 * cuentan «vencido» con la misma regla —`classifyInternalRecoveryDue`, la
 * de SPEC-030 BR-095— y sobre el mismo alcance por rol que la bandeja
 * (`getSalesRecoveryInbox`). Antes la alerta contaba «próxima acción en el
 * pasado» sin mirar si alguien había llamado, y abría la bandeja sin filtro.
 */
export async function getSalesRecoveryAccessWhere(
  organizationId: string,
  access: OverdueCountAccess,
): Promise<Prisma.RecoveryCaseWhereInput> {
  if (access.role === "ADMIN" || access.role === "BACKOFFICE") return {};
  if (access.role === "AGENT") return { assignedUserId: access.userId };

  const supervised = await database.commercialTeamMember.findMany({
    where: {
      userId: access.userId,
      memberRole: "SUPERVISOR",
      isActive: true,
      team: { organizationId, status: "ACTIVE" },
    },
    select: { teamId: true },
  });
  const teamIds = supervised.map((item) => item.teamId);

  return {
    OR: [
      { assignedTeamId: { in: teamIds } },
      { originalTeamId: { in: teamIds } },
      { assignedUserId: access.userId },
    ],
  };
}

export async function countOverdueInternalCases(
  organizationId: string,
  access: OverdueCountAccess,
  now = new Date(),
): Promise<number> {
  const accessWhere = await getSalesRecoveryAccessWhere(organizationId, access);
  const rows = await database.recoveryCase.findMany({
    where: {
      organizationId,
      source: { in: ["INTERNAL_ORDER_STATE", "MANUAL"] },
      status: { in: [...salesRecoveryOpenStatuses] },
      ...accessWhere,
    },
    select: {
      status: true,
      firstContactAt: true,
      nextActionAt: true,
      lastSightingAt: true,
    },
  });

  return rows.filter(
    (row) =>
      classifyInternalRecoveryDue(
        {
          status: String(row.status),
          firstContactAt: row.firstContactAt,
          nextActionAt: row.nextActionAt,
          noveltyAt: row.lastSightingAt,
        },
        now,
      ) !== null,
  ).length;
}
