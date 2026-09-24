import "server-only";

import {
  calculatePerformanceMetrics,
  classifyInternalRecoveryDue,
  classifyRecoveryWorkItem,
  compareMyDayItems,
  compareRecoveryWorkNow,
  describeInternalRecoveryStage,
  describeMyDayDue,
  effectiveAttemptResult,
  getDefaultQuotaTarget,
  getInternalRecoveryFirstActionAt,
  getLimaDayOfMonth,
  getLimaIsoDate,
  getOrderPeriodRange,
  getPerformanceCommissionPolicy,
  getPerformanceMonthRange,
  parsePerformanceMonth,
  placeMyDayCommitment,
  placeMyDaySalesRecovery,
  recoveryAgendaKindLabels,
  recoveryAgendaOriginLabels,
  resolveCurrentAcceleratorWindow,
  resolveRelevantAcceleratorWindow,
  salesRecoveryOpenStatuses,
  selectRecoveryAgendaItem,
  type MyDayBucket,
  type MyDayTier,
  type PerformanceCommissionPolicy,
  type RecoveryWorkNowCandidate,
} from "@repo/validation";
import { formatLimaMonth } from "@repo/ui/format";

import { getAgrAction } from "@/features/orders/server/get-order-inbox";
import { buildOrderHref } from "@/features/recovery/order-link";
import { database } from "@/server/database";
import { toMetricInput } from "@/features/performance/server/order-metric-input";

/**
 * «Mi día» — SPEC-063. Reúne el trabajo propio del usuario desde las fuentes
 * que ya existen y lo ordena con `compareMyDayItems`. Ninguna regla de
 * vencimiento vive aquí (BR-002): cada fuente pasa por la regla de su módulo.
 * Solo lo propio (BR-003): casos asignados al usuario y sus ventas.
 */

/** BR-016: techo por fuente. Un asesor real tiene decenas, no cientos. */
const commitmentLimit = 100;
const salesRecoveryLimit = 100;
const campaignLimit = 500;
const orderLimit = 50;
/** BR-005: la campaña muestra sus primeros casos y el total. */
const campaignShown = 5;
/** Pedidos de los últimos 60 días: lo anterior ya no espera al asesor. */
const orderLookbackMs = 60 * 24 * 60 * 60 * 1000;
/** La misma espera que Pedidos antes de llamar incidencia a «sin estado». */
const noStatusGraceMs = 10 * 60 * 1000;

const caseOpenStatuses = ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"] as const;
const internalSources = ["INTERNAL_ORDER_STATE", "MANUAL"] as const;

export type MyDayEntryKind = "cita" | "venta_caida" | "pedido" | "campana";

export const myDayKindLabels: Record<MyDayEntryKind, string> = {
  cita: "Cita acordada",
  venta_caida: "Venta caída",
  pedido: "Pedido",
  campana: "Campaña",
};

export interface MyDayEntry {
  key: string;
  kind: MyDayEntryKind;
  tier: MyDayTier;
  bucket: MyDayBucket;
  dueAt: Date | null;
  /** «venció hace 25 min», «en 40 min», «a las 15:00». */
  dueLabel: string | null;
  overdue: boolean;
  rank: number;
  /** El cliente. */
  title: string;
  /** Qué hacer, en una frase (BR-007). */
  action: string;
  detail: string | null;
  href: string;
  actionLabel: string;
}

export interface MyDayProgress {
  monthLabel: string;
  enteredToday: number;
  attemptsToday: number;
  entered: number;
  delivered: number;
  payable: number;
  deliveredPendingActivation: number;
  baseCommissionCents: number;
  bonusCents: number;
  estimatedCommissionCents: number;
  /** La ventana de bono de la que hablar hoy, si hay una. */
  window: {
    label: string;
    confirmed: number;
    delivered: number;
    nextTarget: number | null;
    missingForNextTarget: number;
    nextTargetAmountCents: number;
    quotaTarget: number;
    quotaAssigned: boolean;
    /**
     * Del 16 al 24 no hay ventana abierta y se habla de la última que cerró
     * (SPEC-038 BR-015): ya no suma ventas nuevas, solo confirmaciones de
     * las que ingresaron en ella.
     */
    closed: boolean;
    /** La siguiente ventana del mes, si falta abrir alguna. */
    upcoming: { label: string; startDay: number } | null;
  } | null;
  policy: PerformanceCommissionPolicy;
}

export interface MyDayData {
  generatedAt: Date;
  now: MyDayEntry[];
  later: MyDayEntry[];
  campaign: { total: number; shown: number };
  progress: MyDayProgress;
}

