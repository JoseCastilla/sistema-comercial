"use server";

import { createHash } from "node:crypto";

import { redirect } from "next/navigation";

import { requireAdminAccess } from "@/server/auth/access";

import {
  getRecoveryApiBaseUrl,
  readRecoveryApiError,
  signRecoveryInternalRequest,
} from "./recovery-internal-request";

import type { RecoveryPreviewActionState } from "./recovery-action.types";

const maximumFileBytes = 25 * 1024 * 1024;

interface PreviewResponse {
  batchId: string;
}

export async function createRecoveryBasePreviewAction(
  previousState: RecoveryPreviewActionState,
  formData: FormData,
): Promise<RecoveryPreviewActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return {
      type: "error",
      message: "Selecciona el archivo de la base consolidada (XLSX o CSV).",
    };
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".csv")) {
    return {
      type: "error",
      message: "El archivo debe tener extensión .xlsx o .csv.",
    };
  }

  if (file.size > maximumFileBytes) {
    return { type: "error", message: "El archivo no puede superar 25 MB." };
  }

  const workbook = await file.arrayBuffer();
  const resourceFingerprint = createHash("sha256")
    .update(new DataView(workbook))
    .digest("hex");
  const { timestamp, signature } = signRecoveryInternalRequest({
    organizationId: membership.organization.id,
    actorUserId: session.user.id,
    resourceFingerprint,
  });

  const outbound = new FormData();
  outbound.set(
    "file",
    new Blob([workbook], {
      type: lowerName.endsWith(".csv")
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    file.name,
  );

  let response: Response;

  try {
    response = await fetch(`${getRecoveryApiBaseUrl()}/internal/recovery-base/preview`, {
      method: "POST",
      headers: {
        "x-recovery-organization-id": membership.organization.id,
        "x-recovery-actor-user-id": session.user.id,
        "x-recovery-timestamp": timestamp,
        "x-recovery-signature": signature,
      },
      body: outbound,
      cache: "no-store",
    });
  } catch {
    return {
      type: "error",
      message:
        "No pudimos procesar el archivo en este momento. Vuelve a intentarlo; si sigue igual, avisa a soporte.",
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isPreviewResponse(payload)) {
    return {
      type: "error",
      message:
        readRecoveryApiError(payload) ??
        "No se pudo analizar la base consolidada.",
    };
  }

  redirect(`/admin/recovery-base?batch=${payload.batchId}`);
}

function isPreviewResponse(value: unknown): value is PreviewResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "batchId" in value &&
    typeof value.batchId === "string"
  );
}
