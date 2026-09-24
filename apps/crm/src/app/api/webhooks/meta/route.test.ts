import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeWebhookSignature } from "@/server/meta/signature";

/**
 * Prueba de la ruta del webhook sin base de datos: se sustituye el módulo que
 * guarda los eventos para comprobar solo lo que decide la ruta (reto, firma y
 * respuesta rápida).
 */
const ingestWebhook = vi.fn<(body: unknown) => Promise<string[]>>(async () => ["evento-1"]);
const processInBackground = vi.fn<(ids: string[]) => void>();

vi.mock("@/server/meta/webhook", () => ({
  ingestWebhook: (body: unknown) => ingestWebhook(body),
  processInBackground: (ids: string[]) => processInBackground(ids),
}));

const { GET, POST } = await import("./route");

const VERIFY_TOKEN = "palabra-de-verificacion";
const APP_SECRET = "secreto-de-la-app";
const BODY = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [] }] });

function post(body: string, signature: string | null) {
  return POST(
    new Request("http://localhost:3200/api/webhooks/meta", {
      method: "POST",
      headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
      body,
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", VERIFY_TOKEN);
  vi.stubEnv("META_APP_SECRET", APP_SECRET);
  ingestWebhook.mockClear();
  processInBackground.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verificación de la URL (GET)", () => {
  it("devuelve el reto en texto plano cuando el token coincide", async () => {
    const response = GET(new Request(`http://localhost:3200/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234567890`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("1234567890");
  });

  it("rechaza el token equivocado, el modo equivocado y la falta de reto", async () => {
    expect(GET(new Request(`http://localhost:3200/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`)).status).toBe(403);
    expect(GET(new Request(`http://localhost:3200/api/webhooks/meta?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`)).status).toBe(403);
    expect(GET(new Request(`http://localhost:3200/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}`)).status).toBe(403);
  });

  it("sin token configurado avisa que falta configurarlo", async () => {
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "");
    const response = GET(new Request(`http://localhost:3200/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1`));
    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toContain("META_WEBHOOK_VERIFY_TOKEN");
  });
});

describe("recepción de eventos (POST)", () => {
  it("guarda y responde 200 cuando la firma es válida", async () => {
    const response = await post(BODY, computeWebhookSignature(BODY, APP_SECRET));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, stored: 1 });
    expect(ingestWebhook).toHaveBeenCalledTimes(1);
    expect(processInBackground).toHaveBeenCalledWith(["evento-1"]);
  });

  it("con firma inválida responde 401 y no guarda nada", async () => {
    const response = await post(BODY, "sha256=0000");
    expect(response.status).toBe(401);
    expect(ingestWebhook).not.toHaveBeenCalled();
  });

  it("con el cuerpo alterado después de firmar responde 401", async () => {
    const signature = computeWebhookSignature(BODY, APP_SECRET);
    const response = await post(`${BODY} `, signature);
    expect(response.status).toBe(401);
    expect(ingestWebhook).not.toHaveBeenCalled();
  });

  it("sin cabecera de firma responde 401", async () => {
    expect((await post(BODY, null)).status).toBe(401);
    expect(ingestWebhook).not.toHaveBeenCalled();
  });

  it("sin META_APP_SECRET responde 503 y no guarda nada", async () => {
    vi.stubEnv("META_APP_SECRET", "");
    const response = await post(BODY, "sha256=loquesea");
    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toContain("META_APP_SECRET");
    expect(ingestWebhook).not.toHaveBeenCalled();
  });

  it("un cuerpo que no es JSON no hace reintentar a Meta", async () => {
    const raw = "no soy json";
    const response = await post(raw, computeWebhookSignature(raw, APP_SECRET));
    expect(response.status).toBe(200);
    expect(ingestWebhook).not.toHaveBeenCalled();
  });
});
