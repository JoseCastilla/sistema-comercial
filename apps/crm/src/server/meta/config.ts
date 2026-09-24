import "server-only";

import { graphVersion } from "./graph";

/**
 * Qué está configurado de Meta y qué falta. La pantalla lo usa para explicar
 * el siguiente paso sin mostrar ningún secreto.
 */
export interface MetaConfigStatus {
  appId: string | null;
  configId: string | null;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  graphVersion: string;
  /** Se puede ofrecer el botón de Embedded Signup. */
  canEmbeddedSignup: boolean;
  /** El webhook puede verificar firmas y responder al reto. */
  canReceiveWebhooks: boolean;
  /** Lo que falta, en lenguaje directo. */
  missing: string[];
}

function value(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

export function metaConfigStatus(): MetaConfigStatus {
  const appId = value("META_APP_ID");
  const configId = value("META_CONFIG_ID");
  const hasAppSecret = Boolean(value("META_APP_SECRET"));
  const hasVerifyToken = Boolean(value("META_WEBHOOK_VERIFY_TOKEN"));
  const missing: string[] = [];
  if (!appId) missing.push("META_APP_ID (identificador de la app de Meta)");
  if (!hasAppSecret) missing.push("META_APP_SECRET (clave secreta de la app)");
  if (!configId) missing.push("META_CONFIG_ID (configuración de Embedded Signup)");
  if (!hasVerifyToken) missing.push("META_WEBHOOK_VERIFY_TOKEN (palabra que Meta repite al validar el webhook)");
  return {
    appId,
    configId,
    hasAppSecret,
    hasVerifyToken,
    graphVersion: graphVersion(),
    canEmbeddedSignup: Boolean(appId && configId && hasAppSecret),
    canReceiveWebhooks: hasAppSecret && hasVerifyToken,
    missing,
  };
}

/** URL pública del webhook, para copiarla en la app de Meta. */
export function webhookUrl(requestUrl?: string | null): string {
  const base = value("BETTER_AUTH_URL") ?? value("NEXT_PUBLIC_APP_URL");
  if (base) return `${base.replace(/\/+$/, "")}/api/webhooks/meta`;
  if (requestUrl) {
    try {
      return `${new URL(requestUrl).origin}/api/webhooks/meta`;
    } catch {
      // Cae al texto genérico de abajo.
    }
  }
  return "https://<tu dominio>/api/webhooks/meta";
}
