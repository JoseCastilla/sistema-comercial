import "dotenv/config";

import { createPrismaClient } from "../dist/index.js";

const database = createPrismaClient();

try {
  const [
    closedOrders,
    attributedClosures,
    invalidAuditPairs,
    pendingCancellationRequests,
    closureEvents,
  ] = await Promise.all([
    database.ditoOrder.count({ where: { status: "CLOSED" } }),
    database.ditoOrder.count({
      where: {
        status: "CLOSED",
        closedAt: { not: null },
        closedByUserId: { not: null },
      },
    }),
    database.ditoOrder.count({
      where: {
        OR: [
          { closedAt: null, closedByUserId: { not: null } },
          { closedAt: { not: null }, closedByUserId: null },
        ],
      },
    }),
    database.ditoOrderCancellationRequest.count({
      where: { status: "PENDING" },
    }),
    database.ditoOrderStatusHistory.findMany({
      where: {
        newStatus: "CLOSED",
        ditoOrder: { status: "CLOSED" },
      },
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
      select: {
        ditoOrderId: true,
        changedByUserId: true,
        ditoOrder: { select: { agentUserId: true } },
      },
    }),
  ]);

  const latestClosureByOrder = new Map();

  for (const event of closureEvents) {
    if (!latestClosureByOrder.has(event.ditoOrderId)) {
      latestClosureByOrder.set(event.ditoOrderId, event);
    }
  }

  const historicalSelfClosures = [...latestClosureByOrder.values()].filter(
    (event) =>
      event.ditoOrder.agentUserId !== null &&
      event.ditoOrder.agentUserId === event.changedByUserId,
  ).length;

  console.table([
    {
      closedOrders,
      attributedClosures,
      unattributedClosures: closedOrders - attributedClosures,
      historicalSelfClosures,
      pendingCancellationRequests,
      invalidAuditPairs,
    },
  ]);

  if (invalidAuditPairs > 0) {
    process.exitCode = 1;
  }
} finally {
  await database.$disconnect();
}
