import { formatMyDayTime } from "./my-day.js";
import { limaHourMinute } from "./recovery-agenda-period.js";

/**
 * «Hoy en mi equipo» — SPEC-069. Resume el «Mi día» de cada asesor para su
 * supervisor. No decide qué vence ni qué es caliente: eso ya viene resuelto
 * por «Mi día» (BR-002), así que un caso dice lo mismo en las dos pantallas.
 */

/** Lo que interesa de cada fila del tramo «Ahora» de un «Mi día». */
export interface TeamMemberNowEntry {
  kind: "cita" | "venta_caida" | "pedido" | "campana";
  /** Venta caída sin primer contacto (`venta_en_riesgo`) o con seguimiento. */
  tier: string;
  overdue: boolean;
}

export interface TeamMemberDayInput {
  userId: string;
  name: string;
  now: TeamMemberNowEntry[];
  /** Casos de campaña por trabajar hoy (la vista «Ahora» de la cola). */
  campaignTotal: number;
  /** Ventas caídas y pedidos antiguos: una cifra, sin ruido. */
  coldCount: number;
  attemptsToday: number;
  enteredToday: number;
  quotaDelivered: number;
  quotaTarget: number;
  lastAttemptAt: Date | null;
}

export interface TeamMemberDaySummary {
  userId: string;
  name: string;
  /** Ventas caídas calientes sin primer contacto, y cuántas vencieron. */
  salesNotCalled: number;
  salesNotCalledOverdue: number;
  /** Ventas caídas calientes con el seguimiento vencido. */
  salesFollowUp: number;
  citasOverdue: number;
  citasSoon: number;
  orders: number;
  campaignTotal: number;
  coldCount: number;
  attemptsToday: number;
  enteredToday: number;
  quotaDelivered: number;
  quotaTarget: number;
  /** «11:40»: la hora de su última gestión de hoy. */
  lastAttemptLabel: string | null;
  /** BR-007: sin gestiones no es ausencia; después de las 11:00, ámbar. */
  idle: "no" | "temprano" | "tarde";
}

/** BR-007: hasta esta hora de Lima, no tener gestiones es normal. */
export const teamTodayIdleHour = 11;

export function summarizeTeamMemberDay(
  input: TeamMemberDayInput,
  now: Date,
): TeamMemberDaySummary {
  const sales = input.now.filter((entry) => entry.kind === "venta_caida");
  const notCalled = sales.filter((entry) => entry.tier === "venta_en_riesgo");
  const citas = input.now.filter((entry) => entry.kind === "cita");

  return {
    userId: input.userId,
    name: input.name,
    salesNotCalled: notCalled.length,
    salesNotCalledOverdue: notCalled.filter((entry) => entry.overdue).length,
    salesFollowUp: sales.length - notCalled.length,
    citasOverdue: citas.filter((entry) => entry.overdue).length,
    citasSoon: citas.filter((entry) => !entry.overdue).length,
    orders: input.now.filter((entry) => entry.kind === "pedido").length,
    campaignTotal: input.campaignTotal,
    coldCount: input.coldCount,
    attemptsToday: input.attemptsToday,
    enteredToday: input.enteredToday,
    quotaDelivered: input.quotaDelivered,
    quotaTarget: input.quotaTarget,
    lastAttemptLabel: input.lastAttemptAt
      ? formatMyDayTime(input.lastAttemptAt)
      : null,
    idle:
      input.attemptsToday > 0
        ? "no"
        : limaHourMinute(now).hour < teamTodayIdleHour
          ? "temprano"
          : "tarde",
  };
}

/**
 * BR-004: primero quien pierde más. Ventas calientes sin llamar vencidas,
 * después citas vencidas, pedidos, ventas sin llamar aún en plazo y
 * campaña; empate por nombre.
 */
export function compareTeamMembers(
  left: TeamMemberDaySummary,
  right: TeamMemberDaySummary,
): number {
  return (
    right.salesNotCalledOverdue - left.salesNotCalledOverdue ||
    right.citasOverdue - left.citasOverdue ||
    right.orders - left.orders ||
    right.salesNotCalled - left.salesNotCalled ||
    right.salesFollowUp - left.salesFollowUp ||
    right.campaignTotal - left.campaignTotal ||
    left.name.localeCompare(right.name, "es")
  );
}

export interface TeamDayTotals {
  salesNotCalled: number;
  citasOverdue: number;
  orders: number;
  campaignTotal: number;
  attemptsToday: number;
  quotaDelivered: number;
  quotaTarget: number;
}

/** BR-003: el equipo en una línea; solo lo de hoy y caliente. */
export function sumTeamDay(
  members: readonly TeamMemberDaySummary[],
): TeamDayTotals {
  return members.reduce<TeamDayTotals>(
    (total, member) => ({
      salesNotCalled: total.salesNotCalled + member.salesNotCalled,
      citasOverdue: total.citasOverdue + member.citasOverdue,
      orders: total.orders + member.orders,
      campaignTotal: total.campaignTotal + member.campaignTotal,
      attemptsToday: total.attemptsToday + member.attemptsToday,
      quotaDelivered: total.quotaDelivered + member.quotaDelivered,
      quotaTarget: total.quotaTarget + member.quotaTarget,
    }),
    {
      salesNotCalled: 0,
      citasOverdue: 0,
      orders: 0,
      campaignTotal: 0,
      attemptsToday: 0,
      quotaDelivered: 0,
      quotaTarget: 0,
    },
  );
}
