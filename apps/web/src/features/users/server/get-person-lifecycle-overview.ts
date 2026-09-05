import "server-only";

import { personLifecycleActionLabels } from "@repo/validation";

import { database } from "@/server/database";

import type {
  PersonLifecycleHistoryItem,
  PersonLifecycleOverview,
} from "./person-lifecycle.types";

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const openOrderStatuses = ["OPEN", "SENT", "UNKNOWN"] as const;
const openCaseStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

function describeSummary(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;

  const value = summary as Record<string, unknown>;
  const parts: string[] = [];
  const count = (key: string) =>
    typeof value[key] === "number" ? (value[key] as number) : 0;

  if (count("openOrders") > 0) {
    parts.push(`${count("openOrders")} venta(s) abiertas a su nombre`);
  }
  if (count("internalDelivered") > 0) {
    parts.push(
      `${count("internalDelivered")} caso(s) entregados a otro asesor`,
    );
  }
  if (count("internalReleased") > 0) {
    parts.push(`${count("internalReleased")} caso(s) sin responsable`);
  }
  if (count("campaignsToPool") > 0) {
    parts.push(`${count("campaignsToPool")} caso(s) de Campañas al pool`);
  }
  if (typeof value["teamName"] === "string") {
    parts.push(`equipo ${value["teamName"]}`);
  }
  if (typeof value["keepsSelling"] === "boolean") {
    parts.push(value["keepsSelling"] ? "sigue vendiendo" : "deja de vender");
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Lo que la baja tocaría de cada persona y lo que ya se le hizo, para toda
 * la organización de una vez: Personas lista a todos y no puede consultar
 * por fila.
 */
export async function getPersonLifecycleOverview(
  organizationId: string,
): Promise<{
  counts: Map<string, PersonLifecycleOverview>;
  history: Map<string, PersonLifecycleHistoryItem[]>;
}> {
  const [orders, cases, events] = await Promise.all([
    database.ditoOrder.groupBy({
      by: ["agentUserId"],
      where: {
        organizationId,
        agentUserId: { not: null },
        status: { in: [...openOrderStatuses] },
      },
      _count: { _all: true },
    }),
    database.recoveryCase.groupBy({
      by: ["assignedUserId", "source"],
      where: {
        organizationId,
        assignedUserId: { not: null },
        status: { in: [...openCaseStatuses] },
      },
      _count: { _all: true },
    }),
    database.personLifecycleEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        userId: true,
        action: true,
        reason: true,
        createdAt: true,
        releasedSummary: true,
        newValues: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  const counts = new Map<string, PersonLifecycleOverview>();
  const ensure = (userId: string) => {
    const current = counts.get(userId) ?? {
      openOrders: 0,
      internalCases: 0,
      campaignCases: 0,
    };
    counts.set(userId, current);
    return current;
  };

  for (const row of orders) {
    if (row.agentUserId) ensure(row.agentUserId).openOrders = row._count._all;
  }
  for (const row of cases) {
    if (!row.assignedUserId) continue;
    const entry = ensure(row.assignedUserId);
    if (row.source === "NATIONAL_BASE") {
      entry.campaignCases += row._count._all;
    } else {
      entry.internalCases += row._count._all;
    }
  }

  const history = new Map<string, PersonLifecycleHistoryItem[]>();
  for (const event of events) {
    const list = history.get(event.userId) ?? [];
    list.push({
      action: event.action,
      label: personLifecycleActionLabels[event.action],
      reason: event.reason,
      actorName: event.actor.name,
      createdAtLabel: dateTimeFormatter.format(event.createdAt),
      summary:
        describeSummary(event.releasedSummary) ??
        describeSummary(event.newValues),
    });
    history.set(event.userId, list);
  }

  return { counts, history };
}
