import "server-only";

import {
  allOf,
  describeRecoveryCommitmentState,
  effectiveAttemptResult,
  getLimaIsoDate,
  limaHourMinute,
  parseRecoveryAgeBucket,
  parseRecoveryAgendaDate,
  parseRecoveryAgendaView,
  recoveryAgeBucketRange,
  recoveryAgendaKindLabels,
  recoveryAgendaOriginLabels,
  recoveryAgendaPeriod,
  recoveryCommitmentStateLabels,
  selectRecoveryAgendaItem,
  shareRecoveryAgendaSlot,
} from "@repo/validation";

import { database } from "@/server/database";
import { formatLimaDateTime } from "@repo/ui/format";

import { attemptResultLabels } from "../attempt-result-labels";
import { buildRecoverySearchWhere } from "./recovery-search-where";

import type { Prisma } from "@repo/database";
import type {
  RecoveryAgeBucket,
  RecoveryAgendaItemKind,
  RecoveryAgendaPeriod,
  RecoveryAgendaView,
  RecoveryCommitmentState,
} from "@repo/validation";

/** Filtro «tipo» de la agenda (spec §4, filtros): valor de URL → tipos. */
export const agendaKindFilters: ReadonlyArray<{
  value: string;
  label: string;
  kinds: ReadonlyArray<RecoveryAgendaItemKind>;
}> = [
  { value: "citas", label: "Llamadas acordadas", kinds: ["CITA_ACORDADA"] },
  { value: "reintentos", label: "Reintentos", kinds: ["REINTENTO"] },
  { value: "seguimientos", label: "Seguimientos", kinds: ["SEGUIMIENTO"] },
  { value: "habilitaciones", label: "Habilitaciones", kinds: ["HABILITACION"] },
  { value: "venta", label: "Completar venta", kinds: ["COMPLETAR_VENTA"] },
];

export const agendaStateFilters: ReadonlyArray<{
  value: string;
  label: string;
  states: ReadonlyArray<RecoveryCommitmentState>;
}> = [
  { value: "pendientes", label: "Pendientes", states: ["pendiente"] },
  { value: "vencidos", label: "Vencidos", states: ["vencida"] },
  { value: "completados", label: "Completados", states: ["atendida"] },
  { value: "reprogramados", label: "Reprogramados", states: ["reprogramada"] },
  { value: "cancelados", label: "Cancelados", states: ["cancelada"] },
];

export interface AgendaQuery {
  view: RecoveryAgendaView;
  date: Date;
  q: string;
  age: RecoveryAgeBucket | null;
  kind: string;
  state: string;
}

export function readAgendaQuery(
  parameters: Record<string, string | undefined>,
  now: Date,
): AgendaQuery {
  const kind = (parameters.tipo ?? "").trim();
  const state = (parameters.estado ?? "").trim();

  return {
    view: parseRecoveryAgendaView(parameters.view),
    date: parseRecoveryAgendaDate(parameters.fecha, now),
    q: (parameters.q ?? "").trim().slice(0, 80),
    age: parseRecoveryAgeBucket(parameters.age),
    kind: agendaKindFilters.some((filter) => filter.value === kind)
      ? kind
      : "",
    state: agendaStateFilters.some((filter) => filter.value === state)
      ? state
      : "",
  };
}

export interface AgendaEntry {
  /** Único por elemento: el caso, o la cita histórica. */
  key: string;
  caseId: string;
  holderName: string;
  phone: string | null;
  kind: RecoveryAgendaItemKind;
  kindLabel: string;
  originLabel: string;
  at: Date | null;
  atLabel: string | null;
  /** Día de Lima (`AAAA-MM-DD`) y hora, para colocarlo. */
  dayIso: string | null;
  hour: number | null;
  minute: number | null;
  timeLabel: string | null;
  /** Solo la cita acordada ocupa una hora (BR-004). */
  timed: boolean;
  state: RecoveryCommitmentState;
  stateLabel: string;
  lastResultLabel: string | null;
  lastObservation: string | null;
  recencyLabel: string;
  href: string;
  /** La cita a la que abre el panel, si el elemento es una cita. */
  commitmentId: string | null;
  /** BR-016: otra cita del período en el mismo tramo de 15 minutos. */
  clash: boolean;
}

export interface AgendaData {
  query: AgendaQuery;
  period: RecoveryAgendaPeriod;
  todayIso: string;
  /** Lo que cae en el período, ya filtrado. */
  periodEntries: AgendaEntry[];
  /** Citas pendientes cuya hora pasó, de cualquier fecha; ignoran filtros. */
  overdueCommitments: AgendaEntry[];
  /** Tareas sin hora que vencen hoy o antes; ignoran filtros. */
  untimedDue: AgendaEntry[];
  /** Asignados sin gestión ni fecha. */
  noDateCount: number;
  /** En verificación: listado informativo, sin fecha. */
  verification: AgendaEntry[];
  counts: { commitments: number; tasks: number; overdue: number };
}

