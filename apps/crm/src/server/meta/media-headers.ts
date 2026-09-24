/**
 * Cabeceras con las que se sirve un adjunto (auditoría del 24/09/2026, M12).
 *
 * Solo imagen, audio y video se muestran dentro del navegador. Cualquier otro
 * tipo —un PDF, un documento, un HTML que mandó un cliente por WhatsApp— se
 * descarga: abierto en línea, un HTML ejecutaría código con la sesión del
 * asesor que lo abre. El tipo es siempre el que se guardó al recibirlo.
 */
const inlineTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/amr",
  "video/mp4",
  "video/3gpp",
]);

export function mediaResponseHeaders(
  storedMimeType: string | null,
  fileName: string,
): Record<string, string> {
  const type = (storedMimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const inline = inlineTypes.has(type);

  return {
    "content-type": inline ? type : "application/octet-stream",
    "content-disposition": inline
      ? "inline"
      : `attachment; filename="${fileName.replace(/["\\\r\n]/g, "")}"`,
    "x-content-type-options": "nosniff",
    // Aunque algo se abriera en la pestaña, no puede ejecutar código.
    "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'",
    "cache-control": "private, max-age=3600",
  };
}
