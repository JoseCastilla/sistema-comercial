"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import {
  encryptAgrSessionCookie,
  fetchAgrDeliveryRecord,
  runAgrDeliverySync,
} from "./agr-delivery-sync";

export interface AgrDeliveryActionState {
  type: "idle" | "success" | "error";
  message: string;
}

export async function saveAgrDeliveryCredentialAction(
  previousState: AgrDeliveryActionState,
  formData: FormData,
): Promise<AgrDeliveryActionState> {
  void previousState;
  const { session, membership } = await requireAdminAccess();
  const credential = String(formData.get("sessionCookie") ?? "").trim();
  if (
    credential.length < 20 ||
    credential.length > 1000 ||
    /\s/.test(credential)
  ) {
    return {
      type: "error",
      message: "La cookie de sesión no tiene un formato válido.",
    };
  }

  const testOrder = await database.ditoOrder.findFirst({
    where: {
      organizationId: membership.organization.id,
      registeredAt: { gte: new Date("2026-08-10T05:00:00.000Z") },
      status: { not: "CLOSED" },
      deliveryStatus: { not: "DELIVERED" },
    },
    orderBy: { registeredAt: "desc" },
    select: { orderCodeRaw: true },
  });
  if (!testOrder) {
    return {
      type: "error",
      message:
        "Primero carga una venta desde el 10/08 para probar la conexión.",
    };
  }

  try {
    await fetchAgrDeliveryRecord(credential, testOrder.orderCodeRaw);
    const now = new Date();
    const encryptedCredential = encryptAgrSessionCookie(credential);
    await database.agrDeliveryIntegration.upsert({
      where: { organizationId: membership.organization.id },
      create: {
        organizationId: membership.organization.id,
        encryptedSessionCookie: encryptedCredential,
        credentialHint: credential.slice(-4),
        credentialUpdatedById: session.user.id,
        credentialUpdatedAt: now,
        credentialStatus: "ACTIVE",
        lastValidatedAt: now,
      },
      update: {
        encryptedSessionCookie: encryptedCredential,
        credentialHint: credential.slice(-4),
        credentialUpdatedById: session.user.id,
        credentialUpdatedAt: now,
        credentialStatus: "ACTIVE",
        lastValidatedAt: now,
        lastError: null,
      },
    });
    revalidatePath("/admin/logistics");
    return {
      type: "success",
      message: "Conexión validada. La cookie quedó guardada de forma cifrada.",
    };
  } catch (error) {
    return {
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "No se pudo validar la cookie.",
    };
  }
}

export async function runAgrDeliverySyncAction(
  previousState: AgrDeliveryActionState,
): Promise<AgrDeliveryActionState> {
  void previousState;
  const { membership } = await requireAdminAccess();
  const result = await runAgrDeliverySync({
    organizationId: membership.organization.id,
    trigger: "MANUAL",
  });
  revalidatePath("/admin/logistics");
  revalidatePath("/orders");
  if (!result)
    return {
      type: "error",
      message: "Configura una cookie activa antes de sincronizar.",
    };
  if ("error" in result) {
    return {
      type: "error",
      message: result.error ?? "No se pudo completar la sincronización.",
    };
  }
  return {
    type: "success",
    message: `Sincronización completa: ${result.consulted} consultadas, ${result.opportunities} oportunidades.`,
  };
}
