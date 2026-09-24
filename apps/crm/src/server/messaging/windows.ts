/**
 * Ventanas de conversación de WhatsApp (SPEC-053 BR-009/BR-010). Reglas puras.
 */
export const SERVICE_WINDOW_HOURS = 24;
export const AD_FREE_WINDOW_HOURS = 72;

/** ¿Se puede enviar un mensaje libre (no plantilla) ahora? */
export function canWriteFreely(lastInboundAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_HOURS * 3_600_000;
}

/** Hasta cuándo se puede escribir libremente; null si nunca escribió. */
export function freeTextUntil(lastInboundAt: Date | null | undefined): Date | null {
  if (!lastInboundAt) return null;
  return new Date(lastInboundAt.getTime() + SERVICE_WINDOW_HOURS * 3_600_000);
}

/** Texto directo para la bandeja. */
export function describeWindow(lastInboundAt: Date | null | undefined, freeUntil: Date | null | undefined, now: Date = new Date()): string {
  if (!canWriteFreely(lastInboundAt, now)) {
    return "Ya no puedes escribirle libremente. Envía una plantilla para retomar.";
  }
  const until = freeTextUntil(lastInboundAt)!;
  const hoursLeft = Math.max(0, (until.getTime() - now.getTime()) / 3_600_000);
  const base = hoursLeft < 2 ? `Puedes escribirle libremente ${Math.round(hoursLeft * 60)} min más` : `Puedes escribirle libremente hasta las ${until.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" })}`;
  if (freeUntil && freeUntil.getTime() > now.getTime()) {
    return `${base} · Gratis por anuncio hasta ${freeUntil.toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" })}`;
  }
  return base;
}
