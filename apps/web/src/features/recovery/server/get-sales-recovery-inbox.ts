import "server-only";

import {
  allOf,
  classifyInternalRecoveryDue,
  matchesInternalRecoveryDueFilter,
  compareInternalRecoveryCases,
  describeInternalRecoveryStage,
  describeMyDayDue,
  describeSalesRecoveryWork,
  formatCampaignMoment,
  formatMyDaySaleDay,
  getLimaIsoDate,
  isMyDayHotSale,
  parseRecoverySearchTerm,
  pickFilterOption,
  salesRecoveryOpenStatusOptions,
  salesRecoveryOpenStatuses,
  salesRecoveryPriorityOptions,
  salesRecoveryReasonOptions,
  salesRecoveryResolvedStatusOptions,
  salesRecoveryResolvedStatuses,
} from "@repo/validation";

import { database } from "@/server/database";

import { lossReasonLabels } from "../loss-reason-labels";
import {
  describeSalesRecoveryFall,
  salesRecoveryFallOrderSelect,
} from "./sales-recovery-fall";

import type { Prisma } from "@repo/database";
import type {
  InternalRecoveryDue,
  InternalRecoveryDueFilter,
  InternalRecoveryStage,
  SalesRecoveryOpenStatus,
  SalesRecoveryPriority,
  SalesRecoveryReason,
  SalesRecoveryResolvedStatus,
  SalesRecoveryView,
} from "@repo/validation";

