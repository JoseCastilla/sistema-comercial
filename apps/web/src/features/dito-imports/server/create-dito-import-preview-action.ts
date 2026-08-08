"use server";

import { createHash, createHmac } from "node:crypto";

import { redirect } from "next/navigation";

import { requireAdminAccess } from "@/server/auth/access";

import type { DitoImportPreviewActionState } from "./dito-import-action.types";

const maximumFileBytes = 10 * 1024 * 1024;
const localDevelopmentSecret =
  "local-only-dito-import-secret-change-before-production";

interface PreviewResponse {
  batchId: string;
}

export async function createDitoImportPreviewAction(
  previousState: DitoImportPreviewActionState,
  formData: FormData,
): Promise<DitoImportPreviewActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { type: "error", message: "Selecciona un archivo XLSX de DITO." };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { type: "error", message: "El archivo debe tener extensión .xlsx." };
  }

  if (file.size > maximumFileBytes) {
    return { type: "error", message: "El archivo no puede superar 10 MB." };
  }

  const workbook = Buffer.from(await file.arrayBuffer());
  const resourceFingerprint = createHash("sha256")
    .update(workbook)
    .digest("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = getInternalSecret();
  const signature = createHmac("sha256", secret)
    .update(
      [
        timestamp,
        membership.organization.id,
        session.user.id,
        resourceFingerprint,
      ].join("\n"),
    )
    .digest("hex");
  const outbound = new FormData();
  outbound.set(
    "file",
    new Blob([workbook], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    file.name,
  );

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/internal/dito-import/preview`, {
      method: "POST",
      headers: {
        "x-dito-organization-id": membership.organization.id,
        "x-dito-actor-user-id": session.user.id,
        "x-dito-timestamp": timestamp,
        "x-dito-signature": signature,
      },
      body: outbound,
      cache: "no-store",
    });
  } catch {
    return {
      type: "error",
      message: "No se pudo contactar a la API local de importación.",
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isPreviewResponse(payload)) {
    return {
      type: "error",
      message: readApiError(payload) ?? "No se pudo analizar el archivo DITO.",
    };
  }

  redirect(`/admin/dito-imports?batch=${payload.batchId}`);
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

function isPreviewResponse(value: unknown): value is PreviewResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "batchId" in value &&
    typeof value.batchId === "string"
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
