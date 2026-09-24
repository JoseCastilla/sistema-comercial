import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de secretos en reposo (tokens de Meta). AES-256-GCM con la clave de
 * `CRM_ENCRYPTION_KEY` (64 hex). Formato guardado: iv:tag:cifrado, en base64.
 */
function key(): Buffer {
  const hex = process.env.CRM_ENCRYPTION_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("CRM_ENCRYPTION_KEY debe ser 64 caracteres hexadecimales");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(":");
}

export function decryptSecret(ciphertext: string): string {
  const [iv, tag, data] = ciphertext.split(":").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !data) {
    throw new Error("Secreto cifrado con formato inválido");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