export interface SalesRecoveryAccess {
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

/** Filtros vigentes, ya validados; viajan en la URL (SPEC-041). */
export interface SalesRecoveryInboxFilters {
  view: SalesRecoveryView;
  /** Un dato suelto del cliente o el código de la venta. */
  q: string;
  /** Equipo a cargo: el del responsable o, sin responsable, el de la venta. */
  team: string;
  /** Responsable actual del recupero (no el vendedor original). */
  advisor: string;
  priority: SalesRecoveryPriority | null;
  reason: SalesRecoveryReason | null;
  status: SalesRecoveryOpenStatus | SalesRecoveryResolvedStatus | null;
  /** Solo en abiertos (BR-095); «vencido» abre los tres juntos (PL-02). */
  due: InternalRecoveryDueFilter | null;
}

export interface SalesRecoveryInboxOptions {
  view?: SalesRecoveryView;
  q?: string;
  team?: string;
  advisor?: string;
  priority?: string | null;
  reason?: string | null;
  status?: string | null;
  due?: InternalRecoveryDueFilter | null;
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
  /** Teléfono de entrega de la venta, copiable desde la fila (REC-04). */
  contactPhone: string | null;
  /** Teléfono de entrega y línea, sin repetir, para el editor de gestión. */
  phoneOptions: string[];
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
  /** Etapa de la cadencia (REC-05); `null` en resueltos. */
  stage: InternalRecoveryStage | null;
  isCritical: boolean;
  /** Última gestión registrada, como referencia antes de la siguiente. */
  lastResult: string | null;
  lastObservation: string | null;
  lastAttemptAtLabel: string | null;
  /** Quien mira puede registrar una gestión desde la fila (BR-029b). */
  canManage: boolean;
  /** Solo en resueltos: cuándo y cómo terminó. */
  resolvedAtLabel: string | null;
  resolutionLabel: string | null;
  /** SPEC-068: venta de los últimos 7 días; lo antiguo no hace ruido. */
  hot: boolean;
  /** El plazo y la frase con la regla de «Mi día»; nulo en resueltos. */
  work: {
    action: string;
    due: { label: string; tone: "danger" | "warning" | "neutral" } | null;
  } | null;
  /** Por qué se cayó, como en «Mi día» y la ficha. */
  fallReason: string | null;
  /** «24/09»: el día de la venta. */
  saleDayLabel: string;
  /** Quien la vendió es quien la tiene: no se repite el nombre. */
  sellerIsAssignee: boolean;
}

/** SPEC-068: lo que cada asesor tiene por salvar, para el supervisor. */
export interface SalesRecoveryAdvisorSummary {
  /** `null`: los casos sin responsable. */
  userId: string | null;
  name: string;
  hotNotCalled: number;
  hotTotal: number;
  hotFollowUpOverdue: number;
  coldTotal: number;
}

export interface SalesRecoveryInboxData {
  generatedAt: string;
  role: SalesRecoveryAccess["role"];
  scopeLabel: string;
  canAssign: boolean;
  advisorOptions: Array<{ id: string; name: string; teamName: string }>;
  /** Equipos elegibles como filtro; `null` cuando el rol ya viene acotado. */
  teamOptions: Array<{ id: string; name: string }> | null;
  /** Responsables elegibles como filtro, con su equipo en el nombre. */
  advisorFilterOptions: Array<{ id: string; name: string }>;
  filters: SalesRecoveryInboxFilters;
  /**
   * Sobre toda la cartera abierta del alcance —acotada por búsqueda, equipo y
   * responsable—, no sobre la página visible ni sobre los demás filtros.
   */
  totals: {
    open: number;
    /** Ventas de los últimos 7 días y las anteriores (SPEC-068). */
    hot: number;
    cold: number;
    /** Calientes que nadie ha llamado todavía. */
    hotNotCalled: number;
    /** Calientes con el seguimiento o la cita vencidos. */
    hotFollowUpOverdue: number;
    criticalUnassigned: number;
    recoveredThisMonth: number;
  };
  /** Por asesor, solo para quien reparte; vacío para el asesor. */
  byAdvisor: SalesRecoveryAdvisorSummary[];
  /** En abiertos: las calientes, completas y primero. */
  hotCases: SalesRecoveryCaseItem[];
  /** Paginación de `cases`: en abiertos, las antiguas; si no, los resueltos. */
  pagination: { page: number; totalPages: number; total: number };
  cases: SalesRecoveryCaseItem[];
}

export const salesRecoveryPageSize = 100;

// BR-074: esta bandeja habla solo del carril interno; la base nacional tiene
// su propia superficie.
const internalSources = ["INTERNAL_ORDER_STATE", "MANUAL"] as const;

const caseSelect = {
  id: true,
  status: true,
  priority: true,
  entryReason: true,
  entryObservation: true,
  holderName: true,
  documentNumber: true,
  lastSightingAt: true,
  claimedAt: true,
  firstContactAt: true,
  nextActionAt: true,
  resolvedAt: true,
  lossReason: true,
  originalAgentUserId: true,
  assignedUserId: true,
  assignedUser: { select: { name: true } },
  originalAgent: { select: { name: true } },
  originalTeam: { select: { name: true } },
  sourceDitoOrder: {
    select: {
      orderCodeRaw: true,
      registeredAt: true,
      deliveryContactPhone: true,
      serviceNumber: true,
      ...salesRecoveryFallOrderSelect,
    },
  },
  phones: {
    where: { kind: "CONTACT" as const, invalidMarkedAt: null },
    select: { phoneNumber: true },
  },
  recoveredDitoOrder: { select: { orderCodeRaw: true } },
  attempts: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { result: true, observation: true, createdAt: true },
  },
} satisfies Prisma.RecoveryCaseSelect;

type CaseRow = Prisma.RecoveryCaseGetPayload<{ select: typeof caseSelect }>;

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

/**
 * Búsqueda unificada (BR-088 aplicado al carril interno): las palabras
 * buscan en el nombre del titular y en el código de la venta; los dígitos, en
 * el DNI, el teléfono de entrega, el número de línea y el código de la venta.
 * Quien tiene el dato en la mano no sabe cuál de ellos es.
 */
function buildSalesRecoverySearchWhere(
  term: string,
): Prisma.RecoveryCaseWhereInput | null {
  const search = parseRecoverySearchTerm(term);

  if (!search) return null;

  return allOf<Prisma.RecoveryCaseWhereInput>(
    ...search.words.map((word) => ({
      OR: [
        { holderName: { contains: word, mode: "insensitive" as const } },
        {
          sourceDitoOrder: {
            orderCodeRaw: { contains: word, mode: "insensitive" as const },
          },
        },
      ],
    })),
    search.digits
      ? {
          OR: [
            { documentNumber: { contains: search.digits } },
            {
              sourceDitoOrder: {
                OR: [
                  { deliveryContactPhone: { contains: search.digits } },
                  { serviceNumber: { contains: search.digits } },
                  { orderCodeRaw: { contains: search.digits } },
                ],
              },
            },
            { phones: { some: { phoneNumber: { contains: search.digits } } } },
          ],
        }
      : null,
  );
}

