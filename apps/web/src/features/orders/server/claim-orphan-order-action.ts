"use server";

import { revalidatePath } from "next/cache";

import {
  canClaimOrphanDitoOrder,
  ditoOrderOrphanClaimSchema,
} from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { ClaimOrphanOrderActionState } from "./claim-orphan-order-action.types";

export async function claimOrphanOrderAction(
  previousState: ClaimOrphanOrderActionState,
  formData: FormData,
): Promise<ClaimOrphanOrderActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();
  const parsed = ditoOrderOrphanClaimSchema.safeParse({
    orderId: formData.get("orderId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    teamId: formData.get("teamId"),
    agentUserId: formData.get("agentUserId"),
    reason: formData.get("reason"),
    observation: formData.get("observation") || undefined,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return {
      type: "error",
      message: "Revisa los datos de la asignación.",
      fieldErrors: {
        teamId: errors.teamId?.[0],
        agentUserId: errors.agentUserId?.[0],
        reason: errors.reason?.[0],
        observation: errors.observation?.[0],
      },
    };
  }

  if (membership.role !== "ADMIN" && membership.role !== "SUPERVISOR") {
    return {
      type: "error",
      message: "No tienes permiso para asignar esta orden.",
    };
  }

  try {
    const outcome = await database.$transaction(async (transaction) => {
      const supervisedTeamIds =
        membership.role === "SUPERVISOR"
          ? (
              await transaction.commercialTeamMember.findMany({
                where: {
                  userId: session.user.id,
                  memberRole: "SUPERVISOR",
                  isActive: true,
                  team: {
                    organizationId: membership.organization.id,
                    status: "ACTIVE",
                  },
                },
                select: { teamId: true },
              })
            ).map((teamMembership) => teamMembership.teamId)
          : [];

      const [order, agentMembership] = await Promise.all([
        transaction.ditoOrder.findFirst({
          where: {
            id: parsed.data.orderId,
            organizationId: membership.organization.id,
          },
          select: {
            id: true,
            orderCodeRaw: true,
            agentNameRaw: true,
            agentNameNormalized: true,
            agentUserId: true,
            assignedTeamId: true,
            updatedAt: true,
          },
        }),
        transaction.commercialTeamMember.findFirst({
          where: {
            teamId: parsed.data.teamId,
            userId: parsed.data.agentUserId,
            memberRole: "AGENT",
            isActive: true,
            team: {
              organizationId: membership.organization.id,
              status: "ACTIVE",
            },
            user: {
              status: "ACTIVE",
              memberships: {
                some: {
                  organizationId: membership.organization.id,
                  role: "AGENT",
                },
              },
            },
          },
          select: {
            userId: true,
            user: { select: { name: true } },
            team: { select: { id: true, name: true, status: true } },
          },
        }),
      ]);

      if (!order) return { type: "NOT_FOUND" as const };

      if (
        order.updatedAt.getTime() !==
        new Date(parsed.data.expectedUpdatedAt).getTime()
      ) {
        return { type: "CONFLICT" as const };
      }

      if (order.agentUserId !== null || order.assignedTeamId !== null) {
        return { type: "ALREADY_ASSIGNED" as const };
      }

      if (!agentMembership) return { type: "INVALID_TARGET" as const };

      const allowed = canClaimOrphanDitoOrder({
        role: membership.role,
        supervisedTeamIds,
        orderAgentUserId: order.agentUserId,
        orderAssignedTeamId: order.assignedTeamId,
        targetTeamId: agentMembership.team.id,
        targetTeamStatus: agentMembership.team.status,
      });

      if (!allowed) return { type: "FORBIDDEN" as const };

      const updated = await transaction.ditoOrder.updateMany({
        where: {
          id: order.id,
          organizationId: membership.organization.id,
          updatedAt: order.updatedAt,
          agentUserId: null,
          assignedTeamId: null,
        },
        data: {
          agentUserId: agentMembership.userId,
          assignedTeamId: agentMembership.team.id,
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
          newTeamId: agentMembership.team.id,
          originalAgentNameRaw: order.agentNameRaw,
          originalAgentNameNormalized: order.agentNameNormalized,
          reason: parsed.data.reason,
          observation: parsed.data.observation || null,
          source: "ORPHAN_CLAIM",
          performedByUserId: session.user.id,
          orderUpdatedAtBefore: order.updatedAt,
        },
      });

      const reviewedAt = new Date();
      await transaction.ditoOrderAssignmentRequest.updateMany({
        where: {
          organizationId: membership.organization.id,
          ditoOrderId: order.id,
          status: "PENDING",
          AND: [
            {
              OR: [
                { suggestedAgentUserId: null },
                { suggestedAgentUserId: agentMembership.userId },
              ],
            },
            {
              OR: [
                { suggestedTeamId: null },
                { suggestedTeamId: agentMembership.team.id },
              ],
            },
          ],
        },
        data: {
          status: "APPROVED",
          reviewedByUserId: session.user.id,
          reviewedAt,
          reviewComment:
            "Resuelta mediante asignación manual de orden huérfana.",
        },
      });

      await transaction.ditoOrderAssignmentRequest.updateMany({
        where: {
          organizationId: membership.organization.id,
          ditoOrderId: order.id,
          status: "PENDING",
        },
        data: {
          status: "CANCELLED",
          reviewedByUserId: session.user.id,
          reviewedAt,
          reviewComment: "La orden fue asignada manualmente a otro destino.",
        },
      });

      return {
        type: "UPDATED" as const,
        orderCode: order.orderCodeRaw,
        agentName: agentMembership.user.name,
        teamName: agentMembership.team.name,
      };
    });

    if (outcome.type === "NOT_FOUND") {
      return { type: "error", message: "La orden ya no está disponible." };
    }

    if (outcome.type === "CONFLICT") {
      return {
        type: "conflict",
        message: "La orden cambió mientras la asignabas. Recarga la bandeja.",
      };
    }

    if (outcome.type === "ALREADY_ASSIGNED") {
      return {
        type: "conflict",
        message: "La orden ya fue asignada por otro usuario.",
      };
    }

    if (outcome.type === "INVALID_TARGET") {
      return {
        type: "error",
        message: "El asesor no está activo en el equipo seleccionado.",
      };
    }

    if (outcome.type === "FORBIDDEN") {
      return {
        type: "error",
        message: "No tienes permiso para asignar órdenes a ese equipo.",
      };
    }

    revalidatePath("/orders");

    return {
      type: "success",
      message: `${outcome.orderCode} fue asignada a ${outcome.agentName} · ${outcome.teamName}.`,
    };
  } catch (error) {
    console.error("No se pudo reclamar la orden huérfana", error);

    return {
      type: "error",
      message: "No se pudo guardar la asignación. Inténtalo nuevamente.",
    };
  }
}
