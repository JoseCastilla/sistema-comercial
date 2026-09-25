import "server-only";

import {
  calculatePerformanceMetrics,
  classifyInternalRecoveryDue,
  classifyMyDaySale,
  classifyRecoveryWorkItem,
  compareMyDayItems,
  compareRecoveryWorkNow,
  describeMyDayDue,
  describeMyDaySince,
  formatMyDayTime,
  effectiveAttemptResult,
  formatMyDaySaleDay,
  myDayNoCommissionReasons,
  getDefaultMonthlyQuotaTarget,
  getInternalRecoveryFirstActionAt,
  getLimaDayOfMonth,
  getLimaIsoDate,
  getOrderPeriodRange,
  getPerformanceCommissionPolicy,
  getPerformanceMonthRange,
  monthlyQuotaWindow,
  parsePerformanceMonth,
  placeMyDayCommitment,
  placeMyDayOrder,
  placeMyDaySalesRecovery,
  resolveCurrentAcceleratorWindow,
  resolveRelevantAcceleratorWindow,
  salesRecoveryOpenStatuses,
  salesRecoveryReasonOptions,
  selectRecoveryAgendaItem,
  summarizeMyDaySales,
  type MyDaySaleBucket,
  type MyDaySaleBucketSummary,
  type PerformanceCommissionPolicy,
  type RecoveryAgendaItemKind,
  type RecoveryAgendaOrigin,
  type RecoveryWorkNowCandidate,
} from "@repo/validation";
import { formatLimaMonth } from "@repo/ui/format";

import { getAgrAction } from "@/features/orders/server/get-order-inbox";
import { buildOrderHref } from "@/features/recovery/order-link";
import { database } from "@/server/database";
import { toMetricInput } from "@/features/performance/server/order-metric-input";

import type { MyDayEntry, MyDayManage } from "../my-day-types";

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

const caseOpenStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;
const internalSources = ["INTERNAL_ORDER_STATE", "MANUAL"] as const;

export type { MyDayEntry } from "../my-day-types";

interface LastAttemptRow {
  result: string;
  observation: string | null;
  correction: { effectiveResult: string } | null;
}

/**
 * Fase 2: lo que el editor de gestión necesita para registrar el intento
 * desde la fila. Los mismos teléfonos que ofrecen la cola de Campañas y la
 * bandeja de Recupero: contacto primero, luego las líneas, sin repetir.
 */
function buildManage(input: {
  caseId: string;
  contactPhones: string[];
  serviceNumbers: string[];
  orderPhone?: string | null;
  orderLine?: string | null;
  last: LastAttemptRow | null;
}): MyDayManage {
  const phoneOptions = [
    ...new Set(
      [
        ...input.contactPhones,
        input.orderPhone ?? null,
        ...input.serviceNumbers,
        input.orderLine ?? null,
      ].filter((phone): phone is string => Boolean(phone)),
    ),
  ];

  return {
    caseId: input.caseId,
    phoneOptions,
    defaultPhone: phoneOptions[0] ?? null,
    serviceNumbers: input.serviceNumbers,
    lastResult: input.last ? effectiveAttemptResult(input.last) : null,
    lastObservation: input.last?.observation ?? null,
  };
}

const lastAttemptSelect = {
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: {
    result: true,
    observation: true,
    correction: { select: { effectiveResult: true } },
  },
};

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
    /**
     * Del 16 al 24 no hay ventana abierta y se habla de la última que cerró
     * (SPEC-038 BR-015): ya no suma ventas nuevas, solo confirmaciones de
     * las que ingresaron en ella.
     */
    closed: boolean;
    /** La siguiente ventana del mes, si falta abrir alguna. */
    upcoming: {
      label: string;
      startDay: number;
      /** Primer tramo del bono que viene: cuántas y cuánto vale. */
      target: number;
      amountCents: number;
    } | null;
  } | null;
  /**
   * La cuota es del mes completo (SPEC-064) y se mide en portabilidades
   * entregadas de las ventas del mes. Sin cuota asignada, la mensual por
   * defecto (`assigned: false`).
   */
  quota: { target: number; assigned: boolean; delivered: number };
  policy: PerformanceCommissionPolicy;
}