const openStatuses = ["ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"] as const;

function recencyLabel(lastSightingAt: Date, now: Date): string {
  const days = Math.round(
    (new Date(`${getLimaIsoDate(now)}T00:00:00-05:00`).getTime() -
      new Date(`${getLimaIsoDate(lastSightingAt)}T00:00:00-05:00`).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  if (days <= 0) return "oportunidad de hoy";
  if (days === 1) return "oportunidad de ayer";

  return `oportunidad de hace ${days} días`;
}

function timeLabel(at: Date): string {
  const { hour, minute } = limaHourMinute(at);

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function queryContext(query: AgendaQuery): URLSearchParams {
  const context = new URLSearchParams();
  if (query.view !== "semana") context.set("view", query.view);
  context.set("fecha", getLimaIsoDate(query.date));
  if (query.q) context.set("q", query.q);
  if (query.age) context.set("age", query.age);
  if (query.kind) context.set("tipo", query.kind);
  if (query.state) context.set("estado", query.state);

  return context;
}

function caseHref(caseId: string, query: AgendaQuery): string {
  const context = queryContext(query);
  context.set("from", "agenda");

  return `/recovery/campaigns/${caseId}?${context.toString()}`;
}

/** El panel de la cita se abre en la misma agenda (`cita=<id>`). */
export function commitmentPanelHref(
  commitmentId: string,
  query: AgendaQuery,
): string {
  const context = queryContext(query);
  context.set("cita", commitmentId);

  return `/recovery/agenda?${context.toString()}`;
}

/** La agenda sin panel abierto, con el resto del contexto intacto. */
export function agendaBaseHref(query: AgendaQuery): string {
  return `/recovery/agenda?${queryContext(query).toString()}`;
}

/**
 * Mi agenda — SPEC-048 BR-004, BR-013, BR-014, BR-018. La población es la
 * del asesor autenticado (BR-029b): sus casos de base abiertos, pasados por
 * el mismo selector que usan la bandeja y la ficha, más las citas del
 * período en cualquier estado para consultar lo atendido, reprogramado o
 * cancelado.
 */
export async function getAgenda(
  organizationId: string,
  userId: string,
  parameters: Record<string, string | undefined>,
  now = new Date(),
): Promise<AgendaData> {
  const query = readAgendaQuery(parameters, now);
  const period = recoveryAgendaPeriod(query.view, query.date);
  const todayIso = getLimaIsoDate(now);

  const where = allOf<Prisma.RecoveryCaseWhereInput>(
    {
      organizationId,
      source: "NATIONAL_BASE",
      assignedUserId: userId,
      status: { in: [...openStatuses] },
    },
    buildRecoverySearchWhere(query.q),
    query.age ? { lastSightingAt: recoveryAgeBucketRange(query.age, now) } : null,
  );

  const cases = await database.recoveryCase.findMany({
    where,
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }],
    select: {
      id: true,
      holderName: true,
      status: true,
      nextActionAt: true,
      portabilityEligibleAt: true,
      lastSightingAt: true,
      phones: {
        where: { kind: "CONTACT", invalidMarkedAt: null },
        take: 1,
        select: { phoneNumber: true },
      },
      services: {
        where: { discardedAt: null },
        take: 1,
        select: { serviceNumber: true },
      },
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          result: true,
          observation: true,
          createdAt: true,
          followUpAt: true,
          correction: { select: { effectiveResult: true, effectiveReason: true } },
        },
      },
      commitments: {
        where: {
          OR: [
            { status: "PENDING" },
            { scheduledAt: { gte: period.start, lt: period.end } },
          ],
        },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          reason: true,
        },
      },
    },
  });

  const entries: AgendaEntry[] = [];

  for (const item of cases) {
    const last = item.attempts[0] ?? null;
    const pending = item.commitments.find(
      (commitment) => String(commitment.status) === "PENDING",
    );
    const common = {
      caseId: item.id,
      holderName: item.holderName,
      phone:
        item.phones[0]?.phoneNumber ?? item.services[0]?.serviceNumber ?? null,
      lastResultLabel: last
        ? (attemptResultLabels[effectiveAttemptResult(last)] ??
          effectiveAttemptResult(last))
        : null,
      lastObservation: last?.observation ?? null,
      recencyLabel: recencyLabel(item.lastSightingAt, now),
      href: caseHref(item.id, query),
    };

    const agendaItem = selectRecoveryAgendaItem(
      {
        status: String(item.status),
        nextActionAt: item.nextActionAt,
        portabilityEligibleAt: item.portabilityEligibleAt,
        lastResult: last ? effectiveAttemptResult(last) : null,
        lastAttemptAt: last?.createdAt ?? null,
        pendingCommitmentAt: pending?.scheduledAt ?? null,
        lastFollowUpAt: last?.followUpAt ?? null,
      },
      now,
    );

    if (agendaItem) {
      const state: RecoveryCommitmentState = agendaItem.overdue
        ? "vencida"
        : "pendiente";
      entries.push({
        ...common,
        key: item.id,
        commitmentId: pending?.id ?? null,
        clash: false,
        href:
          agendaItem.kind === "CITA_ACORDADA" && pending
            ? commitmentPanelHref(pending.id, query)
            : common.href,
        kind: agendaItem.kind,
        kindLabel: recoveryAgendaKindLabels[agendaItem.kind],
        originLabel: recoveryAgendaOriginLabels[agendaItem.origin],
        at: agendaItem.at,
        atLabel: agendaItem.at ? formatLimaDateTime(agendaItem.at) : null,
        dayIso: agendaItem.at ? getLimaIsoDate(agendaItem.at) : null,
        hour: agendaItem.at ? limaHourMinute(agendaItem.at).hour : null,
        minute: agendaItem.at ? limaHourMinute(agendaItem.at).minute : null,
        timeLabel:
          agendaItem.at && agendaItem.timed ? timeLabel(agendaItem.at) : null,
        timed: agendaItem.timed,
        state,
        stateLabel: recoveryCommitmentStateLabels[state],
      });
    }

    // Citas ya cerradas dentro del período: se consultan, no se trabajan.
    for (const commitment of item.commitments) {
      if (String(commitment.status) === "PENDING") continue;

      const state = describeRecoveryCommitmentState(
        String(commitment.status),
        commitment.scheduledAt,
        now,
      );
      entries.push({
        ...common,
        key: `cita-${commitment.id}`,
        commitmentId: commitment.id,
        clash: false,
        href: commitmentPanelHref(commitment.id, query),
        kind: "CITA_ACORDADA",
        kindLabel: recoveryAgendaKindLabels.CITA_ACORDADA,
        originLabel: recoveryAgendaOriginLabels.acuerdo,
        at: commitment.scheduledAt,
        atLabel: formatLimaDateTime(commitment.scheduledAt),
        dayIso: getLimaIsoDate(commitment.scheduledAt),
        hour: limaHourMinute(commitment.scheduledAt).hour,
        minute: limaHourMinute(commitment.scheduledAt).minute,
        timeLabel: timeLabel(commitment.scheduledAt),
        timed: true,
        state,
        stateLabel: recoveryCommitmentStateLabels[state],
        lastObservation: commitment.reason ?? common.lastObservation,
      });
    }
  }

  const kindFilter = agendaKindFilters.find(
    (filter) => filter.value === query.kind,
  );
  const stateFilter = agendaStateFilters.find(
    (filter) => filter.value === query.state,
  );
  const filtered = entries.filter(
    (entry) =>
      (!kindFilter || kindFilter.kinds.includes(entry.kind)) &&
      (!stateFilter || stateFilter.states.includes(entry.state)),
  );

  const inPeriod = (entry: AgendaEntry) =>
    entry.at !== null &&
    entry.at.getTime() >= period.start.getTime() &&
    entry.at.getTime() < period.end.getTime();

  const periodEntries = filtered
    .filter(inPeriod)
    .sort((left, right) => left.at!.getTime() - right.at!.getTime());

  // BR-016: dos citas vivas del período en el mismo tramo se señalan.
  const liveTimed = periodEntries.filter(
    (entry) =>
      entry.timed &&
      entry.at !== null &&
      (entry.state === "pendiente" || entry.state === "vencida"),
  );
  for (const entry of liveTimed) {
    entry.clash = liveTimed.some(
      (other) =>
        other !== entry && shareRecoveryAgendaSlot(entry.at!, other.at!),
    );
  }

  const endOfToday = new Date(
    new Date(`${todayIso}T00:00:00-05:00`).getTime() + 24 * 60 * 60 * 1000,
  );

  const overdueCommitments = entries
    .filter((entry) => entry.kind === "CITA_ACORDADA" && entry.state === "vencida")
    .sort((left, right) => left.at!.getTime() - right.at!.getTime());
  const untimedDue = entries
    .filter(
      (entry) =>
        !entry.timed &&
        entry.at !== null &&
        entry.at.getTime() < endOfToday.getTime() &&
        entry.kind !== "VERIFICACION" &&
        entry.kind !== "SIN_FECHA",
    )
    .sort((left, right) => left.at!.getTime() - right.at!.getTime());

  return {
    query,
    period,
    todayIso,
    periodEntries,
    overdueCommitments,
    untimedDue,
    noDateCount: entries.filter((entry) => entry.kind === "SIN_FECHA").length,
    verification: entries.filter((entry) => entry.kind === "VERIFICACION"),
    counts: {
      commitments: periodEntries.filter((entry) => entry.timed).length,
      tasks: periodEntries.filter((entry) => !entry.timed).length,
      overdue: overdueCommitments.length,
    },
  };
}
