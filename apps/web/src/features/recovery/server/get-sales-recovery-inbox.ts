import "server-only";

import {
  classifyInternalRecoveryDue,
  compareInternalRecoveryCases,
  getLimaIsoDate,
} from "@repo/validation";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";
import type { InternalRecoveryDue } from "@repo/validation";

export interface SalesRecoveryAccess {
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

export interface SalesRecoveryInboxOptions {
  /** Ver solo los casos con este vencimiento (BR-095). */
  due?: InternalRecoveryDue | null;
  page?: number;
}

export interface SalesRecoveryCaseItem {
  id: string;
  originalAgentUserId: string | null;
  orderCode: string | null;
  /** Día de Lima en que se registró la venta, para abrirla en su período. */
  orderRegisteredDay: string | null;
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
  /** Qué venció, si algo venció: primer contacto, seguimiento o agenda. */
  due: InternalRecoveryDue | null;
  isCritical: boolean;
}

export interface SalesRecoveryInboxData {
  generatedAt: string;
  role: SalesRecoveryAccess["role"];
  scopeLabel: string;
  canAssign: boolean;
  advisorOptions: Array<{ id: string; name: string; teamName: string }>;
  /** Sobre toda la cartera del alcance, no sobre la página visible. */
  totals: {
    open: number;
    firstContactOverdue: number;
    followUpOverdue: number;
    agendaOverdue: number;
    criticalUnassigned: number;
    recoveredThisMonth: number;
  };
  dueFilter: InternalRecoveryDue | null;
  pagination: { page: number; totalPages: number; total: number };
  cases: SalesRecoveryCaseItem[];
}

export const salesRecoveryPageSize = 100;

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

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
  options: SalesRecoveryInboxOptions = {},
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
    // BR-095: se trae toda la cartera abierta del alcance y se ordena aquí con
    // la regla de negocio. Antes se cortaba en 200 por fecha de creación y se
    // ordenaba después: el orden solo valía dentro del recorte.
    database.recoveryCase.findMany({
      where: { ...baseWhere, status: { in: [...openStatuses] } },
      select: {
        id: true,
        status: true,
        priority: true,
        entryReason: true,
        entryObservation: true,
        holderName: true,
        documentNumber: true,
        lastSightingAt: true,
        firstContactAt: true,
        nextActionAt: true,
        originalAgentUserId: true,
        assignedUser: { select: { name: true } },
        originalAgent: { select: { name: true } },
        originalTeam: { select: { name: true } },
        sourceDitoOrder: { select: { orderCodeRaw: true, registeredAt: true } },
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

  const ranked = cases
    .map((item) => ({
      row: item,
      priority: item.priority ? String(item.priority) : null,
      due: classifyInternalRecoveryDue(
        {
          status: String(item.status),
          firstContactAt: item.firstContactAt,
          nextActionAt: item.nextActionAt,
          noveltyAt: item.lastSightingAt,
        },
        now,
      ),
      nextActionAt: item.nextActionAt,
      noveltyAt: item.lastSightingAt,
    }))
    .sort(compareInternalRecoveryCases);

  const dueFilter = options.due ?? null;
  const scoped = dueFilter
    ? ranked.filter((item) => item.due === dueFilter)
    : ranked;
  const totalPages = Math.max(
    1,
    Math.ceil(scoped.length / salesRecoveryPageSize),
  );
  const requestedPage = Number.isFinite(options.page ?? 1)
    ? Math.trunc(options.page ?? 1)
    : 1;
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * salesRecoveryPageSize;

  const items = scoped
    .slice(start, start + salesRecoveryPageSize)
    .map(({ row, priority, due }): SalesRecoveryCaseItem => ({
      id: row.id,
      originalAgentUserId: row.originalAgentUserId,
      orderCode: row.sourceDitoOrder?.orderCodeRaw ?? null,
      orderRegisteredDay: row.sourceDitoOrder
        ? getLimaIsoDate(row.sourceDitoOrder.registeredAt)
        : null,
      holderName: row.holderName,
      documentNumber: row.documentNumber,
      status: String(row.status),
      priority,
      entryReason: row.entryReason ? String(row.entryReason) : null,
      entryObservation: row.entryObservation,
      assignedToName: row.assignedUser?.name ?? null,
      originalAgentName: row.originalAgent?.name ?? null,
      originalTeamName: row.originalTeam?.name ?? null,
      noveltyAtLabel: dateTimeFormatter.format(row.lastSightingAt),
      nextActionAtLabel: row.nextActionAt
        ? dateTimeFormatter.format(row.nextActionAt)
        : null,
      due,
      isCritical: priority === "CRITICA",
    }));

  const countDue = (due: InternalRecoveryDue) =>
    ranked.filter((item) => item.due === due).length;

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
      open: ranked.length,
      firstContactOverdue: countDue("primer_contacto"),
      followUpOverdue: countDue("seguimiento"),
      agendaOverdue: countDue("agenda"),
      criticalUnassigned: ranked.filter(
        (item) => item.priority === "CRITICA" && item.row.assignedUser === null,
      ).length,
      recoveredThisMonth,
    },
    dueFilter,
    pagination: { page, totalPages, total: scoped.length },
    cases: items,
  };
}