/** Una venta del mes con lo que vale para la comisión (fase 4, BR-020). */
export interface MyDaySale {
  id: string;
  holderName: string;
  orderCode: string;
  saleDayLabel: string;
  amountCents: number;
  /** El monto todavía no está ganado. */
  potential: boolean;
  /** Solo en «No pagan comisión»: por qué. */
  reasonText: string | null;
  href: string;
}

export interface MyDaySales {
  total: number;
  summary: MyDaySaleBucketSummary[];
  byBucket: Partial<Record<MyDaySaleBucket, MyDaySale[]>>;
}

export interface MyDayData {
  generatedAt: Date;
  now: MyDayEntry[];
  later: MyDayEntry[];
  /** BR-018: ventas de hace más de 7 días; oportunidad sin urgencia. */
  cold: MyDayEntry[];
  campaign: { total: number; shown: number };
  progress: MyDayProgress;
  sales: MyDaySales;
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
      case: {
        select: {
          id: true,
          source: true,
          holderName: true,
          phones: {
            where: { kind: "CONTACT", invalidMarkedAt: null },
            select: { phoneNumber: true },
          },
          services: {
            where: { discardedAt: null },
            select: { serviceNumber: true },
          },
          sourceDitoOrder: {
            select: { deliveryContactPhone: true, serviceNumber: true },
          },
          attempts: lastAttemptSelect,
        },
      },
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
        saleAt: null,
        dueLabel: describeMyDayDue(row.scheduledAt, now),
        overdue: placement.tier === "cita_vencida",
        tone:
          placement.tier === "cita_vencida"
            ? ("danger" as const)
            : placement.bucket === "ahora"
              ? ("warning" as const)
              : ("neutral" as const),
        phone: null,
        rank: index,
        title: row.case.holderName,
        action: `Llamar: lo acordaste para las ${formatMyDayTime(row.scheduledAt)}`,
        detail:
          row.case.source === "NATIONAL_BASE"
            ? "Cita de campaña"
            : "Cita por una venta caída",
        href: caseHref(row.case.id, String(row.case.source)),
        actionLabel: "Abrir caso",
        manage: buildManage({
          caseId: row.case.id,
          contactPhones: row.case.phones.map((phone) => phone.phoneNumber),
          serviceNumbers: row.case.services.map((item) => item.serviceNumber),
          orderPhone: row.case.sourceDitoOrder?.deliveryContactPhone,
          orderLine: row.case.sourceDitoOrder?.serviceNumber,
          last: row.case.attempts[0]
            ? {
                ...row.case.attempts[0],
                result: String(row.case.attempts[0].result),
              }
            : null,
        }),
      },
    ];
  });
}

/**
 * Qué hacer con una venta caída, en una frase (fase 6): el plazo ya lo dice
 * la etiqueta, así que la frase no lo repite con otras palabras.
 */
function salesRecoveryAction(input: {
  cold: boolean;
  neverCalled: boolean;
  overdue: boolean;
  dueAt: Date | null;
}): string {
  if (input.cold)
    return input.neverCalled ? "Sin llamar" : "Seguimiento pendiente";
  if (input.neverCalled) {
    return input.overdue || !input.dueAt
      ? "Llamar ya"
      : `Llamar antes de las ${formatMyDayTime(input.dueAt)}`;
  }
  return "Volver a llamar";
}