function mapCase(
  row: CaseRow,
  priority: string | null,
  stage: InternalRecoveryStage | null,
  access: SalesRecoveryAccess,
  now: Date,
): SalesRecoveryCaseItem {
  const status = String(row.status);
  const lastAttempt = row.attempts[0] ?? null;
  const isResolved = stage === null;
  const saleAt = row.sourceDitoOrder?.registeredAt ?? row.lastSightingAt;
  const phoneOptions = [
    ...new Set(
      [
        ...row.phones.map((phone) => phone.phoneNumber),
        row.sourceDitoOrder?.deliveryContactPhone ?? null,
        row.sourceDitoOrder?.serviceNumber ?? null,
      ].filter((phone): phone is string => Boolean(phone)),
    ),
  ];
  const contactPhone = phoneOptions[0] ?? null;
  // SPEC-068: la misma regla que «Mi día» y la ficha; si hoy no toca, la
  // etapa dice en qué está y cuándo vuelve.
  const todayWork = isResolved
    ? null
    : describeSalesRecoveryWork(
        {
          status,
          saleAt,
          firstContactAt: row.firstContactAt,
          nextActionAt: row.nextActionAt,
          noveltyAt: row.lastSightingAt,
        },
        now,
      );

  return {
    id: row.id,
    originalAgentUserId: row.originalAgentUserId,
    orderCode: row.sourceDitoOrder?.orderCodeRaw ?? null,
    orderRegisteredDay: row.sourceDitoOrder
      ? getLimaIsoDate(row.sourceDitoOrder.registeredAt)
      : null,
    holderName: row.holderName,
    documentNumber: row.documentNumber,
    contactPhone,
    phoneOptions,
    status,
    priority,
    entryReason: row.entryReason ? String(row.entryReason) : null,
    entryObservation: row.entryObservation,
    assignedToName: row.assignedUser?.name ?? null,
    originalAgentName: row.originalAgent?.name ?? null,
    originalTeamName: row.originalTeam?.name ?? null,
    noveltyAtLabel: formatCampaignMoment(row.lastSightingAt),
    nextActionAtLabel: row.nextActionAt
      ? formatCampaignMoment(row.nextActionAt)
      : null,
    due: stage?.due ?? null,
    stage,
    isCritical: priority === "CRITICA",
    lastResult: lastAttempt ? String(lastAttempt.result) : null,
    lastObservation: lastAttempt?.observation ?? null,
    lastAttemptAtLabel: lastAttempt
      ? formatCampaignMoment(lastAttempt.createdAt)
      : null,
    // BR-029b: el asesor solo gestiona lo suyo; la supervisión, su alcance.
    canManage:
      !isResolved &&
      (access.role !== "AGENT" || row.assignedUserId === access.userId),
    resolvedAtLabel: row.resolvedAt ? formatCampaignMoment(row.resolvedAt) : null,
    resolutionLabel:
      status === "RECOVERED"
        ? `Recuperada${row.recoveredDitoOrder ? ` con ${row.recoveredDitoOrder.orderCodeRaw}` : ""}`
        : status === "LOST"
          ? `Perdida${row.lossReason ? ` · ${lossReasonLabels[String(row.lossReason)] ?? String(row.lossReason)}` : ""}`
          : null,
    hot: isMyDayHotSale(saleAt, now),
    work: isResolved
      ? null
      : todayWork
        ? { action: todayWork.action, due: todayWork.due }
        : {
            action: stage?.label ?? "Sin acción pendiente",
            due: row.nextActionAt
              ? {
                  label: describeMyDayDue(row.nextActionAt, now),
                  tone: "neutral",
                }
              : null,
          },
    fallReason: describeSalesRecoveryFall(row),
    saleDayLabel: formatMyDaySaleDay(saleAt),
    sellerIsAssignee:
      row.originalAgentUserId !== null &&
      row.originalAgentUserId === row.assignedUserId,
  };
}

