"use server";

import { createHash, createHmac } from "node:crypto";

import { redirect } from "next/navigation";

import { confirmDitoImportBatchSchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";

import type { DitoImportAdminActionState } from "./dito-import-action.types";

const localDevelopmentSecret =
  "local-only-dito-import-secret-change-before-production";

export async function confirmDitoImportAction(
  previousState: DitoImportAdminActionState,
  formData: FormData,
): Promise<DitoImportAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const parsed = confirmDitoImportBatchSchema.safeParse({
    batchId: formData.get("batchId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return {
      type: "error",
      message: "Esta página está desactualizada. Recárgala y vuelve a intentarlo.",
    };
  }

  const resourceFingerprint = createHash("sha256")
    .update(parsed.data.batchId)
    .digest("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", getInternalSecret())
    .update(
      [
        timestamp,
        membership.organization.id,
        session.user.id,
        resourceFingerprint,
      ].join("\n"),
    )
    .digest("hex");

  let response: Response;

  try {
    response = await fetch(
      `${getApiBaseUrl()}/internal/dito-import/${parsed.data.batchId}/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dito-organization-id": membership.organization.id,
          "x-dito-actor-user-id": session.user.id,
          "x-dito-timestamp": timestamp,
          "x-dito-signature": signature,
        },
        body: JSON.stringify({
          expectedUpdatedAt: parsed.data.expectedUpdatedAt,
        }),
        cache: "no-store",
      },
    );
  } catch {
    return {
      type: "error",
      message:
        "No pudimos procesar el archivo en este momento. Vuelve a intentarlo; si sigue igual, avisa a soporte.",
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isConfirmationResponse(payload)) {
    return {
      type: response.status === 409 ? "conflict" : "error",
      message:
        readApiError(payload) ?? "No se pudo confirmar la importación DITO.",
    };
  }

  redirect(`/admin/dito-imports?batch=${payload.batchId}&confirmed=1`);
}

function getApiBaseUrl(): string {
  return (
    process.env.DITO_IMPORT_API_URL ?? "http://127.0.0.1:3001/api/v1"
  ).replace(/\/$/, "");
}

function getInternalSecret(): string {
  const configured = process.env.DITO_IMPORT_INTERNAL_SECRET?.trim();

  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return localDevelopmentSecret;

  throw new Error("DITO_IMPORT_INTERNAL_SECRET no está configurado.");
}

function isConfirmationResponse(
  value: unknown,
): value is { batchId: string; status: "CONFIRMED" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "batchId" in value &&
    typeof value.batchId === "string" &&
    "status" in value &&
    value.status === "CONFIRMED"
  );
}

function readApiError(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return null;
}