/** La tarea de campaña como acción del asesor, sin jerga del motor. */
const campaignActions: Record<RecoveryAgendaItemKind, string> = {
  VERIFICACION: "En verificación",
  CITA_ACORDADA: "Llamar: cita acordada",
  COMPLETAR_VENTA: "Completar la venta",
  CERRAR: "Cerrar como rechazo definitivo",
  RESOLVER_DATOS: "Corregir sus datos",
  SEGUIMIENTO: "Llamar: seguimiento acordado",
  HABILITACION: "Ya puede portar: llámalo",
  REINTENTO: "Volver a llamar",
  SIN_FECHA: "Llamar por primera vez",
};

/** Solo el origen que le dice algo al asesor; el resto es ruido del motor. */
const campaignDetails: Partial<Record<RecoveryAgendaOrigin, string>> = {
  devuelto: "Volvió de verificación: sigue pudiendo portar",
  dato_pendiente: "Falta la fecha de portación",
  impedimento: "Seguimiento del impedimento",
  pausa: "Estaba en pausa por un rechazo",
};

const entryReasonLabels = new Map<string, string>(
  salesRecoveryReasonOptions.map((option) => [option.value, option.label]),
);

/**
 * Por qué se cayó la venta, en palabras del asesor: lo que sugiere la
 * logística si el pedido es una entrega fallida por gestionar; si no, el
 * motivo con que se abrió el caso.
 */
