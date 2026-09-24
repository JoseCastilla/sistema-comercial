/**
 * Resultados campaña vs base (SPEC-061 BR-021, adaptado al MVP). Función pura:
 * recibe oportunidades de la cohorte (por fecha de apertura) con sus pedidos
 * y los pedidos sin oportunidad del período, y devuelve la tabla
 * origen × relación con totales por grupo.
 */
import type { ContactOrigin, CustomerRelation, OpportunityStage, OrderStatus } from "@/generated/prisma/enums";

import { reachedQualified } from "./rules";

export interface ResultOrder {
  status: OrderStatus;
  fixedCharge: number | null;
}

export interface ResultOpportunity {
  origin: ContactOrigin;
  relation: CustomerRelation;
  stage: OpportunityStage;
  /** Etapas por las que pasó (detalle `to` de los eventos STAGE_CHANGED). */
  stagesVisited: OpportunityStage[];
  orders: ResultOrder[];
}

export interface ResultFigures {
  opportunities: number;
  qualified: number;
  won: number;
  lost: number;
  ordersEntered: number;
  ordersDelivered: number;
  ordersActivated: number;
  ordersCancelled: number;
  amountOrdered: number;
  amountConfirmed: number;
  amountSold: number;
}

export interface ResultRow extends ResultFigures {
  origin: ContactOrigin;
  /** Nulo en la fila de pedidos sin oportunidad. */
  relation: CustomerRelation | null;
}

export type ResultGroup = "CAMPAIGN" | "BASE" | "UNKNOWN";

export const GROUP_LABELS: Record<ResultGroup, string> = { CAMPAIGN: "Campaña", BASE: "Base", UNKNOWN: "Desconocido" };

export const GROUP_ORIGINS: Record<ResultGroup, ContactOrigin[]> = {
  CAMPAIGN: ["AD", "BROADCAST"],
  BASE: ["ADVISOR", "REFERRAL", "ORGANIC"],
  UNKNOWN: ["UNKNOWN"],
};

export function groupOf(origin: ContactOrigin): ResultGroup {
  if (GROUP_ORIGINS.CAMPAIGN.includes(origin)) return "CAMPAIGN";
  if (GROUP_ORIGINS.BASE.includes(origin)) return "BASE";
  return "UNKNOWN";
}

export function emptyFigures(): ResultFigures {
  return {
    opportunities: 0,
    qualified: 0,
    won: 0,
    lost: 0,
    ordersEntered: 0,
    ordersDelivered: 0,
    ordersActivated: 0,
    ordersCancelled: 0,
    amountOrdered: 0,
    amountConfirmed: 0,
    amountSold: 0,
  };
}

function addOrder(figures: ResultFigures, order: ResultOrder) {
  const amount = order.fixedCharge ?? 0;
  figures.ordersEntered += 1;
  figures.amountOrdered += amount;
  if (order.status === "ENTREGADO" || order.status === "ACTIVADO") {
    figures.ordersDelivered += 1;
    figures.amountConfirmed += amount;
  }
  if (order.status === "ACTIVADO") {
    figures.ordersActivated += 1;
    figures.amountSold += amount;
  }
  if (order.status === "CANCELADO") figures.ordersCancelled += 1;
}

export function addFigures(target: ResultFigures, source: ResultFigures) {
  for (const key of Object.keys(target) as (keyof ResultFigures)[]) target[key] += source[key];
}

export function buildResults(input: { opportunities: ResultOpportunity[]; unlinkedOrders: ResultOrder[] }): {
  rows: ResultRow[];
  groups: Record<ResultGroup, ResultFigures>;
  total: ResultFigures;
} {
  const rows = new Map<string, ResultRow>();
  const rowFor = (origin: ContactOrigin, relation: CustomerRelation | null) => {
    const key = `${origin}:${relation ?? "-"}`;
    let row = rows.get(key);
    if (!row) {
      row = { origin, relation, ...emptyFigures() };
      rows.set(key, row);
    }
    return row;
  };

  for (const opportunity of input.opportunities) {
    const row = rowFor(opportunity.origin, opportunity.relation);
    row.opportunities += 1;
    if (reachedQualified(opportunity.stage) || opportunity.stagesVisited.some(reachedQualified)) row.qualified += 1;
    if (opportunity.stage === "GANADA") row.won += 1;
    if (opportunity.stage === "PERDIDA") row.lost += 1;
    for (const order of opportunity.orders) addOrder(row, order);
  }
  if (input.unlinkedOrders.length > 0) {
    const row = rowFor("UNKNOWN", null);
    for (const order of input.unlinkedOrders) addOrder(row, order);
  }

  const groups: Record<ResultGroup, ResultFigures> = { CAMPAIGN: emptyFigures(), BASE: emptyFigures(), UNKNOWN: emptyFigures() };
  const total = emptyFigures();
  for (const row of rows.values()) {
    addFigures(groups[groupOf(row.origin)], row);
    addFigures(total, row);
  }

  const originOrder: ContactOrigin[] = ["AD", "BROADCAST", "ADVISOR", "REFERRAL", "ORGANIC", "UNKNOWN"];
  const relationOrder = ["NEW", "EXISTING", null];
  const sorted = [...rows.values()].sort(
    (a, b) => originOrder.indexOf(a.origin) - originOrder.indexOf(b.origin) || relationOrder.indexOf(a.relation) - relationOrder.indexOf(b.relation),
  );
  return { rows: sorted, groups, total };
}
