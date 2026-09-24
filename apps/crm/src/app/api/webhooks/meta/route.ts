import { verifyWebhookSignature } from "@/server/meta/signature";
import { ingestWebhook, processInBackground } from "@/server/meta/webhook";

/**
 * Webhook de Meta (WhatsApp Cloud API).
 *
 * `GET`  responde al reto de verificación cuando se da de alta la URL.
 * `POST` verifica la firma con el secreto de la app, guarda cada ítem como
 *        evidencia idempotente y responde 200 enseguida; el proceso ocurre
 *        después para que Meta nunca reintente por lentitud nuestra.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (!expected) {
    console.error("Webhook de Meta: falta META_WEBHOOK_VERIFY_TOKEN, no se puede validar la URL");
    return new Response("Falta configurar META_WEBHOOK_VERIFY_TOKEN", { status: 503 });
  }
  if (mode !== "subscribe" || token !== expected || !challenge) {
    return new Response("Verificación rechazada", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    console.error("Webhook de Meta: falta META_APP_SECRET, no se puede comprobar la firma; no se guarda nada");
    return new Response("Falta configurar META_APP_SECRET", { status: 503 });
  }

  // La firma se calcula sobre el cuerpo crudo: hay que leerlo antes de parsear.
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Firma inválida", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    // Meta espera 200 igual: reintentar no arreglaría un cuerpo roto.
    console.error("Webhook de Meta: el cuerpo no es JSON válido");
    return Response.json({ received: true, stored: 0 });
  }

  try {
    const eventIds = await ingestWebhook(body);
    processInBackground(eventIds);
    return Response.json({ received: true, stored: eventIds.length });
  } catch (error) {
    // Si no se pudo guardar, sí conviene que Meta reintente.
    console.error("Webhook de Meta: no se pudo guardar el evento", error);
    return new Response("No se pudo guardar el evento", { status: 500 });
  }
}
