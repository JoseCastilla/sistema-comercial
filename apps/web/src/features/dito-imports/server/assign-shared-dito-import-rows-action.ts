"use server";

import { revalidatePath } from "next/cache";

import { assignSharedDitoImportRowsSchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { DitoImportAdminActionState } from "./dito-import-action.types";

export async function assignSharedDitoImportRowsAction(
  previousState: DitoImportAdminActionState,
  formData: FormData,
): Promise<DitoImportAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const batchId = formData.get("batchId");
  const rowIds = formData
    .getAll("rowId")
    .filter((value): value is string => typeof value === "string");
  const assignments = rowIds.flatMap((rowId) => {
    const userId = formData.get(`agent:${rowId}`);
    const expectedUpdatedAt = formData.get(`version:${rowId}`);

    return typeof userId === "string" &&
      userId.length > 0 &&
      typeof expectedUpdatedAt === "string"
      ? [{ rowId, userId, expectedUpdatedAt }]
      : [];
  });
  const parsed = assignSharedDitoImportRowsSchema.safeParse({
    batchId,
    assignments,
  });

  if (!parsed.success) {
    return {
      type: "error",
      message: "Selecciona al menos una venta y un asesor válido.",
    };
  }

  const result = await database.$transaction(async (transaction) => {
    const agentMembers = await transaction.organizationMember.findMany({
      where: {
        organizationId: membership.organization.id,
        role: "AGENT",
        userId: { in: parsed.data.assignments.map((item) => item.userId) },
        user: { status: "ACTIVE" },
      },
      select: {
        userId: true,
        user: {
          select: {
            commercialTeamMemberships: {
              where: {
                memberRole: "AGENT",
                isPrimary: true,
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              take: 2,
              select: { teamId: true },
            },
          },
        },
      },
    });
    const teamsByUser = new Map(
      agentMembers.flatMap((member) => {
        const teams = member.user.commercialTeamMemberships;

        return teams.length === 1 && teams[0]
          ? [[member.userId, teams[0].teamId] as const]
          : [];
      }),
    );

    if (
      teamsByUser.size !==
      new Set(parsed.data.assignments.map((item) => item.userId)).size
    ) {
      return { type: "INVALID_AGENT" as const };
    }

    const assignedAt = new Date();

    for (const assignment of parsed.data.assignments) {
      const teamId = teamsByUser.get(assignment.userId);

      if (!teamId) return { type: "INVALID_AGENT" as const };

      const updated = await transaction.ditoImportRow.updateMany({
        where: {
          id: assignment.rowId,
          batchId: parsed.data.batchId,
          organizationId: membership.organization.id,
          classification: { notIn: ["EXCLUDED", "INVALID"] },
          updatedAt: new Date(assignment.expectedUpdatedAt),
          agentIdentity: { isSharedAccount: true, isActive: true },
          batch: { status: { in: ["PREVIEW", "READY", "FAILED"] } },
          OR: [
            { targetDitoOrderId: null },
            {
              targetOrder: {
                agentUserId: null,
                assignedTeamId: null,
              },
            },
          ],
        },
        data: {
          manualAgentUserId: assignment.userId,
          manualTeamId: teamId,
          manualAssignedByUserId: session.user.id,
          manualAssignedAt: assignedAt,
          manualAssignmentReason: "SHARED_DITO_ACCOUNT",
        },
      });

      if (updated.count !== 1) return { type: "CONFLICT" as const };
    }

    return { type: "SUCCESS" as const, count: parsed.data.assignments.length };
  });

  if (result.type === "INVALID_AGENT") {
    return {
      type: "error",
      message: "Cada asesor debe tener un único equipo principal activo.",
    };
  }
  if (result.type === "CONFLICT") {
    return {
      type: "conflict",
      message: "Una venta cambió mientras la revisabas. Recarga la página.",
    };
  }

  revalidatePath("/admin/dito-imports");

  return {
    type: "success",
    message: `${result.count} ${result.count === 1 ? "venta asignada" : "ventas asignadas"}.`,
  };
}
