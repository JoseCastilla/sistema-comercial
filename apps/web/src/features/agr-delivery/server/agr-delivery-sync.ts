import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { database } from "@/server/database";

import { resolveAgrScheduleKey } from "../schedule";

import { AGR_SYNC_WINDOWS } from "../agr-delivery.types";
import {
  AGR_TERMINAL_STATES,
  getAgrEligibleSince,
  pickAgrConsultations,
} from "../consultation";
import {
  resolveAgrCoverageFrom,
  resolveAgrMissingAlert,
} from "../missing-orders";
import {
  isAgrSessionExpired,
  parseAgrDateTime,
  parseAgrOrderHistory,
  readAgrSourceImportedAt,
} from "../order-history";

import type { AgrDeliveryRecord } from "../order-history";

import type { AgrSyncWindow } from "../agr-delivery.types";

import type { Prisma } from "@repo/database";

/*
 * José, 25/10/2026: Máximo pasa a `delivery-next`, con su propia cookie de
 * sesión. Misma respuesta que `/api/order-history`, más `scope` y `entity`.
 */
const endpoint = "https://cgc.alka.net.pe/delivery-next/api/v2/provider/orders";
const sessionCookieName = "__Host-cgc_session";

export type { AgrDeliveryRecord };

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

export async function fetchAgrDeliveryRecord(
  sessionCookie: string,
  orderCode: string,
): Promise<{
  record: AgrDeliveryRecord | null;
  sourceImportedAt: Date | null;
}> {
  const normalized = orderCode.replace(/\D/g, "");
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ q: normalized }).toString();
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      cookie: `${sessionCookieName}=${sessionCookie}`,
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
  // La sesión vencida también llega como 200: `{ ok: false, login: true }`.
  if (isAgrSessionExpired(payload)) {
    throw new AgrCredentialError("La sesión logística venció.");
  }
  const record = parseAgrOrderHistory(payload);
  const sourceImportedAt = readAgrSourceImportedAt(payload);
  // La fuente busca por coincidencia; nos quedamos solo con el pedido exacto.
  if (record && record.order_id.replace(/\D/g, "") !== normalized) {
    return { record: null, sourceImportedAt };
  }
  return { record, sourceImportedAt };
}

/** Entregada en Máximo: ya no hay nada que recuperar. */
const deliveredExternalStatuses = ["ENTREGADO", "CERRADO"];

