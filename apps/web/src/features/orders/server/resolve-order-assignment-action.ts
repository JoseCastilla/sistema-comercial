"use server";

import { revalidatePath } from "next/cache";

import { ditoOrderAssignmentRetrySchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { ResolveOrderAssignmentActionState } from "./resolve-order-assignment-action.types";

export async function resolveOrderAssignmentAction(
  previousState: ResolveOrderAssignmentActionState,
  formData: FormData,
): Promise<ResolveOrderAssignmentActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const parsed = ditoOrderAssignmentRetrySchema.safeParse({
    orderId: formData.get("orderId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return {
      type: "error",
      message: "La orden o su versión no son válidas. Recarga la bandeja.",
    };
  }

  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  const outcome = await database.$transaction(async (transaction) => {
    const order = await transaction.ditoOrder.findFirst({
      where: {
        id: parsed.data.orderId,
        organizationId: membership.organization.id,
        updatedAt: expectedUpdatedAt,
      },
      select: {
        id: true,
        agentNameRaw: true,
        agentNameNormalized: true,
        agentUserId: true,
        assignedTeamId: true,
        submitterEmailNormalized: true,
        updatedAt: true,
      },
    });

    if (!order) return { type: "CONFLICT" as const };

    if (order.agentUserId && order.assignedTeamId) {
      return { type: "ALREADY_ASSIGNED" as const };
    }

    if (
      order.agentUserId ||
      order.assignedTeamId ||
      !order.submitterEmailNormalized
    ) {
      return { type: "UNRESOLVED" as const };
    }

    const agentMembership = await transaction.organizationMember.findFirst({
      where: {
        organizationId: membership.organization.id,
        role: { in: ["AGENT", "SUPERVISOR"] },
        user: {
          email: {
            equals: order.submitterEmailNormalized,
            mode: "insensitive",
          },
          status: "ACTIVE",
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            name: true,
            commercialTeamMemberships: {
              where: {
                salesEnabled: true,
                isPrimary: true,
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              take: 2,
              select: {
                teamId: true,
                team: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const teamMemberships =
      agentMembership?.user.commercialTeamMemberships ?? [];
    const teamMembership = teamMemberships[0];

    if (!agentMembership || teamMemberships.length !== 1 || !teamMembership) {
      return { type: "UNRESOLVED" as const };
    }

    const updated = await transaction.ditoOrder.updateMany({
      where: {
        id: order.id,
        organizationId: membership.organization.id,
        updatedAt: expectedUpdatedAt,
        agentUserId: null,
        assignedTeamId: null,
      },
      data: {
        agentUserId: agentMembership.userId,
        assignedTeamId: teamMembership.teamId,
      },
    });

    if (updated.count !== 1) return { type: "CONFLICT" as const };

    await transaction.ditoOrderAssignmentHistory.create({
      data: {
        organizationId: membership.organization.id,
        ditoOrderId: order.id,
        previousAgentUserId: null,
        newAgentUserId: agentMembership.userId,
        previousTeamId: null,
        newTeamId: teamMembership.teamId,
        originalAgentNameRaw: order.agentNameRaw,
        originalAgentNameNormalized: order.agentNameNormalized,
        reason: "DATA_CORRECTION",
        observation: `Identidad corporativa recuperada por correo ${order.submitterEmailNormalized}.`,
        source: "MANUAL",
        performedByUserId: session.user.id,
        orderUpdatedAtBefore: order.updatedAt,
      },
    });

    return {
      type: "UPDATED" as const,
      agentName: agentMembership.user.name,
      teamName: teamMembership.team.name,
    };
  });

  if (outcome.type === "CONFLICT") {
    return {
      type: "conflict",
      message: "La orden cambió mientras se resolvía. Recarga la bandeja.",
    };
  }

  if (outcome.type === "ALREADY_ASSIGNED") {
    return {
      type: "success",
      message: "La orden ya tiene asesor y equipo asignados.",
    };
  }

  if (outcome.type === "UNRESOLVED") {
    return {
      type: "error",
      message:
        "El correo todavía no corresponde a un asesor activo con un único equipo principal activo.",
    };
  }

  revalidatePath("/orders");

  return {
    type: "success",
    message: `${outcome.agentName} quedó asignado a ${outcome.teamName}.`,
  };
}
