import { describe, expect, it } from "vitest";

import { computeWebhookSignature, verifyWebhookSignature } from "./signature";

describe("firma del webhook de Meta", () => {
  const secret = "secreto-de-prueba";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("acepta la firma correcta", () => {
    expect(verifyWebhookSignature(body, computeWebhookSignature(body, secret), secret)).toBe(true);
  });

  it("rechaza firma alterada, secreto distinto, cabecera ausente o cuerpo cambiado", () => {
    const valid = computeWebhookSignature(body, secret);
    expect(verifyWebhookSignature(body, valid.replace(/.$/, (c) => (c === "0" ? "1" : "0")), secret)).toBe(false);
    expect(verifyWebhookSignature(body, valid, "otro")).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, "sha256=corta", secret)).toBe(false);
    expect(verifyWebhookSignature(`${body} `, valid, secret)).toBe(false);
    expect(verifyWebhookSignature(body, valid, "")).toBe(false);
  });
});
