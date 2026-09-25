import "server-only";

import {
  allOf,
  describeCampaignWorkDue,
  describeRecoveryCommitmentState,
  effectiveAttemptResult,
  formatCampaignMoment,
  formatMyDaySaleDay,
  formatMyDayTime,
  getLimaIsoDate,
  limaDayStartFromIso,
  parseRecoveryAgendaDate,
  parseRecoveryAgendaView,
  recoveryAgendaPeriod,
  recoveryCommitmentStateLabels,
  shareRecoveryAgendaSlot,
} from "@repo/validation";

import { database } from "@/server/database";

import { attemptResultLabels } from "../attempt-result-labels";
import { buildRecoverySearchWhere } from "./recovery-search-where";

import type { Prisma } from "@repo/database";
import type {
  RecoveryAgendaPeriod,
  RecoveryAgendaView,
  RecoveryCommitmentState,
} from "@repo/validation";

/** Filtro de estado de la cita (SPEC-066 BR-014). */
export const agendaStateFilters: ReadonlyArray<{
  value: string;
  label: string;
  states: ReadonlyArray<RecoveryCommitmentState>;
}> = [
  { value: "pendientes", label: "Pendientes", states: ["pendiente"] },
  { value: "vencidos", label: "Vencidas", states: ["vencida"] },
  { value: "completados", label: "Atendidas", states: ["atendida"] },
  { value: "reprogramados", label: "Reprogramadas", states: ["reprogramada"] },
  { value: "cancelados", label: "Canceladas", states: ["cancelada"] },
];

export interface AgendaQuery {
  view: RecoveryAgendaView;
  date: Date;
  q: string;
  state: string;
  /** La cita que se pidió ver (`cita=<id>`), para abrirla y llevar a su día. */
  commitmentId: string;
}

export interface AgendaEntry {
  key: string;
  commitmentId: string;
  caseId: string;
  /** La ficha del cliente: la de Campañas o la de Recupero de ventas. */
  caseHref: string;
  /** De dónde viene la cita: la base de campaña o una venta caída propia. */
  source: "campana" | "venta_caida";
  holderName: string;
  phone: string | null;
  phoneOptions: string[];
  serviceNumbers: string[];
  at: Date;
  dayIso: string;
  timeLabel: string;
  state: RecoveryCommitmentState;
  stateLabel: string;
  /** El plazo y su tono, con la misma regla que «Mi día» y la cola. */
  due: { label: string; tone: "danger" | "warning" | "neutral" } | null;
  isPending: boolean;
  reason: string | null;
  lastResult: string | null;
  lastResultLabel: string | null;
  lastObservation: string | null;
  lastAttemptAtLabel: string | null;
  /** «venta del 18/09» en las ventas caídas. */
  saleLabel: string | null;
  /** BR-016 de SPEC-048: otra cita viva en el mismo tramo de 15 minutos. */
  clash: boolean;
  /** Historia de la cita: la cadena de reprogramaciones del caso. */
  history: Array<{
    id: string;
    atLabel: string;
    stateLabel: string;
    reason: string | null;
    createdByName: string;
  }>;
}

export interface AgendaData {
  query: AgendaQuery;
  period: RecoveryAgendaPeriod;
  todayIso: string;
  /** Las citas del período, ya filtradas y en orden. */
  periodEntries: AgendaEntry[];
  /** Citas pendientes cuya hora pasó, de cualquier fecha; ignoran filtros. */
  overdue: AgendaEntry[];
  /** Si la cita pedida existe y es del asesor. */
  commitmentFound: boolean;
}

const openStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

export function readAgendaQuery(
  parameters: Record<string, string | undefined>,
  now: Date,
): AgendaQuery {
  const state = (parameters.estado ?? "").trim();

  return {
    view: parseRecoveryAgendaView(parameters.view),
    date: parseRecoveryAgendaDate(parameters.fecha, now),
    q: (parameters.q ?? "").trim().slice(0, 80),
    state: agendaStateFilters.some((filter) => filter.value === state)
      ? state
      : "",
    commitmentId: (parameters.cita ?? "").trim().slice(0, 40),
  };
}

function queryContext(query: AgendaQuery): URLSearchParams {
  const context = new URLSearchParams();
  if (query.view !== "proximas") context.set("view", query.view);
  context.set("fecha", getLimaIsoDate(query.date));
  if (query.q) context.set("q", query.q);
  if (query.state) context.set("estado", query.state);

  return context;
}

/** La agenda con el contexto actual y lo que se cambie. */
export function agendaHref(
  query: AgendaQuery,
  overrides: Partial<{ view: RecoveryAgendaView; date: Date }> = {},
): string {
  const context = queryContext({ ...query, ...overrides });

  return `/recovery/agenda?${context.toString()}`;
}

/**
 * Mi agenda — SPEC-048, SPEC-066. Solo llamadas acordadas: las de la base
 * de campaña y las de las ventas caídas del asesor (SPEC-063 BR-013). Las
 * tareas automáticas —reintentos, habilitaciones, seguimientos— viven en la
 * cola y en «Mi día»; repetirlas aquí llenaba la agenda de filas rojas que
 * no eran citas (SPEC-066 BR-006).
 */
