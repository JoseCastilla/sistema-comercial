import type { PerformanceOrderInput } from "@repo/validation";

/**
 * Proyecta un pedido leído de Prisma a la entrada de las métricas de
 * rendimiento. Vivía idéntico en el tablero y en la conciliación (SPEC-037).
 */
export function toMetricInput(
  order: PerformanceOrderInput,
): PerformanceOrderInput {
  return {
    commercialOperation: order.commercialOperation,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    sentSubstatus: order.sentSubstatus,
    registeredAt: order.registeredAt,
    deliveredAt: order.deliveredAt,
    closedAt: order.closedAt,
    agentUserId: order.agentUserId,
    assignedTeamId: order.assignedTeamId,
  };
}
