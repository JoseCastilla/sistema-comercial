"use server";

import { revalidatePath } from "next/cache";

import { ditoOrderCorrectionSchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { Prisma } from "@repo/database";
import type { OrderCorrectionActionState } from "./order-correction-action.types";

function readForm(
  formData: FormData,
): Record<string, FormDataEntryValue | null> {
  return {
    orderId: formData.get("orderId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    operationRaw: formData.get("operationRaw"),
    commercialOperation: formData.get("commercialOperation"),
    carrier: formData.get("carrier"),
    fixedCharge: formData.get("fixedCharge"),
    salesCode: formData.get("salesCode"),
    billingCycleDay: formData.get("billingCycleDay"),
    paymentDueDay: formData.get("paymentDueDay"),
    holderName: formData.get("holderName"),
    documentNumber: formData.get("documentNumber"),
    serviceNumber: formData.get("serviceNumber"),
    deliveryMethod: formData.get("deliveryMethod"),
    deliveryContactPhone: formData.get("deliveryContactPhone"),
    deliveryTimeRange: formData.get("deliveryTimeRange"),
    deliveryAddress: formData.get("deliveryAddress"),
    deliveryReference: formData.get("deliveryReference"),
    department: formData.get("department"),
    province: formData.get("province"),
    district: formData.get("district"),
    reason: formData.get("reason"),
  };
}

function flattenErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.map(String).join("."), issue.message]),
  );
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function documentType(documentNumber: string) {
  const digits = documentNumber.replace(/\D/g, "");

  if (digits.length === 8) return "DNI" as const;
  if (digits.length === 10) return "RUC_10" as const;

  return "OTHER" as const;
}

export async function correctOrderAction(
  previousState: OrderCorrectionActionState,
  formData: FormData,
): Promise<OrderCorrectionActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const result = ditoOrderCorrectionSchema.safeParse(readForm(formData));

  if (!result.success) {
    return {
      type: "error",
      message: "Revisa los campos de la corrección.",
      fieldErrors: flattenErrors(result.error.issues),
    };
  }

  const input = result.data;
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);

  const outcome = await database.$transaction(async (transaction) => {
    const current = await transaction.ditoOrder.findFirst({
      where: {
        id: input.orderId,
        organizationId: membership.organization.id,
        updatedAt: expectedUpdatedAt,
      },
      select: {
        id: true,
        operationRaw: true,
        commercialOperation: true,
        carrier: true,
        fixedCharge: true,
        salesCode: true,
        billingCycleDay: true,
        paymentDueDay: true,
        holderFullNameRaw: true,
        holderDocumentType: true,
        holderDocumentNumber: true,
        serviceNumber: true,
        deliveryMethod: true,
        deliveryContactPhone: true,
        deliveryTimeRangeRaw: true,
        deliveryAddress: true,
        deliveryReference: true,
        department: true,
        province: true,
        district: true,
        parseStatus: true,
        approvedAt: true,
      },
    });

    if (!current) return "CONFLICT" as const;

    const nextValues = {
      operationRaw: input.operationRaw,
      commercialOperation: input.commercialOperation,
      carrier: input.carrier,
      fixedCharge: input.fixedCharge,
      salesCode: input.salesCode,
      billingCycleDay: input.billingCycleDay,
      paymentDueDay: input.paymentDueDay,
      holderFullNameRaw: input.holderName,
      holderDocumentType: documentType(input.documentNumber),
      holderDocumentNumber: input.documentNumber.replace(/\D/g, ""),
      serviceNumber: input.serviceNumber.replace(/\D/g, ""),
      deliveryMethod: input.deliveryMethod,
      deliveryContactPhone: input.deliveryContactPhone.replace(/\D/g, ""),
      deliveryTimeRangeRaw: input.deliveryTimeRange,
      deliveryAddress: input.deliveryAddress,
      deliveryReference: input.deliveryReference,
      department: input.department,
      province: input.province,
      district: input.district,
      parseStatus: "PARSED" as const,
    };

    const expressDueAt =
      input.deliveryMethod === "EXPRESS"
        ? new Date(current.approvedAt.getTime() + 3 * 60 * 60 * 1000)
        : null;

    const updated = await transaction.ditoOrder.updateMany({
      where: {
        id: input.orderId,
        organizationId: membership.organization.id,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        ...nextValues,
        deliveryWindowStart:
          input.deliveryMethod === "EXPRESS" ? current.approvedAt : null,
        deliveryWindowEnd: expressDueAt,
        deliveryDueAt: expressDueAt,
      },
    });

    if (updated.count !== 1) return "CONFLICT" as const;

    await transaction.ditoOrderCorrection.create({
      data: {
        organizationId: membership.organization.id,
        ditoOrderId: current.id,
        source: "MANUAL_ADMIN",
        actorUserId: session.user.id,
        reason: input.reason,
        previousValues: jsonValue(current),
        newValues: jsonValue(nextValues),
      },
    });

    return "UPDATED" as const;
  });

  if (outcome === "CONFLICT") {
    return {
      type: "conflict",
      message:
        "La orden cambió mientras la editabas. Recarga antes de corregirla.",
    };
  }

  revalidatePath("/orders");

  return {
    type: "success",
    message: "Datos de la orden corregidos y auditados.",
  };
}
