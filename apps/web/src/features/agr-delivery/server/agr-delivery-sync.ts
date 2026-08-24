import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";

const endpoint = "https://agr-delivery.afreddyp.workers.dev/api/records";
const eligibleSince = new Date("2026-08-10T05:00:00.000Z");
const terminalExternalStatuses = ["ENTREGADO", "CERRADO"];

export interface AgrDeliveryRecord {
  pedido: string | null;
  order_id: string;
  envio: string | null;
  estado_pedido: string;
  motivo_rechazo: string | null;
  submotivo_rechazo: string | null;
  fecha_entrega_pactada: string | null;
  fecha_entrega_real: string | null;
  fecha_toma_pedido: string | null;
  tipo_delivery: string | null;
  vendedor: string | null;
  nombre_vendedor: string | null;
  gestion_status: string | null;
  resultado: string | null;
  proxima_accion: string | null;
  fecha_compromiso: string | null;
  gestion_updated_at: string | null;
  updated_by_name: string | null;
  [key: string]: unknown;
}

interface AgrDeliveryResponse {
  ok: true;
  records: AgrDeliveryRecord[];
}

export class AgrCredentialError extends Error {}

function encryptionKey(): Buffer {
  const configured = process.env.AGR_DELIVERY_ENCRYPTION_KEY?.trim();
  if (configured) {
    if (/^[a-f\d]{64}$/i.test(configured))
      return Buffer.from(configured, "hex");
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
    throw new Error("AGR_DELIVERY_ENCRYPTION_KEY debe contener 32 bytes.");
  }
  if (process.env.NODE_ENV !== "production") {
    return createHash("sha256")
      .update("local-only-agr-delivery-encryption-key")
      .digest();
  }
  throw new Error("AGR_DELIVERY_ENCRYPTION_KEY no está configurada.");
}

