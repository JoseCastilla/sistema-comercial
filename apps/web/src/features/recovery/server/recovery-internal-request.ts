import "server-only";

import { createHmac } from "node:crypto";

const localDevelopmentSecret =
  "local-only-recovery-base-secret-change-before-production";

export function getRecoveryApiBaseUrl(): string {
  return (
    process.env.DITO_IMPORT_API_URL ?? "http://127.0.0.1:3001/api/v1"
  ).replace(/\/$/, "");
}

export function signRecoveryInternalRequest(input: {
  organizationId: string;
  actorUserId: string;
  resourceFingerprint: string;
}): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", getInternalSecret())
    .update(
      [
        timestamp,
        input.organizationId,
        input.actorUserId,
        input.resourceFingerprint,
      ].join("\n"),
    )
    .digest("hex");

  return { timestamp, signature };
}

function getInternalSecret(): string {
  const configured = process.env.RECOVERY_BASE_INTERNAL_SECRET?.trim();

  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return localDevelopmentSecret;

  throw new Error("RECOVERY_BASE_INTERNAL_SECRET no está configurado.");
}

export function readRecoveryApiError(value: unknown): string | null {
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
