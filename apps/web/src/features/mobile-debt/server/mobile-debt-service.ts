import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { database } from "@/server/database";

import {
  buildMobileDebtRequest,
  getOrderPeriodRange,
  parseMobileDebtResponse,
} from "@repo/validation";

import type {
  MobileDebtCredentialView,
  MobileDebtStats,
} from "../mobile-debt.types";
import type { MobileDebtOperator } from "@repo/validation";

const endpoint = "https://venta.reddigital.pe/rdventa/home/sendEngineTx";

interface RedDigitalCredentials {
  jSessionId: string;
  cidSb: string;
  captcha: string;
  csrfToken: string;
}

export type MobileDebtFailureCode =
  | "CONFIGURATION"
  | "CREDENTIAL_EXPIRED"
  | "UPSTREAM"
  | "REJECTED"
  | "INVALID_RESPONSE";

export class MobileDebtError extends Error {
  constructor(
    public readonly code: MobileDebtFailureCode,
    message: string,
  ) {
    super(message);
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.RED_DIGITAL_ENCRYPTION_KEY?.trim();
  if (configured) {
    if (/^[a-f\d]{64}$/i.test(configured))
      return Buffer.from(configured, "hex");
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
    throw new Error("RED_DIGITAL_ENCRYPTION_KEY debe contener 32 bytes.");
  }
  if (process.env.NODE_ENV !== "production") {
    return createHash("sha256")
      .update("local-only-red-digital-encryption-key")
      .digest();
  }
  throw new Error("RED_DIGITAL_ENCRYPTION_KEY no está configurada.");
}

export function encryptRedDigitalCredentials(
  credentials: RedDigitalCredentials,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptRedDigitalCredentials(value: string): RedDigitalCredentials {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw)
    throw new Error("Credencial inválida.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const payload = JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as unknown;
  if (!isCredentials(payload)) throw new Error("Credencial inválida.");
  return payload;
}

export async function getMobileDebtOverview(input: {
  organizationId: string;
  actorUserId: string;
}): Promise<MobileDebtStats> {
  const today = getOrderPeriodRange("TODAY");
  const month = getOrderPeriodRange("MONTH");
  const where = {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  };
  const [todayCount, monthCount] = await Promise.all([
    database.mobileDebtLookupEvent.count({
      where: { ...where, queriedAt: { gte: today.start!, lt: today.end! } },
    }),
    database.mobileDebtLookupEvent.count({
      where: { ...where, queriedAt: { gte: month.start!, lt: month.end! } },
    }),
  ]);
  return { today: todayCount, month: monthCount };
}

export async function getMobileDebtCredentialView(
  organizationId: string,
): Promise<MobileDebtCredentialView> {
  const integration = await database.mobileDebtIntegration.findUnique({
    where: { organizationId },
    select: {
      credentialStatus: true,
      credentialHint: true,
      credentialUpdatedAt: true,
      lastSuccessAt: true,
      credentialUpdatedBy: { select: { name: true } },
    },
  });
  if (!integration) {
    return {
      configured: false,
      status: null,
      hint: null,
      updatedAt: null,
      updatedBy: null,
      lastSuccessAt: null,
    };
  }
  return {
    configured: true,
    status: integration.credentialStatus,
    hint: integration.credentialHint,
    updatedAt: integration.credentialUpdatedAt.toISOString(),
    updatedBy: integration.credentialUpdatedBy.name,
    lastSuccessAt: integration.lastSuccessAt?.toISOString() ?? null,
  };
}

export async function saveRedDigitalCredentials(input: {
  organizationId: string;
  actorUserId: string;
  credentials: RedDigitalCredentials;
}): Promise<void> {
  const now = new Date();
  await database.mobileDebtIntegration.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      encryptedCredentials: encryptRedDigitalCredentials(input.credentials),
      credentialHint: input.credentials.jSessionId.slice(-4),
      credentialUpdatedById: input.actorUserId,
      credentialUpdatedAt: now,
      credentialStatus: "ACTIVE",
    },
    update: {
      encryptedCredentials: encryptRedDigitalCredentials(input.credentials),
      credentialHint: input.credentials.jSessionId.slice(-4),
      credentialUpdatedById: input.actorUserId,
      credentialUpdatedAt: now,
      credentialStatus: "ACTIVE",
      lastError: null,
    },
  });
}