export function encryptAgrSessionCookie(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptAgrSessionCookie(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw)
    throw new Error("Credencial inválida.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseRecord(value: unknown): AgrDeliveryRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const orderId = readString(raw.order_id);
  const status = readString(raw.estado_pedido);
  if (!orderId || !status) return null;
  return {
    ...raw,
    pedido: readString(raw.pedido),
    order_id: orderId,
    envio: readString(raw.envio),
    estado_pedido: status,
    motivo_rechazo: readString(raw.motivo_rechazo),
    submotivo_rechazo: readString(raw.submotivo_rechazo),
    fecha_entrega_pactada: readString(raw.fecha_entrega_pactada),
    fecha_entrega_real: readString(raw.fecha_entrega_real),
    fecha_toma_pedido: readString(raw.fecha_toma_pedido),
    tipo_delivery: readString(raw.tipo_delivery),
    vendedor: readString(raw.vendedor),
    nombre_vendedor: readString(raw.nombre_vendedor),
    gestion_status: readString(raw.gestion_status),
    resultado: readString(raw.resultado),
    proxima_accion: readString(raw.proxima_accion),
    fecha_compromiso: readString(raw.fecha_compromiso),
    gestion_updated_at: readString(raw.gestion_updated_at),
    updated_by_name: readString(raw.updated_by_name),
  };
}

export async function fetchAgrDeliveryRecord(
  sessionCookie: string,
  orderCode: string,
): Promise<AgrDeliveryRecord | null> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    channel: "AGR",
    page: "1",
    pageSize: "50",
    entity: "DISTRIBUIDOR ONLINE",
    q: orderCode.replace(/\D/g, ""),
  }).toString();
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      cookie: `__Host-cgagr_delivery_session=${sessionCookie}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new AgrCredentialError("La sesión logística venció.");
  }
  if (!response.ok)
    throw new Error(`La fuente logística respondió ${response.status}.`);
  const payload = (await response.json()) as unknown;
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { ok?: unknown }).ok !== true
  ) {
    throw new Error("La fuente logística devolvió una respuesta inválida.");
  }
  const records = Array.isArray((payload as AgrDeliveryResponse).records)
    ? (payload as AgrDeliveryResponse).records
    : [];
  const normalized = orderCode.replace(/\D/g, "");
  return (
    records
      .map(parseRecord)
      .find((record) => record?.order_id.replace(/\D/g, "") === normalized) ??
    null
  );
}

export function isAgrRecoveryOpportunity(record: AgrDeliveryRecord): boolean {
  const status = record.estado_pedido.trim().toUpperCase();
  if (terminalExternalStatuses.includes(status)) return false;
  return Boolean(
    record.motivo_rechazo ||
    record.submotivo_rechazo ||
    /NO\s*ENTREG|RECHAZ|CANCEL|ANUL|DEVUEL/.test(status) ||
    (record.gestion_status?.toUpperCase() === "SIN GESTIÓN" &&
      !record.fecha_toma_pedido),
  );
}

function fingerprint(record: AgrDeliveryRecord): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function currentLimaScheduleKey(now = new Date()): string | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const minutes = Number(read("hour")) * 60 + Number(read("minute"));
  const slot = [18 * 60 + 15, 13 * 60 + 15, 8 * 60 + 15].find(
    (candidate) => minutes >= candidate,
  );
  if (slot === undefined) return null;
  return `${read("year")}-${read("month")}-${read("day")}-${String(Math.floor(slot / 60)).padStart(2, "0")}${String(slot % 60).padStart(2, "0")}`;
}

export async function maybeRunScheduledAgrDeliverySync(
  organizationId: string,
): Promise<void> {
  const scheduleKey = currentLimaScheduleKey();
  if (!scheduleKey) return;
  await runAgrDeliverySync({
    organizationId,
    trigger: "SCHEDULED",
    scheduleKey,
  });
}

export async function runAgrDeliverySync(input: {
  organizationId: string;
  trigger: "SCHEDULED" | "MANUAL";
  scheduleKey?: string;
}) {
  const integration = await database.agrDeliveryIntegration.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!integration || integration.credentialStatus === "EXPIRED") return null;
  const scheduleKey =
    input.scheduleKey ?? `manual-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const run = await database.agrDeliverySyncRun
    .create({
      data: {
        organizationId: input.organizationId,
        agrDeliveryIntegrationId: integration.id,
        scheduleKey,
        trigger: input.trigger,
      },
    })
    .catch(() => null);
  if (!run) return null;

  const candidates = await database.ditoOrder.findMany({
    where: {
      organizationId: input.organizationId,
      registeredAt: { gte: eligibleSince },
      status: { not: "CLOSED" },
      deliveryStatus: { not: "DELIVERED" },
      AND: [
        {
          OR: [
            { agrDeliverySnapshot: null },
            {
              agrDeliverySnapshot: {
                is: { estadoPedido: { notIn: terminalExternalStatuses } },
              },
            },
          ],
        },
        {
          OR: [
            { status: { not: "CANCELLED" } },
            { agrDeliverySnapshot: null },
            {
              agrDeliverySnapshot: {
                is: { motivoRechazo: null, submotivoRechazo: null },
              },
            },
          ],
        },
      ],
    },
    orderBy: { registeredAt: "asc" },
    take: 250,
    select: {
      id: true,
      orderCodeRaw: true,
      agrDeliverySnapshot: { select: { id: true, sourceFingerprint: true } },
    },
  });

  const counters = {
    consulted: 0,
    found: 0,
    changed: 0,
    opportunities: 0,
    errors: 0,
  };
  const changedOrderIds: string[] = [];
  try {
    const sessionCookie = decryptAgrSessionCookie(
      integration.encryptedSessionCookie,
    );
    for (let offset = 0; offset < candidates.length; offset += 10) {
      const batch = candidates.slice(offset, offset + 10);
      await Promise.all(
        batch.map(async (order) => {
          try {
            counters.consulted += 1;
            const record = await fetchAgrDeliveryRecord(
              sessionCookie,
              order.orderCodeRaw,
            );
            if (!record) return;
            counters.found += 1;
            const sourceFingerprint = fingerprint(record);
            const changed =
              order.agrDeliverySnapshot?.sourceFingerprint !==
              sourceFingerprint;
            const opportunity = isAgrRecoveryOpportunity(record);
            if (changed) {
              counters.changed += 1;
              changedOrderIds.push(order.id);
            }
            if (opportunity) counters.opportunities += 1;
            const fetchedAt = new Date();
            await database.$transaction(async (transaction) => {
              const snapshot =
                await transaction.agrDeliveryOrderSnapshot.upsert({
                  where: { ditoOrderId: order.id },
                  create: snapshotData(
                    input.organizationId,
                    order.id,
                    record,
                    sourceFingerprint,
                    opportunity,
                    fetchedAt,
                  ),
                  update: {
                    ...snapshotFields(record),
                    sourceFingerprint,
                    isRecoveryOpportunity: opportunity,
                    rawPayload: record as Prisma.InputJsonValue,
                    fetchedAt,
                    ...(changed ? { changedAt: fetchedAt } : {}),
                  },
                });
              if (changed) {
                await transaction.agrDeliveryOrderHistory.create({
                  data: {
                    organizationId: input.organizationId,
                    agrDeliveryOrderSnapshotId: snapshot.id,
                    estadoPedido: record.estado_pedido,
                    motivoRechazo: record.motivo_rechazo,
                    submotivoRechazo: record.submotivo_rechazo,
                    gestionStatus: record.gestion_status,
                    sourceFingerprint,
                    rawPayload: record as Prisma.InputJsonValue,
                    observedAt: fetchedAt,
                  },
                });
              }
            });
          } catch (error) {
            if (error instanceof AgrCredentialError) throw error;
            counters.errors += 1;
          }
        }),
      );
    }
    const completedAt = new Date();
    if (changedOrderIds.length > 0) {
      await database.ditoOrder.updateMany({
        where: { id: { in: changedOrderIds } },
        data: { updatedAt: completedAt },
      });
    }
    await database.$transaction([
      database.agrDeliverySyncRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          candidateOrders: candidates.length,
          consultedOrders: counters.consulted,
          foundOrders: counters.found,
          changedOrders: counters.changed,
          opportunityOrders: counters.opportunities,
          errorOrders: counters.errors,
          completedAt,
        },
      }),
      database.agrDeliveryIntegration.update({
        where: { id: integration.id },
        data: {
          credentialStatus: "ACTIVE",
          lastAttemptAt: completedAt,
          lastSuccessAt: completedAt,
          lastError: null,
        },
      }),
    ]);
    return { runId: run.id, candidates: candidates.length, ...counters };
  } catch (error) {
    const expired = error instanceof AgrCredentialError;
    const message = expired
      ? error.message
      : "No se pudo completar la sincronización logística.";
    const completedAt = new Date();
    await database.$transaction([
      database.agrDeliverySyncRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          candidateOrders: candidates.length,
          consultedOrders: counters.consulted,
          errorOrders: counters.errors,
          errorMessage: message,
          completedAt,
        },
      }),
      database.agrDeliveryIntegration.update({
        where: { id: integration.id },
        data: {
          credentialStatus: expired ? "EXPIRED" : "ERROR",
          lastAttemptAt: completedAt,
          lastError: message,
        },
      }),
    ]);
    return { runId: run.id, error: message };
  }
}

