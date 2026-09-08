import "server-only";

import type { Prisma } from "@repo/database";

export interface RecoveryActor {
  userId: string;
  role: string;
  organizationId: string;
}

type TeamMemberReader = {
  commercialTeamMember: {
    findMany: (args: {
      where: Prisma.CommercialTeamMemberWhereInput;
      select: { teamId: true };
    }) => Promise<Array<{ teamId: string }>>;
  };
};

/**
 * Quién puede actuar sobre un caso — SPEC-030 BR-029b, BR-030, BR-090;
 * SPEC-048 BR-010. Una sola definición para tipificar, resolver, reprogramar
 * y cancelar: el asesor solo sus casos asignados; el supervisor dentro de
 * sus equipos (o el caso que él mismo tiene asignado); administración y
 * backoffice, toda la organización.
 */
export async function recoveryCaseAccessWhere(
  db: TeamMemberReader,
  actor: RecoveryActor,
): Promise<Prisma.RecoveryCaseWhereInput> {
  const supervisedTeamIds =
    actor.role === "SUPERVISOR"
      ? (
          await db.commercialTeamMember.findMany({
            where: {
              userId: actor.userId,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: {
                organizationId: actor.organizationId,
                status: "ACTIVE",
              },
            },
            select: { teamId: true },
          })
        ).map((item) => item.teamId)
      : null;

  return {
    organizationId: actor.organizationId,
    ...(actor.role === "AGENT" ? { assignedUserId: actor.userId } : {}),
    ...(supervisedTeamIds
      ? {
          OR: [
            { assignedTeamId: { in: supervisedTeamIds } },
            { originalTeamId: { in: supervisedTeamIds } },
            { assignedUserId: actor.userId },
          ],
        }
      : {}),
  };
}

/** Tramo de quince minutos que contiene un instante (SPEC-048 BR-016). */
export function commitmentSlotRange(scheduledAt: Date): { gte: Date; lt: Date } {
  const slotMs = 15 * 60 * 1000;
  const from = Math.floor(scheduledAt.getTime() / slotMs) * slotMs;

  return { gte: new Date(from), lt: new Date(from + slotMs) };
}