export async function getAgenda(
  organizationId: string,
  userId: string,
  parameters: Record<string, string | undefined>,
  now = new Date(),
): Promise<AgendaData> {
  const query = readAgendaQuery(parameters, now);
  const todayIso = getLimaIsoDate(now);

  // `cita=<id>` sin fecha lleva al día de esa cita.
  let commitmentFound = false;
  if (query.commitmentId) {
    const requested = await database.recoveryCaseCommitment.findFirst({
      where: {
        id: query.commitmentId,
        organizationId,
        case: { assignedUserId: userId },
      },
      select: { scheduledAt: true },
    });
    commitmentFound = requested !== null;
    if (requested && !parameters.fecha) {
      query.date =
        limaDayStartFromIso(getLimaIsoDate(requested.scheduledAt)) ??
        query.date;
    }
  }

  const period = recoveryAgendaPeriod(query.view, query.date);

  const rows = await database.recoveryCaseCommitment.findMany({
    where: {
      organizationId,
      OR: [
        { status: "PENDING" },
        { scheduledAt: { gte: period.start, lt: period.end } },
      ],
      case: allOf<Prisma.RecoveryCaseWhereInput>(
        { assignedUserId: userId, status: { in: [...openStatuses] } },
        buildRecoverySearchWhere(query.q),
      ),
    },
    orderBy: { scheduledAt: "asc" },
    take: 300,
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      reason: true,
      case: {
        select: {
          id: true,
          holderName: true,
          source: true,
          lastSightingAt: true,
          sourceDitoOrder: {
            select: { registeredAt: true, deliveryContactPhone: true },
          },
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
              result: true,
              observation: true,
              createdAt: true,
              correction: {
                select: { effectiveResult: true, effectiveReason: true },
              },
            },
          },
          commitments: {
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              reason: true,
              createdBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const entries: AgendaEntry[] = rows.map((row) => {
    const item = row.case;
    const campaign = String(item.source) === "NATIONAL_BASE";
    const last = item.attempts[0] ?? null;
    const lastResult = last ? effectiveAttemptResult(last) : null;
    const state = describeRecoveryCommitmentState(
      String(row.status),
      row.scheduledAt,
      now,
    );
    const isPending = String(row.status) === "PENDING";
    const contactPhones = item.phones.map((phone) => phone.phoneNumber);
    const serviceNumbers = item.services.map((service) => service.serviceNumber);
    const fallbackPhone = item.sourceDitoOrder?.deliveryContactPhone ?? null;
    const phoneOptions = [
      ...new Set([
        ...contactPhones,
        ...serviceNumbers,
        ...(fallbackPhone ? [fallbackPhone] : []),
      ]),
    ];

    return {
      key: `cita-${row.id}`,
      commitmentId: row.id,
      caseId: item.id,
      caseHref: campaign
        ? `/recovery/campaigns/${item.id}`
        : `/recovery/sales/${item.id}`,
      source: campaign ? "campana" : "venta_caida",
      holderName: item.holderName,
      phone: phoneOptions[0] ?? null,
      phoneOptions,
      serviceNumbers,
      at: row.scheduledAt,
      dayIso: getLimaIsoDate(row.scheduledAt),
      timeLabel: formatMyDayTime(row.scheduledAt),
      state,
      stateLabel: recoveryCommitmentStateLabels[state],
      // BR-007: solo la cita viva lleva plazo; roja si el asesor la dejó
      // vencer, ámbar si vence en menos de dos horas.
      due: isPending
        ? describeCampaignWorkDue(
            {
              kind: "CITA_ACORDADA",
              origin: "acuerdo",
              at: row.scheduledAt,
              timed: true,
              overdue: row.scheduledAt.getTime() < now.getTime(),
            },
            now,
          )
        : null,
      isPending,
      reason: row.reason,
      lastResult,
      lastResultLabel: lastResult
        ? (attemptResultLabels[lastResult] ?? lastResult)
        : null,
      lastObservation: last?.observation ?? null,
      lastAttemptAtLabel: last ? formatCampaignMoment(last.createdAt) : null,
      saleLabel: campaign
        ? null
        : `venta del ${formatMyDaySaleDay(
            item.sourceDitoOrder?.registeredAt ?? item.lastSightingAt,
          )}`,
      clash: false,
      history: item.commitments
        .filter((commitment) => commitment.id !== row.id)
        .map((commitment) => ({
          id: commitment.id,
          atLabel: formatCampaignMoment(commitment.scheduledAt),
          stateLabel:
            recoveryCommitmentStateLabels[
              describeRecoveryCommitmentState(
                String(commitment.status),
                commitment.scheduledAt,
                now,
              )
            ],
          reason: commitment.reason,
          createdByName: commitment.createdBy.name,
        })),
    };
  });

  const stateFilter = agendaStateFilters.find(
    (filter) => filter.value === query.state,
  );
  const periodEntries = entries.filter(
    (entry) =>
      entry.at.getTime() >= period.start.getTime() &&
      entry.at.getTime() < period.end.getTime() &&
      (!stateFilter || stateFilter.states.includes(entry.state)),
  );

  // Dos citas vivas en el mismo tramo de 15 minutos se señalan.
  const live = entries.filter((entry) => entry.isPending);
  for (const entry of live) {
    entry.clash = live.some(
      (other) => other !== entry && shareRecoveryAgendaSlot(entry.at, other.at),
    );
  }

  return {
    query,
    period,
    todayIso,
    periodEntries,
    overdue: entries.filter((entry) => entry.state === "vencida"),
    commitmentFound,
  };
}