function snapshotFields(record: AgrDeliveryRecord) {
  return {
    externalOrderId: record.order_id,
    pedido: record.pedido,
    envio: record.envio,
    estadoPedido: record.estado_pedido,
    motivoRechazo: record.motivo_rechazo,
    submotivoRechazo: record.submotivo_rechazo,
    fechaEntregaPactadaRaw: record.fecha_entrega_pactada,
    fechaEntregaRealRaw: record.fecha_entrega_real,
    fechaTomaPedidoRaw: record.fecha_toma_pedido,
    tipoDelivery: record.tipo_delivery,
    vendedor: record.vendedor,
    nombreVendedor: record.nombre_vendedor,
    gestionStatus: record.gestion_status,
    resultado: record.resultado,
    proximaAccion: record.proxima_accion,
    fechaCompromisoRaw: record.fecha_compromiso,
    gestionUpdatedAtRaw: record.gestion_updated_at,
    updatedByName: record.updated_by_name,
  };
}

function snapshotData(
  organizationId: string,
  ditoOrderId: string,
  record: AgrDeliveryRecord,
  sourceFingerprint: string,
  opportunity: boolean,
  fetchedAt: Date,
) {
  return {
    organizationId,
    ditoOrderId,
    ...snapshotFields(record),
    sourceFingerprint,
    isRecoveryOpportunity: opportunity,
    rawPayload: record as Prisma.InputJsonValue,
    fetchedAt,
    changedAt: fetchedAt,
  };
}
