"use server";

import { revalidatePath } from "next/cache";

import { resolveDitoOrderVisibility } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { SaleOriginActionState } from "./set-sale-origin-action.types";

const origins = ["BASE", "CAMPAIGN", "OTHER"] as const;
type SaleOrigin = (typeof origins)[number];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SPEC-083: anotar de dónde salió la venta. Lo puede hacer quien ve el
 * pedido completo (el mismo alcance que el seguimiento), en cualquier
 * estado. Queda quién y cuándo.
 */
export async function setSaleOriginAction(
  previousState: SaleOriginActionState,
  formData: FormData,
): Promise<SaleOriginActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();
  const orderId = String(formData.get("orderId") ?? "");
  const origin = String(formData.get("origin") ?? "");

  if (!uuidPattern.test(orderId) || !origins.includes(origin as SaleOrigin)) {
    return { type: "error", message: "Elige el origen de la venta." };
  }

  const organizationId = membership.organization.id;
  const [supervisedTeams, primarySalesMembership, order] = await Promise.all([
    membership.role === "SUPERVISOR"
      ? database.commercialTeamMember.findMany({
          where: {
            userId: session.user.id,
            memberRole: "SUPERVISOR",
            isActive: true,
            team: { organizationId, status: "ACTIVE" },
          },
          select: { teamId: true },
        })
      : Promise.resolve([]),
    membership.role === "SUPERVISOR"
      ? database.commercialTeamMember.findFirst({
          where: {
            userId: session.user.id,
            salesEnabled: true,
            isPrimary: true,
            isActive: true,
            team: { organizationId, status: "ACTIVE" },
          },
          select: { teamId: true },
        })
      : Promise.resolve(null),
    database.ditoOrder.findFirst({
      where: { id: orderId, organizationId },
      select: { id: true, agentUserId: true, assignedTeamId: true },
    }),
  ]);

  if (!order) {
    return { type: "error", message: "El pedido no existe." };
  }

  const visibility = resolveDitoOrderVisibility({
    role: membership.role,
    userId: session.user.id,
    supervisedTeamIds: supervisedTeams.map((team) => team.teamId),
    orderAgentUserId: order.agentUserId,
    orderAssignedTeamId: order.assignedTeamId,
    salesEnabled: primarySalesMembership !== null,
  });

  if (visibility !== "FULL") {
    return {
      type: "error",
      message: "No puedes cambiar el origen de este pedido.",
    };
  }

  await database.ditoOrder.update({
    where: { id: order.id },
    data: {
      saleOrigin: origin as SaleOrigin,
      saleOriginSetAt: new Date(),
      saleOriginSetByUserId: session.user.id,
    },
  });

  revalidatePath("/orders");
  return { type: "success", message: "Origen guardado." };
}
