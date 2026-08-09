import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import "dotenv/config";

import { createPrismaClient } from "../dist/index.js";

const database = createPrismaClient();
let fixtureOrderId = null;

try {
  const targetMembership = await database.commercialTeamMember.findFirst({
    where: {
      memberRole: "AGENT",
      isActive: true,
      team: { status: "ACTIVE" },
      user: { status: "ACTIVE" },
    },
    select: {
      userId: true,
      teamId: true,
      team: { select: { organizationId: true } },
    },
  });

  assert.ok(
    targetMembership,
    "Se necesita un asesor activo dentro de un equipo activo para la prueba.",
  );

  const [template, actors] = await Promise.all([
    database.ditoOrder.findFirst({
      where: { organizationId: targetMembership.team.organizationId },
    }),
    database.organizationMember.findMany({
      where: { organizationId: targetMembership.team.organizationId },
      orderBy: { createdAt: "asc" },
      take: 2,
      select: { userId: true },
    }),
  ]);

  assert.ok(template, "Se necesita una orden local como plantilla de prueba.");
  assert.ok(
    actors[0],
    "Se necesita al menos un usuario para auditar la prueba.",
  );

  const templateData = Object.fromEntries(
    Object.entries(template).filter(
      ([key]) => !["id", "createdAt", "updatedAt"].includes(key),
    ),
  );
  const uniqueToken = randomUUID();
  const orderCode = `TEST-${uniqueToken.slice(0, 8).toUpperCase()}A`;
  const now = new Date();
  const fixture = await database.ditoOrder.create({
    data: {
      ...templateData,
      eventId: `test:orphan-claim:${uniqueToken}`,
      sourceFingerprint: createHash("sha256").update(uniqueToken).digest("hex"),
      orderCodeRaw: orderCode,
      orderCodeNormalized: orderCode,
      displayedOrderCode: orderCode,
      agentUserId: null,
      assignedTeamId: null,
      submitterInstallationId: null,
      submitterEmailRaw: null,
      submitterEmailNormalized: null,
      commercialServiceId: null,
      approvalUpdatedByUserId: null,
      deliveryShiftId: null,
      capturedAt: now,
      receivedAt: now,
      registeredAt: now,
      approvedAt: now,
    },
    select: { id: true, organizationId: true, updatedAt: true },
  });
  fixtureOrderId = fixture.id;

  async function claim(actorUserId) {
    return database.$transaction(async (transaction) => {
      const updated = await transaction.ditoOrder.updateMany({
        where: {
          id: fixture.id,
          organizationId: fixture.organizationId,
          updatedAt: fixture.updatedAt,
          agentUserId: null,
          assignedTeamId: null,
        },
        data: {
          agentUserId: targetMembership.userId,
          assignedTeamId: targetMembership.teamId,
        },
      });

      if (updated.count !== 1) return false;

      await transaction.ditoOrderAssignmentHistory.create({
        data: {
          organizationId: fixture.organizationId,
          ditoOrderId: fixture.id,
          previousAgentUserId: null,
          newAgentUserId: targetMembership.userId,
          previousTeamId: null,
          newTeamId: targetMembership.teamId,
          originalAgentNameRaw: template.agentNameRaw,
          originalAgentNameNormalized: template.agentNameNormalized,
          reason: "DATA_CORRECTION",
          observation: "Fixture de concurrencia autolimpiable.",
          source: "ORPHAN_CLAIM",
          performedByUserId: actorUserId,
          orderUpdatedAtBefore: fixture.updatedAt,
        },
      });

      return true;
    });
  }

  const results = await Promise.all([
    claim(actors[0].userId),
    claim(actors[1]?.userId ?? actors[0].userId),
  ]);
  assert.deepEqual(
    results.toSorted(),
    [false, true],
    "Exactamente una reclamación debe ganar la concurrencia.",
  );

  const [persisted, historyCount] = await Promise.all([
    database.ditoOrder.findUniqueOrThrow({
      where: { id: fixture.id },
      select: { agentUserId: true, assignedTeamId: true },
    }),
    database.ditoOrderAssignmentHistory.count({
      where: { ditoOrderId: fixture.id },
    }),
  ]);

  assert.equal(persisted.agentUserId, targetMembership.userId);
  assert.equal(persisted.assignedTeamId, targetMembership.teamId);
  assert.equal(
    historyCount,
    1,
    "Solo el reclamo ganador debe crear historial.",
  );

  console.log(
    "Concurrencia de orden huérfana verificada: un ganador y un conflicto.",
  );
} finally {
  if (fixtureOrderId) {
    await database.ditoOrder.delete({ where: { id: fixtureOrderId } });
  }

  await database.$disconnect();
}