function limaTodayEnd(now: Date): Date {
  const today = getOrderPeriodRange("TODAY", now);
  if (!today.end) throw new Error("No se pudo resolver el día de hoy en Lima.");
  return today.end;
}

function caseHref(caseId: string, source: string): string {
  return source === "NATIONAL_BASE"
    ? `/recovery/campaigns/${caseId}`
    : `/recovery/sales/${caseId}`;
}

async function readCommitments(
  organizationId: string,
  userId: string,
  now: Date,
): Promise<MyDayEntry[]> {
  const rows = await database.recoveryCaseCommitment.findMany({
    where: {
      organizationId,
      status: "PENDING",
      scheduledAt: { lt: limaTodayEnd(now) },
      case: { assignedUserId: userId, status: { in: [...caseOpenStatuses] } },
    },
    orderBy: { scheduledAt: "asc" },
    take: commitmentLimit,
    select: {
      id: true,
      scheduledAt: true,
      case: { select: { id: true, source: true, holderName: true } },
    },
  });

  return rows.flatMap((row, index) => {
    const placement = placeMyDayCommitment(row.scheduledAt, now);
    if (!placement) return [];

    return [
      {
        key: `cita:${row.id}`,
        kind: "cita" as const,
        ...placement,
        dueLabel: describeMyDayDue(row.scheduledAt, now),
        overdue: placement.tier === "cita_vencida",
        rank: index,
        title: row.case.holderName,
        action: "Llamar: es la hora que acordaste con el cliente",
        detail:
          row.case.source === "NATIONAL_BASE" ? "Campaña" : "Recupero de ventas",
        href: caseHref(row.case.id, String(row.case.source)),
        actionLabel: "Abrir caso",
      },
    ];
  });
}

async function readSalesRecovery(
  organizationId: string,
  userId: string,
  now: Date,
): Promise<MyDayEntry[]> {
  const rows = await database.recoveryCase.findMany({
    where: {
      organizationId,
      source: { in: [...internalSources] },
      assignedUserId: userId,
      status: { in: [...salesRecoveryOpenStatuses] },
      // BR-001: con cita, el caso aparece como cita.
      commitments: { none: { status: "PENDING" } },
    },
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "first" } }],
    take: salesRecoveryLimit,
    select: {
      id: true,
      holderName: true,
      status: true,
      firstContactAt: true,
      nextActionAt: true,
      lastSightingAt: true,
      claimedAt: true,
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          result: true,
          correction: { select: { effectiveResult: true } },
        },
      },
    },
  });

  return rows.flatMap((row, index) => {
    const status = String(row.status);
    const input = {
      status,
      firstContactAt: row.firstContactAt,
      nextActionAt: row.nextActionAt,
      noveltyAt: row.lastSightingAt,
    };
    const due = classifyInternalRecoveryDue(input, now);
    const placement = placeMyDaySalesRecovery(
      {
        status,
        firstContactAt: row.firstContactAt,
        nextActionAt: row.nextActionAt,
        firstActionAt: getInternalRecoveryFirstActionAt(row.lastSightingAt),
        due,
      },
      now,
    );
    if (!placement) return [];

    const last = row.attempts[0];
    const stage = describeInternalRecoveryStage(
      {
        ...input,
        claimedAt: row.claimedAt,
        lastResult: last ? effectiveAttemptResult(last) : null,
      },
      now,
    );

    return [
      {
        key: `venta:${row.id}`,
        kind: "venta_caida" as const,
        ...placement,
        dueLabel: placement.dueAt ? describeMyDayDue(placement.dueAt, now) : null,
        overdue: due !== null,
        rank: index,
        title: row.holderName,
        action: stage.label,
        detail: stage.detail,
        href: `/recovery/sales/${row.id}`,
        actionLabel: "Abrir caso",
      },
    ];
  });
}