export async function lookupMobileDebt(input: {
  organizationId: string;
  actorUserId: string;
  operator: MobileDebtOperator;
  phone: string;
}) {
  const integration = await database.mobileDebtIntegration.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!integration) {
    await auditFailure(input, null, "CONFIGURATION");
    throw new MobileDebtError(
      "CONFIGURATION",
      "La conexión aún no está configurada.",
    );
  }

  try {
    const credentials = decryptRedDigitalCredentials(
      integration.encryptedCredentials,
    );
    const payload = await fetchMobileDebt(
      input.operator,
      input.phone,
      credentials,
    );
    const parsed = parseMobileDebtResponse(
      payload,
      input.operator,
      input.phone,
    );
    if (!parsed.ok) {
      throw new MobileDebtError(
        parsed.reason,
        parsed.reason === "REJECTED"
          ? "El operador no devolvió una deuda para esta línea."
          : "El proveedor devolvió una respuesta que no se puede validar.",
      );
    }

    const now = new Date();
    await database.$transaction([
      database.mobileDebtLookupEvent.create({
        data: {
          organizationId: input.organizationId,
          mobileDebtIntegrationId: integration.id,
          actorUserId: input.actorUserId,
          operator: input.operator,
          phone: input.phone,
          status: "SUCCESS",
          customerName: parsed.result.customerName,
          debtAmount: parsed.result.debtAmount,
          dueDateRaw: parsed.result.dueDateRaw,
        },
      }),
      database.mobileDebtIntegration.update({
        where: { id: integration.id },
        data: {
          credentialStatus: "ACTIVE",
          lastValidatedAt: now,
          lastAttemptAt: now,
          lastSuccessAt: now,
          lastError: null,
        },
      }),
    ]);
    return { ...parsed.result, queriedAt: now };
  } catch (error) {
    const safe = normalizeLookupError(error);
    await database.$transaction([
      database.mobileDebtLookupEvent.create({
        data: {
          organizationId: input.organizationId,
          mobileDebtIntegrationId: integration.id,
          actorUserId: input.actorUserId,
          operator: input.operator,
          phone: input.phone,
          status: "FAILED",
          errorCode: safe.code,
        },
      }),
      database.mobileDebtIntegration.update({
        where: { id: integration.id },
        data: {
          credentialStatus:
            safe.code === "CREDENTIAL_EXPIRED"
              ? "EXPIRED"
              : safe.code === "REJECTED"
                ? "ACTIVE"
                : "ERROR",
          ...(safe.code === "REJECTED" ? { lastValidatedAt: new Date() } : {}),
          lastAttemptAt: new Date(),
          lastError: safe.message,
        },
      }),
    ]);
    throw safe;
  }
}

async function fetchMobileDebt(
  operator: MobileDebtOperator,
  phone: string,
  credentials: RedDigitalCredentials,
): Promise<unknown> {
  const request = buildMobileDebtRequest(operator, phone);
  const body = new URLSearchParams({
    req_data: request.reqData,
    csrft: credentials.csrfToken,
  });
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://venta.reddigital.pe",
        referer: "https://venta.reddigital.pe/rdventa/home/index",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
        cookie: `JSESSIONID=${credentials.jSessionId}; CIDSB=${credentials.cidSb}; captcha=${credentials.captcha}`,
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MobileDebtError(
      "UPSTREAM",
      "No se pudo contactar el servicio de deuda.",
    );
  }

  if ([301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
    throw new MobileDebtError(
      "CREDENTIAL_EXPIRED",
      "La sesión de Red Digital venció.",
    );
  }
  if (!response.ok) {
    throw new MobileDebtError(
      "UPSTREAM",
      `El servicio de deuda respondió ${response.status}.`,
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) {
    throw new MobileDebtError(
      "CREDENTIAL_EXPIRED",
      "La sesión de Red Digital venció.",
    );
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new MobileDebtError(
      "INVALID_RESPONSE",
      "El servicio devolvió una respuesta ilegible.",
    );
  }
}

async function auditFailure(
  input: {
    organizationId: string;
    actorUserId: string;
    operator: MobileDebtOperator;
    phone: string;
  },
  integrationId: string | null,
  errorCode: MobileDebtFailureCode,
) {
  await database.mobileDebtLookupEvent.create({
    data: {
      organizationId: input.organizationId,
      mobileDebtIntegrationId: integrationId,
      actorUserId: input.actorUserId,
      operator: input.operator,
      phone: input.phone,
      status: "FAILED",
      errorCode,
    },
  });
}

function normalizeLookupError(error: unknown): MobileDebtError {
  if (error instanceof MobileDebtError) return error;
  return new MobileDebtError(
    "CONFIGURATION",
    "No se pudo usar la configuración segura del servicio.",
  );
}

function isCredentials(value: unknown): value is RedDigitalCredentials {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return [
    record.jSessionId,
    record.cidSb,
    record.captcha,
    record.csrfToken,
  ].every((item) => typeof item === "string" && item.length > 0);
}
