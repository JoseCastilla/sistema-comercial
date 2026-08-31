import "server-only";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

export interface SalesRecoveryAccess {
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

export interface SalesRecoveryCaseItem {
  id: string;
  originalAgentUserId: string | null;
  orderCode: string | null;
  holderName: string;
  documentNumber: string;
  status: string;
  priority: string | null;
  entryReason: string | null;
  entryObservation: string | null;
  assignedToName: string | null;
  originalAgentName: string | null;
  originalTeamName: string | null;
  noveltyAtLabel: string;
  nextActionAtLabel: string | null;
  nextActionOverdue: boolean;
  isCritical: boolean;
}

export interface SalesRecoveryInboxData {
  generatedAt: string;
  role: SalesRecoveryAccess["role"];
  scopeLabel: string;
  canAssign: boolean;
  advisorOptions: Array<{ id: string; name: string; teamName: string }>;
  totals: {
    open: number;
    overdue: number;
    criticalUnassigned: number;
    recoveredThisMonth: number;
  };
  cases: SalesRecoveryCaseItem[];
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const priorityRank: Record<string, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  CONDICIONADA: 1,
};

const openStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

// BR-074: esta bandeja habla solo del carril interno; la base nacional tiene
// su propia superficie.
const internalSources = ["INTERNAL_ORDER_STATE", "MANUAL"] as const;

async function getAccessWhere(
  organizationId: string,
  access: SalesRecoveryAccess,
): Promise<Prisma.RecoveryCaseWhereInput> {
  if (access.role === "ADMIN" || access.role === "BACKOFFICE") return {};
  if (access.role === "AGENT") {
    return { assignedUserId: access.userId };
  }

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

export async function getSalesRecoveryInbox(
  organizationId: string,
  access: SalesRecoveryAccess,
): Promise<SalesRecoveryInboxData> {
  const now = new Date();
  const accessWhere = await getAccessWhere(organizationId, access);
  const baseWhere: Prisma.RecoveryCaseWhereInput = {
    organizationId,
    source: { in: [...internalSources] },
    ...accessWhere,
  };

  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(5, 0, 0, 0);

  const canAssign = access.role !== "AGENT";
  const supervisedTeamIds =
    access.role === "SUPERVISOR"
      ? (
          await database.commercialTeamMember.findMany({
            where: {
              userId: access.userId,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: { organizationId, status: "ACTIVE" },
            },
            select: { teamId: true },
          })
        ).map((item) => item.teamId)
      : null;

  const [cases, recoveredThisMonth, advisorMemberships] = await Promise.all([
    database.recoveryCase.findMany({
      where: { ...baseWhere, status: { in: [...openStatuses] } },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        status: true,
        priority: true,
        entryReason: true,
        entryObservation: true,
        holderName: true,
        documentNumber: true,
        lastSightingAt: true,
        nextActionAt: true,
        originalAgentUserId: true,
        assignedUser: { select: { name: true } },
        originalAgent: { select: { name: true } },
        originalTeam: { select: { name: true } },
        sourceDitoOrder: { select: { orderCodeRaw: true } },
      },
    }),
    database.recoveryCase.count({
      where: {
        ...baseWhere,
        status: "RECOVERED",
        resolvedAt: { gte: monthStart },
      },
    }),
    canAssign
      ? database.commercialTeamMember.findMany({
          where: {
            salesEnabled: true,
            isActive: true,
            isPrimary: true,
            team: {
              organizationId,
              status: "ACTIVE",
              ...(supervisedTeamIds ? { id: { in: supervisedTeamIds } } : {}),
            },
            user: { status: "ACTIVE" },
          },
          select: {
            userId: true,
            user: { select: { name: true } },
            team: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const advisorOptions = advisorMemberships
    .map((item) => ({
      id: item.userId,
      name: item.user.name,
      teamName: item.team.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  const items = cases
    .map((item): SalesRecoveryCaseItem => {
      const overdue =
        item.nextActionAt !== null && item.nextActionAt.getTime() < now.getTime();
      return {
        id: item.id,
        originalAgentUserId: item.originalAgentUserId,
        orderCode: item.sourceDitoOrder?.orderCodeRaw ?? null,
        holderName: item.holderName,
        documentNumber: item.documentNumber,
        status: String(item.status),
        priority: item.priority ? String(item.priority) : null,
        entryReason: item.entryReason ? String(item.entryReason) : null,
        entryObservation: item.entryObservation,
        assignedToName: item.assignedUser?.name ?? null,
        originalAgentName: item.originalAgent?.name ?? null,
        originalTeamName: item.originalTeam?.name ?? null,
        noveltyAtLabel: dateTimeFormatter.format(item.lastSightingAt),
        nextActionAtLabel: item.nextActionAt
          ? dateTimeFormatter.format(item.nextActionAt)
          : null,
        nextActionOverdue: overdue,
        isCritical: item.priority === "CRITICA",
      };
    })
    // BR-064: primero la prioridad, luego lo más urgente por vencer.
    .sort(
      (left, right) =>
        (priorityRank[right.priority ?? ""] ?? 0) -
          (priorityRank[left.priority ?? ""] ?? 0) ||
        Number(right.nextActionOverdue) - Number(left.nextActionOverdue) ||
        left.noveltyAtLabel.localeCompare(right.noveltyAtLabel),
    );

  return {
    generatedAt: dateTimeFormatter.format(now),
    role: access.role,
    scopeLabel:
      access.role === "AGENT"
        ? "Mis casos"
        : access.role === "SUPERVISOR"
          ? "Mis equipos"
          : "Organización",
    canAssign,
    advisorOptions,
    totals: {
      open: items.length,
      overdue: items.filter((item) => item.nextActionOverdue).length,
      criticalUnassigned: items.filter(
        (item) => item.isCritical && item.assignedToName === null,
      ).length,
      recoveredThisMonth,
    },
    cases: items,
  };
}