export function isAgrRecoveryOpportunity(record: AgrDeliveryRecord): boolean {
  const status = record.estado_pedido.trim().toUpperCase();
  if (deliveredExternalStatuses.includes(status)) return false;
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

export async function maybeRunScheduledAgrDeliverySync(
  organizationId: string,
): Promise<void> {
  const scheduleKey = resolveAgrScheduleKey();
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
  window?: AgrSyncWindow;
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

  /*
   * José, 23/10/2026: la información de Máximo se centra en el mes en curso
   * (antes, todo desde el 10/08). La ventana manual nunca amplía ese alcance.
   */
  const windowHours = AGR_SYNC_WINDOWS[input.window ?? "ALL"].hours;
  const eligibleSince = getAgrEligibleSince();

  const registeredSince =
    windowHours === null
      ? eligibleSince
      : new Date(
          Math.max(
            eligibleSince.getTime(),
            Date.now() - windowHours * 60 * 60 * 1000,
          ),
        );

  /*
   * SPEC-087: la base descarta lo obvio (cerradas, entregadas y lo que
   * Máximo ya terminó) y la regla pura decide el resto y el orden.
   */
  const pool = await database.ditoOrder.findMany({
    where: {
      organizationId: input.organizationId,
      registeredAt: { gte: registeredSince },
      status: { not: "CLOSED" },
      deliveryStatus: { not: "DELIVERED" },
      OR: [
        { agrDeliverySnapshot: null },
        {
          agrDeliverySnapshot: {
            is: { estadoPedido: { notIn: [...AGR_TERMINAL_STATES] } },
          },
        },
      ],
    },
    select: {
      id: true,
      orderCodeRaw: true,
      status: true,
      deliveryStatus: true,
      statusUpdatedAt: true,
      registeredAt: true,
      agrDeliverySnapshot: {
        select: {
          id: true,
          sourceFingerprint: true,
          estadoPedido: true,
          motivoRechazo: true,
          submotivoRechazo: true,
          fetchedAt: true,
        },
      },
      agrDeliveryMissing: { select: { lastCheckedAt: true } },
    },
  });
  const now = new Date();
  const candidates = pickAgrConsultations(
    pool.map((order) => ({
      ...order,
      snapshot: order.agrDeliverySnapshot,
      missing: order.agrDeliveryMissing,
    })),
    now,
  );

  const counters = {
    consulted: 0,
    found: 0,
    changed: 0,
    opportunities: 0,
    errors: 0,
  };
  const changedOrderIds: string[] = [];
  // SPEC-086: lo que Máximo no tiene se escribe al final, cuando ya se sabe
  // de qué importación son sus datos.
  const missingOrders: typeof candidates = [];
  let sourceImportedAt: Date | null = null;
  let coverageFrom: Date | null = null;
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
            const result = await fetchAgrDeliveryRecord(
              sessionCookie,
              order.orderCodeRaw,
            );
            if (
              result.sourceImportedAt &&
              (!sourceImportedAt || result.sourceImportedAt > sourceImportedAt)
            ) {
              sourceImportedAt = result.sourceImportedAt;
            }
            const record = result.record;
            if (!record) {
              missingOrders.push(order);
              return;
            }
            const takenAt = parseAgrDateTime(record.fecha_toma_pedido);
            if (takenAt && (!coverageFrom || takenAt < coverageFrom)) {
              coverageFrom = takenAt;
            }
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
              await transaction.agrDeliveryMissingOrder.deleteMany({
                where: { ditoOrderId: order.id },
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
    /*
     * Si Máximo no devolvió ninguna venta, la fuente está caída o vacía (pasó
     * el 23/10/2026 a las 12:43): no se registran ausencias ni alertas.
     */
    if (counters.found > 0) {
      await recordMissingOrders(
        input.organizationId,
        missingOrders,
        sourceImportedAt,
        coverageFrom,
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

/**
 * SPEC-086: guarda las ventas que Máximo no tiene. La alerta se recalcula en
 * cada consulta con `resolveAgrMissingAlert`: hace falta que la venta falte
 * en dos importaciones distintas y se apaga si deja de cumplirse.
 */
async function recordMissingOrders(
  organizationId: string,
  orders: Array<{
    id: string;
    status: string;
    statusUpdatedAt: Date | null;
    registeredAt: Date;
  }>,
  sourceImportedAt: Date | null,
  coverageFrom: Date | null,
): Promise<void> {
  if (orders.length === 0) return;
  const checkedAt = new Date();
  const existing = await database.agrDeliveryMissingOrder.findMany({
    where: { ditoOrderId: { in: orders.map((order) => order.id) } },
    select: { ditoOrderId: true, alertedAt: true, sourceImportedAt: true },
  });
  const byOrder = new Map(existing.map((row) => [row.ditoOrderId, row]));
  await database.$transaction(
    orders.map((order) => {
      const previous = byOrder.get(order.id);
      const importedAt = sourceImportedAt ?? previous?.sourceImportedAt ?? null;
      const alertedAt = resolveAgrMissingAlert({
        status: order.status,
        sentAt: order.statusUpdatedAt ?? order.registeredAt,
        coverageFrom: resolveAgrCoverageFrom({
          oldestTakenAt: coverageFrom,
          sourceImportedAt: importedAt,
        }),
        sourceImportedAt: importedAt,
        previousImportedAt: previous?.sourceImportedAt ?? null,
        previousAlertedAt: previous?.alertedAt ?? null,
        checkedAt,
      });
      return database.agrDeliveryMissingOrder.upsert({
        where: { ditoOrderId: order.id },
        create: {
          organizationId,
          ditoOrderId: order.id,
          firstMissingAt: checkedAt,
          lastCheckedAt: checkedAt,
          sourceImportedAt: importedAt,
          alertedAt,
        },
        update: {
          lastCheckedAt: checkedAt,
          sourceImportedAt: importedAt,
          alertedAt,
        },
      });
    }),
  );
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
