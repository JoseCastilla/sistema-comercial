import "server-only";

import { resolveDitoOrderScope } from "@repo/validation";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

import type { PerformanceRole } from "../performance.types";

export interface PerformanceAccess {
  userId: string;
  role: PerformanceRole;
}

export interface PerformanceScope {
  supervisedTeamIds: string[];
  salesEnabled: boolean;
  teamOptions: Array<{ id: string; name: string }>;
  accessWhere: Prisma.DitoOrderWhereInput;
}

/**
 * Traduce el alcance de dominio a un filtro de Prisma. Cubre todos los tipos
 * de alcance de forma exhaustiva y niega por defecto: un alcance no
 * reconocido nunca amplía la visibilidad a la organización.
 */
export function getPerformanceAccessWhere(
  role: PerformanceRole,
  userId: string,
  supervisedTeamIds: readonly string[],
  salesEnabled: boolean,
): Prisma.DitoOrderWhereInput {
  const scope = resolveDitoOrderScope({
    role,
    userId,
    supervisedTeamIds,
    salesEnabled,
  });

  if (scope.kind === "ORGANIZATION") return {};
  if (scope.kind === "AGENT") return { agentUserId: scope.userId };
  if (scope.kind === "SUPERVISED_TEAMS_WITH_ORPHANS") {
    return {
      OR: [
        { assignedTeamId: { in: [...scope.teamIds] } },
        { agentUserId: null, assignedTeamId: null },
      ],
    };
  }
  if (scope.kind === "SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS") {
    return {
      OR: [
        { assignedTeamId: { in: [...scope.teamIds] } },
        { agentUserId: scope.userId },
        { agentUserId: null, assignedTeamId: null },
      ],
    };
  }
  return { assignedTeamId: { in: [] } };
}

export async function resolvePerformanceScope(
  organizationId: string,
  access: PerformanceAccess,
): Promise<PerformanceScope> {
  const teamOptions =
    access.role === "AGENT"
      ? []
      : await database.commercialTeam.findMany({
          where: {
            organizationId,
            status: "ACTIVE",
            ...(access.role === "SUPERVISOR"
              ? {
                  members: {
                    some: {
                      userId: access.userId,
                      memberRole: "SUPERVISOR",
                      isActive: true,
                    },
                  },
                }
              : {}),
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });
  const supervisedTeamIds =
    access.role === "SUPERVISOR" ? teamOptions.map((team) => team.id) : [];
  const salesEnabled =
    access.role === "SUPERVISOR" &&
    (await database.commercialTeamMember.findFirst({
      where: {
        userId: access.userId,
        salesEnabled: true,
        isPrimary: true,
        isActive: true,
        team: { organizationId, status: "ACTIVE" },
      },
      select: { teamId: true },
    })) !== null;

  return {
    supervisedTeamIds,
    salesEnabled,
    teamOptions,
    accessWhere: getPerformanceAccessWhere(
      access.role,
      access.userId,
      supervisedTeamIds,
      salesEnabled,
    ),
  };
}

/**
 * Un asesor solicitado solo es válido si el actor ya podría verlo: la
 * organización para ADMIN y BACKOFFICE, los equipos supervisados —o él mismo—
 * para SUPERVISOR. AGENT nunca filtra por otro asesor. Devuelve `null` cuando
 * el identificador queda fuera del alcance, para volver al alcance natural.
 */
export async function resolveRequestedAdvisor(
  organizationId: string,
  access: PerformanceAccess,
  requestedAgentId: string | undefined,
): Promise<{ id: string; name: string } | null> {
  const agentId = requestedAgentId?.trim().slice(0, 50);
  if (!agentId || access.role === "AGENT") return null;

  const member = await database.organizationMember.findFirst({
    where: {
      organizationId,
      userId: agentId,
      role: { in: ["AGENT", "SUPERVISOR"] },
    },
    select: { userId: true, user: { select: { name: true } } },
  });
  if (!member) return null;

  if (access.role === "SUPERVISOR" && agentId !== access.userId) {
    const supervised = await database.commercialTeamMember.findFirst({
      where: {
        userId: agentId,
        team: {
          organizationId,
          status: "ACTIVE",
          members: {
            some: {
              userId: access.userId,
              memberRole: "SUPERVISOR",
              isActive: true,
            },
          },
        },
      },
      select: { teamId: true },
    });
    if (!supervised) return null;
  }

  return { id: member.userId, name: member.user.name };
}
