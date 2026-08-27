"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";

import {
  getRecoveryApiBaseUrl,
  readRecoveryApiError,
  signRecoveryInternalRequest,
} from "./recovery-internal-request";

import type { RecoveryAdminActionState } from "./recovery-action.types";

export async function confirmRecoveryBaseAction(
  previousState: RecoveryAdminActionState,
  formData: FormData,
): Promise<RecoveryAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();

  const batchId = formData.get("batchId");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");

  if (typeof batchId !== "string" || batchId.length === 0) {
    return { type: "error", message: "El lote no es válido." };
  }

  if (
    typeof expectedUpdatedAt !== "string" ||
    Number.isNaN(new Date(expectedUpdatedAt).getTime())
  ) {
    return { type: "error", message: "La versión del lote no es válida." };
  }

  const resourceFingerprint = createHash("sha256")
    .update(batchId)
    .digest("hex");
  const { timestamp, signature } = signRecoveryInternalRequest({
    organizationId: membership.organization.id,
    actorUserId: session.user.id,
    resourceFingerprint,
  });

  let response: Response;

  try {
    response = await fetch(
      `${getRecoveryApiBaseUrl()}/internal/recovery-base/${batchId}/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-recovery-organization-id": membership.organization.id,
          "x-recovery-actor-user-id": session.user.id,
          "x-recovery-timestamp": timestamp,
          "x-recovery-signature": signature,
        },
        body: JSON.stringify({ expectedUpdatedAt }),
        cache: "no-store",
      },
    );
  } catch {
    return {
      type: "error",
      message: "No se pudo contactar a la API local de importación.",
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (response.status === 409) {
    return {
      type: "conflict",
      message:
        readRecoveryApiError(payload) ??
        "El lote cambió desde que lo abriste. Recarga la página.",
    };
  }

  if (!response.ok) {
    return {
      type: "error",
      message:
        readRecoveryApiError(payload) ?? "No se pudo confirmar el lote.",
    };
  }

  revalidatePath("/admin/recovery-base");
  revalidatePath("/recovery/triage");

  const summary =
    typeof payload === "object" && payload !== null
      ? (payload as { newCases?: number; sightingCases?: number })
      : {};

  return {
    type: "success",
    message: `Lote confirmado: ${summary.newCases ?? 0} casos nuevos y ${summary.sightingCases ?? 0} reapariciones registradas.`,
  };
}
