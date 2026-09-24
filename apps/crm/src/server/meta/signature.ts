import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma de los webhooks de Meta: cabecera `X-Hub-Signature-256` =
 * `sha256=` + HMAC-SHA256(cuerpo crudo, secreto de la app). Función pura.
 */
export function computeWebhookSignature(rawBody: string | Buffer, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

export function verifyWebhookSignature(rawBody: string | Buffer, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const expected = Buffer.from(computeWebhookSignature(rawBody, appSecret));
  const received = Buffer.from(header.trim());
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