async function readCampaign(
  organizationId: string,
  userId: string,
  now: Date,
): Promise<{ entries: MyDayEntry[]; total: number }> {
  const rows = await database.recoveryCase.findMany({
    where: {
      organizationId,
      source: "NATIONAL_BASE",
      assignedUserId: userId,
      status: { in: [...caseOpenStatuses] },
      commitments: { none: { status: "PENDING" } },
    },
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }],
    take: campaignLimit,
    select: {
      id: true,
      holderName: true,
      status: true,
      nextActionAt: true,
      portabilityEligibleAt: true,
      lastSightingAt: true,
      phones: {
        where: { kind: "CONTACT", invalidMarkedAt: null },
        select: { id: true },
      },
      services: { where: { discardedAt: null }, select: { id: true } },
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          result: true,
          followUpAt: true,
          correction: { select: { effectiveResult: true } },
        },
      },
      events: {
        where: { type: "CASE_REOPENED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  // La misma clasificación que la cola de Campañas (SPEC-049): solo la vista
  // «Ahora», en su orden.
  const ahora = rows.flatMap((row) => {
    const last = row.attempts[0] ?? null;
    const item = selectRecoveryAgendaItem(
      {
        status: String(row.status),
        nextActionAt: row.nextActionAt,
        portabilityEligibleAt: row.portabilityEligibleAt,
        lastResult: last ? effectiveAttemptResult(last) : null,
        lastAttemptAt: last?.createdAt ?? null,
        pendingCommitmentAt: null,
        returnedFromVerificationAt: row.events[0]?.createdAt ?? null,
        validPhoneCount: row.phones.length + row.services.length,
        lastFollowUpAt: last?.followUpAt ?? null,
      },
      now,
    );
    if (!item || classifyRecoveryWorkItem(item, now) !== "ahora") return [];

    const candidate: RecoveryWorkNowCandidate & { row: typeof row } = {
      item,
      lastSightingAt: row.lastSightingAt,
      row,
    };
    return [candidate];
  });
  ahora.sort(compareRecoveryWorkNow);

  const entries = ahora.slice(0, campaignShown).map(({ item, row }, index) => ({
    key: `campana:${row.id}`,
    kind: "campana" as const,
    tier: "campana" as const,
    bucket: "ahora" as const,
    dueAt: null,
    dueLabel: item.at && item.overdue ? describeMyDayDue(item.at, now) : null,
    overdue: item.overdue,
    rank: index,
    title: row.holderName,
    action: recoveryAgendaKindLabels[item.kind],
    detail: recoveryAgendaOriginLabels[item.origin],
    href: `/recovery/campaigns/${row.id}`,
    actionLabel: "Abrir caso",
  }));

  return { entries, total: ahora.length };
}

async function readOrders(
  organizationId: string,
  userId: string,
  now: Date,
): Promise<MyDayEntry[]> {
  const noStatusThreshold = new Date(now.getTime() - noStatusGraceMs);
  const rows = await database.ditoOrder.findMany({
    where: {
      organizationId,
      agentUserId: userId,
      registeredAt: { gte: new Date(now.getTime() - orderLookbackMs) },
      status: { notIn: ["CLOSED", "CANCELLED"] },
      // BR-004: las pestañas «Entregas fallidas por gestionar» e «Incidencias»
      // de Pedidos, con su misma definición.
      OR: [
        {
          deliveryStatus: { not: "DELIVERED" },
          agrDeliverySnapshot: { is: { isRecoveryOpportunity: true } },
        },
        { sentSubstatus: "REJECTED" },
        {
          status: "SENT",
          sentSubstatus: "NO_STATUS",
          noStatusDetectedAt: { lte: noStatusThreshold },
        },
        {
          deliveryDueAt: { lt: now },
          deliveryStatus: { notIn: ["DELIVERED", "CANCELLED"] },
        },
      ],
    },
    orderBy: { registeredAt: "desc" },
    take: orderLimit,
    select: {
      id: true,
      orderCodeRaw: true,
      holderFullNameRaw: true,
      registeredAt: true,
      sentSubstatus: true,
      sentSubstatusUpdatedAt: true,
      noStatusDetectedAt: true,
      deliveryDueAt: true,
      agrDeliverySnapshot: {
        select: {
          estadoPedido: true,
          motivoRechazo: true,
          submotivoRechazo: true,
          isRecoveryOpportunity: true,
        },
      },
    },
  });

  return rows.map((row, index) => {
    const snapshot = row.agrDeliverySnapshot;
    let action: string;
    let dueAt: Date | null = null;

    if (snapshot?.isRecoveryOpportunity) {
      action = getAgrAction(snapshot).label;
    } else if (row.sentSubstatus === "REJECTED") {
      action = "Entrega rechazada: habla con el cliente";
      dueAt = row.sentSubstatusUpdatedAt;
    } else if (row.sentSubstatus === "NO_STATUS") {
      action = "El courier no informa el estado de la entrega";
      dueAt = row.noStatusDetectedAt;
    } else {
      action = "Pasó el plazo de entrega sin que llegue";
      dueAt = row.deliveryDueAt;
    }

    return {
      key: `pedido:${row.id}`,
      kind: "pedido" as const,
      tier: "pedido" as const,
      bucket: "ahora" as const,
      dueAt,
      dueLabel: dueAt ? describeMyDayDue(dueAt, now) : null,
      overdue: true,
      rank: index,
      title: row.holderFullNameRaw,
      action,
      detail: `Pedido ${row.orderCodeRaw}`,
      href: buildOrderHref(row.orderCodeRaw, getLimaIsoDate(row.registeredAt)),
      actionLabel: "Ver pedido",
    };
  });
}

/**
 * BR-009 a BR-011: el progreso del mes con las mismas funciones y la misma
 * población que `/performance` en vista propia (cohorte por fecha de
 * ingreso), para que las cifras coincidan.
 */
async function readProgress(
  organizationId: string,
  userId: string,
  now: Date,
): Promise<MyDayProgress> {
  const month = getPerformanceMonthRange(parsePerformanceMonth(undefined, now));
  const today = getOrderPeriodRange("TODAY", now);
  const relevantWindow = resolveRelevantAcceleratorWindow(now);
  const windowClosed = resolveCurrentAcceleratorWindow(now) === null;
  const dayOfMonth = getLimaDayOfMonth(now);

  const [orders, attemptsToday, quota] = await Promise.all([
    database.ditoOrder.findMany({
      where: {
        organizationId,
        agentUserId: userId,
        registeredAt: { gte: month.start, lt: month.end },
      },
      select: {
        commercialOperation: true,
        status: true,
        deliveryStatus: true,
        sentSubstatus: true,
        registeredAt: true,
        deliveredAt: true,
        closedAt: true,
        agentUserId: true,
        assignedTeamId: true,
      },
    }),
    database.recoveryCaseAttempt.count({
      where: {
        organizationId,
        actorUserId: userId,
        createdAt: { gte: today.start ?? month.start },
      },
    }),
    relevantWindow
      ? database.performanceQuota.findFirst({
          where: {
            organizationId,
            periodKey: month.key,
            window: relevantWindow.key,
            userId,
          },
          select: { target: true },
        })
      : Promise.resolve(null),
  ]);

  const metrics = calculatePerformanceMetrics(orders.map(toMetricInput));
  const window = relevantWindow
    ? metrics.accelerators.find((item) => item.key === relevantWindow.key)
    : undefined;
  const todayStart = today.start?.getTime() ?? Number.POSITIVE_INFINITY;

  return {
    monthLabel: formatLimaMonth(month.start),
    enteredToday: orders.filter(
      (order) => order.registeredAt.getTime() >= todayStart,
    ).length,
    attemptsToday,
    entered: metrics.entered,
    delivered: metrics.delivered,
    payable: metrics.payable,
    deliveredPendingActivation: metrics.deliveredPendingActivation,
    baseCommissionCents: metrics.baseCommissionCents,
    bonusCents: metrics.acceleratorTotalCents,
    estimatedCommissionCents: metrics.estimatedCommissionCents,
    window:
      window && relevantWindow
        ? {
            label: window.label,
            confirmed: window.confirmed,
            delivered: window.delivered,
            nextTarget: window.nextTarget,
            missingForNextTarget: window.missingForNextTarget,
            nextTargetAmountCents: window.nextTargetAmountCents,
            quotaTarget: quota?.target ?? getDefaultQuotaTarget(relevantWindow.key),
            quotaAssigned: quota !== null,
            closed: windowClosed,
            upcoming:
              getPerformanceCommissionPolicy(month.key)
                .acceleratorWindows.filter(
                  (item) => item.windowStartDay > dayOfMonth,
                )
                .map((item) => ({
                  label: item.label,
                  startDay: item.windowStartDay,
                }))[0] ?? null,
          }
        : null,
    policy: getPerformanceCommissionPolicy(month.key),
  };
}

export async function getMyDay(
  organizationId: string,
  userId: string,
  now = new Date(),
): Promise<MyDayData> {
  const [commitments, salesRecovery, campaign, orders, progress] =
    await Promise.all([
      readCommitments(organizationId, userId, now),
      readSalesRecovery(organizationId, userId, now),
      readCampaign(organizationId, userId, now),
      readOrders(organizationId, userId, now),
      readProgress(organizationId, userId, now),
    ]);

  const all = [...commitments, ...salesRecovery, ...orders, ...campaign.entries];
  const sorted = [...all].sort(compareMyDayItems);

  return {
    generatedAt: now,
    now: sorted.filter((entry) => entry.bucket === "ahora"),
    later: sorted
      .filter((entry) => entry.bucket === "hoy")
      .sort(
        (left, right) =>
          (left.dueAt?.getTime() ?? 0) - (right.dueAt?.getTime() ?? 0),
      ),
    campaign: { total: campaign.total, shown: campaign.entries.length },
    progress,
  };
}