export async function getSalesRecoveryInbox(
  organizationId: string,
  access: SalesRecoveryAccess,
  options: SalesRecoveryInboxOptions = {},
): Promise<SalesRecoveryInboxData> {
  const now = new Date();
  const view = options.view ?? "abiertos";
  const search = (options.q ?? "").trim().slice(0, 80);
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
  // El supervisor ya viene acotado a sus equipos; el asesor, a sus casos.
  const canFilterTeam = access.role === "ADMIN" || access.role === "BACKOFFICE";
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

  const [advisorMemberships, teams] = await Promise.all([
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
    canFilterTeam
      ? database.commercialTeam.findMany({
          where: { organizationId, status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const advisorOptions = advisorMemberships
    .map((item) => ({
      id: item.userId,
      name: item.user.name,
      teamName: item.team.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  // La URL solo estrecha: un equipo o responsable fuera del alcance se ignora.
  const teamFilter =
    teams?.some((team) => team.id === options.team) && options.team
      ? options.team
      : "";
  const advisorFilter =
    advisorOptions.some((advisor) => advisor.id === options.advisor) &&
    options.advisor
      ? options.advisor
      : "";
  const filters: SalesRecoveryInboxFilters = {
    view,
    q: search,
    team: teamFilter,
    advisor: advisorFilter,
    priority: pickFilterOption(options.priority, salesRecoveryPriorityOptions),
    reason: pickFilterOption(options.reason, salesRecoveryReasonOptions),
    status:
      view === "abiertos"
        ? pickFilterOption(options.status, salesRecoveryOpenStatusOptions)
        : pickFilterOption(options.status, salesRecoveryResolvedStatusOptions),
    due: view === "abiertos" ? (options.due ?? null) : null,
  };

  const scopeWhere = allOf<Prisma.RecoveryCaseWhereInput>(
    baseWhere,
    teamFilter
      ? {
          OR: [
            { assignedTeamId: teamFilter },
            { assignedTeamId: null, originalTeamId: teamFilter },
          ],
        }
      : null,
    advisorFilter ? { assignedUserId: advisorFilter } : null,
    buildSalesRecoverySearchWhere(search),
  );

  const [openCases, recoveredThisMonth] = await Promise.all([
    // BR-095: toda la cartera abierta del alcance, ordenada aquí con la regla
    // de negocio antes de paginar. También alimenta los indicadores.
    database.recoveryCase.findMany({
      where: allOf<Prisma.RecoveryCaseWhereInput>(scopeWhere, {
        status: { in: [...salesRecoveryOpenStatuses] },
      }),
      select: caseSelect,
    }),
    database.recoveryCase.count({
      where: {
        ...baseWhere,
        status: "RECOVERED",
        resolvedAt: { gte: monthStart },
      },
    }),
  ]);

  const ranked = openCases
    .map((row) => {
      const stage = describeInternalRecoveryStage(
        {
          status: String(row.status),
          firstContactAt: row.firstContactAt,
          nextActionAt: row.nextActionAt,
          noveltyAt: row.lastSightingAt,
          claimedAt: row.claimedAt,
          lastResult: row.attempts[0] ? String(row.attempts[0].result) : null,
        },
        now,
      );

      return {
        row,
        priority: row.priority ? String(row.priority) : null,
        stage,
        due: classifyInternalRecoveryDue(
          {
            status: String(row.status),
            firstContactAt: row.firstContactAt,
            nextActionAt: row.nextActionAt,
            noveltyAt: row.lastSightingAt,
          },
          now,
        ),
        nextActionAt: row.nextActionAt,
        noveltyAt: row.lastSightingAt,
        hot: isMyDayHotSale(
          row.sourceDitoOrder?.registeredAt ?? row.lastSightingAt,
          now,
        ),
      };
    })
    .sort(compareInternalRecoveryCases);

  const requestedPage = Number.isFinite(options.page ?? 1)
    ? Math.max(1, Math.trunc(options.page ?? 1))
    : 1;

  let pagination: SalesRecoveryInboxData["pagination"];
  let items: SalesRecoveryCaseItem[];
  let hotItems: SalesRecoveryCaseItem[] = [];

  if (view === "abiertos") {
    const selected = ranked.filter(
      (item) =>
        (!filters.priority || item.priority === filters.priority) &&
        (!filters.reason || item.row.entryReason === filters.reason) &&
        (!filters.status || String(item.row.status) === filters.status) &&
        matchesInternalRecoveryDueFilter(item.due, filters.due),
    );
    // SPEC-068: las calientes completas y primero; las antiguas, paginadas
    // y plegadas, como en «Mi día».
    hotItems = selected
      .filter((item) => item.hot)
      .map((item) => mapCase(item.row, item.priority, item.stage, access, now));
    const cold = selected.filter((item) => !item.hot);
    const totalPages = Math.max(
      1,
      Math.ceil(cold.length / salesRecoveryPageSize),
    );
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * salesRecoveryPageSize;

    pagination = { page, totalPages, total: cold.length };
    items = cold
      .slice(start, start + salesRecoveryPageSize)
      .map((item) => mapCase(item.row, item.priority, item.stage, access, now));
  } else {
    // Resueltos: lo más reciente primero. Aquí sí pagina la base, porque el
    // histórico crece sin tope y no hay nada que ordenar en memoria.
    const resolvedWhere = allOf<Prisma.RecoveryCaseWhereInput>(
      scopeWhere,
      {
        status: {
          in: filters.status
            ? [filters.status as SalesRecoveryResolvedStatus]
            : [...salesRecoveryResolvedStatuses],
        },
      },
      filters.priority ? { priority: filters.priority } : null,
      filters.reason ? { entryReason: filters.reason } : null,
    );
    const total = await database.recoveryCase.count({ where: resolvedWhere });
    const totalPages = Math.max(1, Math.ceil(total / salesRecoveryPageSize));
    const page = Math.min(requestedPage, totalPages);
    const rows = await database.recoveryCase.findMany({
      where: resolvedWhere,
      orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * salesRecoveryPageSize,
      take: salesRecoveryPageSize,
      select: caseSelect,
    });

    pagination = { page, totalPages, total };
    items = rows.map((row) =>
      mapCase(row, row.priority ? String(row.priority) : null, null, access, now),
    );
  }

  const neverCalled = (item: (typeof ranked)[number]) =>
    item.row.firstContactAt === null &&
    String(item.row.status) !== "WAITING" &&
    String(item.row.status) !== "SCHEDULED";
  const followUpOverdue = (item: (typeof ranked)[number]) =>
    item.due === "seguimiento" || item.due === "agenda";

  // SPEC-068: por asesor, para quien reparte. Primero quien más calientes
  // tiene sin llamar.
  const advisorGroups = new Map<string, SalesRecoveryAdvisorSummary>();
  if (canAssign) {
    for (const item of ranked) {
      const key = item.row.assignedUserId ?? "";
      const group = advisorGroups.get(key) ?? {
        userId: item.row.assignedUserId,
        name: item.row.assignedUser?.name ?? "Sin responsable",
        hotNotCalled: 0,
        hotTotal: 0,
        hotFollowUpOverdue: 0,
        coldTotal: 0,
      };
      if (item.hot) {
        group.hotTotal += 1;
        if (neverCalled(item)) group.hotNotCalled += 1;
        if (followUpOverdue(item)) group.hotFollowUpOverdue += 1;
      } else {
        group.coldTotal += 1;
      }
      advisorGroups.set(key, group);
    }
  }
  const byAdvisor = [...advisorGroups.values()].sort(
    (left, right) =>
      right.hotNotCalled - left.hotNotCalled ||
      right.hotTotal - left.hotTotal ||
      left.name.localeCompare(right.name, "es"),
  );

  return {
    generatedAt: formatCampaignMoment(now),
    role: access.role,
    scopeLabel:
      access.role === "AGENT"
        ? "Mis casos"
        : access.role === "SUPERVISOR"
          ? "Mis equipos"
          : "Organización",
    canAssign,
    advisorOptions,
    teamOptions: teams,
    advisorFilterOptions: advisorOptions.map((advisor) => ({
      id: advisor.id,
      name: `${advisor.name} · ${advisor.teamName}`,
    })),
    filters,
    totals: {
      open: ranked.length,
      hot: ranked.filter((item) => item.hot).length,
      cold: ranked.filter((item) => !item.hot).length,
      hotNotCalled: ranked.filter((item) => item.hot && neverCalled(item))
        .length,
      hotFollowUpOverdue: ranked.filter(
        (item) => item.hot && followUpOverdue(item),
      ).length,
      criticalUnassigned: ranked.filter(
        (item) => item.priority === "CRITICA" && item.row.assignedUser === null,
      ).length,
      recoveredThisMonth,
    },
    byAdvisor,
    hotCases: hotItems,
    pagination,
    cases: items,
  };
}