function fallReason(row: {
  entryReason: string | null;
  entryObservation: string | null;
  sourceDitoOrder: {
    agrDeliverySnapshot: {
      estadoPedido: string;
      motivoRechazo: string | null;
      submotivoRechazo: string | null;
      isRecoveryOpportunity: boolean;
    } | null;
  } | null;
}): string | null {
  const snapshot = row.sourceDitoOrder?.agrDeliverySnapshot;
  if (snapshot?.isRecoveryOpportunity) return getAgrAction(snapshot).label;
  // «Otro» no le dice nada al asesor: en su lugar, lo que se anotó al abrir.
  if (row.entryReason === "OTRO" || !row.entryReason) {
    const observation = row.entryObservation?.trim() ?? "";
    if (!observation) return null;
    return observation.length > 80 ? `${observation.slice(0, 80)}…` : observation;
  }
  return entryReasonLabels.get(row.entryReason) ?? null;
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
    // Lo más reciente primero: con muchos casos antiguos, el techo no puede
    // dejar fuera a los clientes calientes (BR-018).
    orderBy: { lastSightingAt: "desc" },
    take: salesRecoveryLimit,
    select: {
      id: true,
      holderName: true,
      status: true,
      entryReason: true,
      entryObservation: true,
      sourceDitoOrder: {
        select: {
          orderCodeRaw: true,
          registeredAt: true,
          deliveryContactPhone: true,
          serviceNumber: true,
          agrDeliverySnapshot: {
            select: {
              estadoPedido: true,
              motivoRechazo: true,
              submotivoRechazo: true,
              isRecoveryOpportunity: true,
            },
          },
        },
      },
      phones: {
        where: { kind: "CONTACT", invalidMarkedAt: null },
        select: { phoneNumber: true },
      },
      firstContactAt: true,
      nextActionAt: true,
      lastSightingAt: true,
      claimedAt: true,
      attempts: lastAttemptSelect,
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
    const saleAt = row.sourceDitoOrder?.registeredAt ?? row.lastSightingAt;
    const placement = placeMyDaySalesRecovery(
      {
        status,
        saleAt,
        firstContactAt: row.firstContactAt,
        nextActionAt: row.nextActionAt,
        firstActionAt: getInternalRecoveryFirstActionAt(row.lastSightingAt),
        due,
      },
      now,
    );
    if (!placement) return [];

    const last = row.attempts[0];
    const cold = placement.bucket === "frio";
    const neverCalled = row.firstContactAt === null;

    return [
      {
        key: `venta:${row.id}`,
        kind: "venta_caida" as const,
        ...placement,
        saleAt,
        // Lo frío no se pinta en rojo ni cuenta minutos: no debe hacer ruido.
        dueLabel:
          !cold && placement.dueAt
            ? describeMyDayDue(placement.dueAt, now)
            : null,
        overdue: !cold && due !== null,
        tone: cold
          ? ("neutral" as const)
          : due !== null
            ? ("danger" as const)
            : ("warning" as const),
        phone: null,
        rank: index,
        title: row.holderName,
        action: salesRecoveryAction({
          cold,
          neverCalled,
          overdue: due !== null,
          dueAt: placement.dueAt,
        }),
        detail: [
          `Venta del ${formatMyDaySaleDay(saleAt)}`,
          row.sourceDitoOrder
            ? `pedido ${row.sourceDitoOrder.orderCodeRaw}`
            : null,
          fallReason(row),
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/recovery/sales/${row.id}`,
        actionLabel: "Abrir caso",
        manage: buildManage({
          caseId: row.id,
          contactPhones: row.phones.map((phone) => phone.phoneNumber),
          serviceNumbers: [],
          orderPhone: row.sourceDitoOrder?.deliveryContactPhone,
          orderLine: row.sourceDitoOrder?.serviceNumber,
          last: last ? { ...last, result: String(last.result) } : null,
        }),
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
        select: { phoneNumber: true },
      },
      services: {
        where: { discardedAt: null },
        select: { serviceNumber: true },
      },
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          result: true,
          observation: true,
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
    saleAt: null,
    // Una oportunidad de campaña no es una falta: dice desde cuándo, sin rojo.
    dueLabel: item.at && item.overdue ? describeMyDaySince(item.at, now) : null,
    overdue: false,
    tone: "neutral" as const,
    phone: null,
    rank: index,
    title: row.holderName,
    action: campaignActions[item.kind],
    detail: campaignDetails[item.origin] ?? null,
    href: `/recovery/campaigns/${row.id}`,
    actionLabel: "Abrir caso",
    manage: buildManage({
      caseId: row.id,
      contactPhones: row.phones.map((phone) => phone.phoneNumber),
      serviceNumbers: row.services.map((item) => item.serviceNumber),
      last: row.attempts[0]
        ? { ...row.attempts[0], result: String(row.attempts[0].result) }
        : null,
    }),
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
      // BR-001: si ya tiene un caso de recupero abierto, el trabajo es ese
      // caso y aparece una sola vez, como venta caída.
      recoveryCasesOriginated: {
        none: { status: { in: [...salesRecoveryOpenStatuses] } },
      },
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
      deliveryContactPhone: true,
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
    let badge: string | null = null;

    if (snapshot?.isRecoveryOpportunity) {
      action = getAgrAction(snapshot).label;
    } else if (row.sentSubstatus === "REJECTED") {
      action = "Entrega rechazada: habla con el cliente";
      dueAt = row.sentSubstatusUpdatedAt;
      badge = "rechazada";
    } else if (row.sentSubstatus === "NO_STATUS") {
      action = "El courier no informa el estado de la entrega";
      dueAt = row.noStatusDetectedAt;
      badge = "sin estado";
    } else {
      action = "Pasó el plazo de entrega sin que llegue";
      dueAt = row.deliveryDueAt;
      badge = "atrasado";
    }

    const placement = placeMyDayOrder(row.registeredAt, dueAt, now);
    const hot = placement.bucket !== "frio";

    return {
      key: `pedido:${row.id}`,
      kind: "pedido" as const,
      ...placement,
      saleAt: row.registeredAt,
      dueLabel:
        hot && dueAt && badge
          ? `${badge} ${describeMyDaySince(dueAt, now)}`
          : null,
      overdue: hot,
      tone: hot ? ("warning" as const) : ("neutral" as const),
      phone: row.deliveryContactPhone,
      rank: index,
      title: row.holderFullNameRaw,
      action,
      detail: `Venta del ${formatMyDaySaleDay(row.registeredAt)} · pedido ${row.orderCodeRaw}`,
      href: buildOrderHref(row.orderCodeRaw, getLimaIsoDate(row.registeredAt)),
      actionLabel: "Ver pedido",
      manage: null,
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
): Promise<{ progress: MyDayProgress; sales: MyDaySales }> {
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
      orderBy: { registeredAt: "desc" },
      select: {
        id: true,
        orderCodeRaw: true,
        holderFullNameRaw: true,
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
    // BR-019: la cuota del mes, la misma que leen Cuotas y Rendimiento.
    database.performanceQuota.findFirst({
      where: {
        organizationId,
        periodKey: month.key,
        window: monthlyQuotaWindow,
        userId,
      },
      select: { target: true },
    }),
  ]);

  const metrics = calculatePerformanceMetrics(orders.map(toMetricInput));
  const window = relevantWindow
    ? metrics.accelerators.find((item) => item.key === relevantWindow.key)
    : undefined;
  const todayStart = today.start?.getTime() ?? Number.POSITIVE_INFINITY;

  // Fase 4 (BR-020): las mismas ventas, cada una con lo que vale. La regla de
  // pago es la de Rendimiento; lo que «ya paga» suma su comisión base.
  const classified = orders.map((order) => ({
    order,
    classification: classifyMyDaySale(toMetricInput(order)),
  }));
  const byBucket: Partial<Record<MyDaySaleBucket, MyDaySale[]>> = {};
  for (const { order, classification } of classified) {
    const list = byBucket[classification.bucket] ?? [];
    list.push({
      id: order.id,
      holderName: order.holderFullNameRaw,
      orderCode: order.orderCodeRaw,
      saleDayLabel: formatMyDaySaleDay(order.registeredAt),
      amountCents: classification.amountCents,
      potential: classification.potential,
      reasonText:
        classification.bucket === "sin_comision"
          ? (myDayNoCommissionReasons[classification.reason] ?? null)
          : null,
      href: buildOrderHref(
        order.orderCodeRaw,
        getLimaIsoDate(order.registeredAt),
      ),
    });
    byBucket[classification.bucket] = list;
  }
  const sales: MyDaySales = {
    total: orders.length,
    summary: summarizeMyDaySales(classified.map((item) => item.classification)),
    byBucket,
  };

  const progress: MyDayProgress = {
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
            closed: windowClosed,
            upcoming:
              getPerformanceCommissionPolicy(month.key)
                .acceleratorWindows.filter(
                  (item) => item.windowStartDay > dayOfMonth,
                )
                .map((item) => ({
                  label: item.label,
                  startDay: item.windowStartDay,
                  target: item.tiers[0]?.target ?? 0,
                  amountCents: item.tiers[0]?.amountCents ?? 0,
                }))[0] ?? null,
          }
        : null,
    quota: {
      target: quota?.target ?? getDefaultMonthlyQuotaTarget(),
      assigned: quota !== null,
      delivered: metrics.deliveredPortability,
    },
    policy: getPerformanceCommissionPolicy(month.key),
  };

  return { progress, sales };
}

export async function getMyDay(
  organizationId: string,
  userId: string,
  now = new Date(),
): Promise<MyDayData> {
  const [commitments, salesRecovery, campaign, orders, { progress, sales }] =
    await Promise.all([
      readCommitments(organizationId, userId, now),
      readSalesRecovery(organizationId, userId, now),
      readCampaign(organizationId, userId, now),
      readOrders(organizationId, userId, now),
      readProgress(organizationId, userId, now),
    ]);

  const all = [
    ...commitments,
    ...salesRecovery,
    ...orders,
    ...campaign.entries,
  ];
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
    cold: sorted
      .filter((entry) => entry.bucket === "frio")
      .sort(
        (left, right) =>
          (right.saleAt?.getTime() ?? 0) - (left.saleAt?.getTime() ?? 0),
      ),
    campaign: { total: campaign.total, shown: campaign.entries.length },
    progress,
    sales,
  };
}
