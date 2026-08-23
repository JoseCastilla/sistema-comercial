"use server";

import { revalidatePath } from "next/cache";

import {
  canCreateDitoOrderEscalation,
  ditoOrderEscalationCreateSchema,
  resolveDitoOrderVisibility,
} from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { OrderEscalationActionState } from "./order-escalation-action.types";

class EscalationCreateError extends Error {}

export async function createOrderEscalationAction(
  previousState: OrderEscalationActionState,
  formData: FormData,
): Promise<OrderEscalationActionState> {
  void previousState;
  const { session, membership } = await requireCommercialAccess();
  const parsed = ditoOrderEscalationCreateSchema.safeParse({
    orderId: formData.get("orderId"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    templateType: formData.get("templateType"),
    description: formData.get("description"),
    requestedAction: formData.get("requestedAction"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      type: "error",
      message: "Revisa los datos de la incidencia.",
      fieldErrors: {
        category: errors.category?.[0],
        priority: errors.priority?.[0],
        description: errors.description?.[0],
        requestedAction: errors.requestedAction?.[0],
      },
    };
  }

  try {
    const orderCode = await database.$transaction(async (transaction) => {
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
            ).map((item) => item.teamId)
          : [];
      const salesEnabled =
        membership.role === "SUPERVISOR" &&
        (await transaction.commercialTeamMember.count({
          where: {
            userId: session.user.id,
            salesEnabled: true,
            isPrimary: true,
            isActive: true,
            team: {
              organizationId: membership.organization.id,
              status: "ACTIVE",
            },
          },
        })) > 0;
      const order = await transaction.ditoOrder.findFirst({
        where: {
          id: parsed.data.orderId,
          organizationId: membership.organization.id,
        },
        select: {
          id: true,
          orderCodeRaw: true,
          agentUserId: true,
          assignedTeamId: true,
          deliveryMethod: true,
          deliveryContactPhone: true,
          department: true,
          province: true,
          district: true,
          deliveryWindowStart: true,
          deliveryWindowEnd: true,
          updatedAt: true,
          escalations: {
            where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!order)
        throw new EscalationCreateError("La orden no está disponible.");

      const visibility = resolveDitoOrderVisibility({
        role: membership.role,
        userId: session.user.id,
        supervisedTeamIds,
        orderAgentUserId: order.agentUserId,
        orderAssignedTeamId: order.assignedTeamId,
        salesEnabled,
      });
      if (
        !canCreateDitoOrderEscalation({
          role: membership.role,
          visibility,
          isSalesOwner: order.agentUserId === session.user.id,
          assignedTeamId: order.assignedTeamId,
          hasActiveEscalation: order.escalations.length > 0,
        })
      ) {
        throw new EscalationCreateError(
          order.escalations.length > 0
            ? "Esta venta ya tiene una incidencia activa."
            : "No tienes permiso para escalar esta venta.",
        );
      }

      const supervisorCount = await transaction.commercialTeamMember.count({
        where: {
          teamId: order.assignedTeamId!,
          memberRole: "SUPERVISOR",
          isActive: true,
          user: { status: "ACTIVE" },
        },
      });
      if (supervisorCount === 0) {
        throw new EscalationCreateError(
          "Tu equipo no tiene un supervisor activo asignado.",
        );
      }

      const createdAt = new Date();
      const category =
        parsed.data.templateType === "LOGISTICS_NOT_MANAGED" ||
        parsed.data.templateType === "ORDER_NOT_CLOSED"
          ? "DELIVERY_LOGISTICS"
          : parsed.data.templateType === "PORTABILITY_DATE_MISSING" ||
              parsed.data.templateType === "BAG_CORRECTION"
            ? "ACTIVATION_PAYMENT"
            : parsed.data.category;
      await transaction.deliveryEscalation.create({
        data: {
          organizationId: membership.organization.id,
          ditoOrderId: order.id,
          category,
          priority: parsed.data.priority,
          tdpTemplateType: parsed.data.templateType,
          observation: parsed.data.description,
          requestedAction: parsed.data.requestedAction,
          generatedMessage: `${session.user.name} escaló la orden ${order.orderCodeRaw}.`,
          teamIdSnapshot: order.assignedTeamId,
          orderCodeRawSnapshot: order.orderCodeRaw,
          deliveryMethodSnapshot: order.deliveryMethod,
          contactPhoneSnapshot: order.deliveryContactPhone,
          departmentSnapshot: order.department,
          provinceSnapshot: order.province,
          districtSnapshot: order.district,
          deliveryWindowStartSnapshot: order.deliveryWindowStart,
          deliveryWindowEndSnapshot: order.deliveryWindowEnd,
          createdByUserId: session.user.id,
          createdAt,
        },
      });
      const touched = await transaction.ditoOrder.updateMany({
        where: {
          id: order.id,
          organizationId: membership.organization.id,
          updatedAt: order.updatedAt,
        },
        data: { updatedAt: createdAt },
      });
      if (touched.count !== 1) {
        throw new EscalationCreateError(
          "La orden cambió durante el registro. Recarga la bandeja.",
        );
      }
      return order.orderCodeRaw;
    });

    revalidatePath("/orders");
    return {
      type: "success",
      message: `Incidencia de ${orderCode} enviada al supervisor.`,
    };
  } catch (error) {
    if (error instanceof EscalationCreateError) {
      return { type: "conflict", message: error.message };
    }
    console.error("No se pudo escalar la incidencia", error);
    return {
      type: "error",
      message: "No se pudo enviar la incidencia. Inténtalo nuevamente.",
    };
  }
}
