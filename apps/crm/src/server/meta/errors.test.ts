import { describe, expect, it } from "vitest";

import { classifyMetaError, describeMetaError, MetaApiError } from "./errors";

function metaError(code: number | null, httpStatus = 400, details?: string) {
  return new MetaApiError({ message: `(#${code}) algo`, code, httpStatus, details });
}

describe("clasificador de errores de Meta", () => {
  it("ventana cerrada → plantilla", () => {
    expect(classifyMetaError(metaError(131047))).toEqual({ kind: "WINDOW_CLOSED", userMessage: "Ya no puedes escribirle libremente: usa una plantilla", code: 131047 });
  });

  it("límite de marketing por persona y baja de marketing", () => {
    expect(classifyMetaError(metaError(131049))).toMatchObject({ kind: "MARKETING_LIMIT", userMessage: "Meta no entregó el mensaje: esta persona alcanzó su límite de marketing" });
    expect(classifyMetaError(metaError(131050)).kind).toBe("MARKETING_LIMIT");
  });

  it("número fuera de WhatsApp es permanente", () => {
    expect(classifyMetaError(metaError(131026))).toMatchObject({ kind: "PERMANENT", userMessage: "El número no está en WhatsApp" });
    expect(classifyMetaError(metaError(470))).toMatchObject({ kind: "PERMANENT", userMessage: "El número no está en WhatsApp" });
  });

  it("token vencido y permisos son de autenticación", () => {
    expect(classifyMetaError(metaError(190, 401))).toMatchObject({ kind: "AUTH", userMessage: "El token de Meta venció o fue revocado" });
    expect(classifyMetaError(metaError(230)).kind).toBe("AUTH");
    expect(classifyMetaError(metaError(10)).kind).toBe("AUTH");
  });

  it("límites de llamadas se reintentan más tarde", () => {
    expect(classifyMetaError(metaError(4)).kind).toBe("RATE_LIMIT");
    expect(classifyMetaError(metaError(80007)).kind).toBe("RATE_LIMIT");
    expect(classifyMetaError(metaError(130429)).kind).toBe("RATE_LIMIT");
  });

  it("fallos temporales, de red y HTTP 5xx se reintentan", () => {
    expect(classifyMetaError(metaError(1)).kind).toBe("RETRY");
    expect(classifyMetaError(MetaApiError.network(new Error("ECONNRESET"))).kind).toBe("RETRY");
    expect(classifyMetaError(metaError(999999, 503)).kind).toBe("RETRY");
    expect(classifyMetaError(new Error("falló la base"))).toMatchObject({ kind: "RETRY", code: null });
  });

  it("un código desconocido con HTTP 4xx es permanente y conserva el detalle de Meta", () => {
    expect(classifyMetaError(metaError(424242, 400, "Parámetro raro"))).toEqual({ kind: "PERMANENT", userMessage: "Meta rechazó la petición: Parámetro raro", code: 424242 });
  });

  it("construye el error desde la respuesta de Meta", () => {
    const error = MetaApiError.fromResponse(400, {
      error: { message: "(#131047) Re-engagement message", type: "OAuthException", code: 131047, error_data: { messaging_product: "whatsapp", details: "Ventana cerrada" }, fbtrace_id: "abc" },
    });
    expect(error.code).toBe(131047);
    expect(error.details).toBe("Ventana cerrada");
    expect(error.httpStatus).toBe(400);
    expect(error.fbtraceId).toBe("abc");
    expect(MetaApiError.fromResponse(502, "no json").code).toBeNull();
  });

  it("describe con el código cuando existe", () => {
    expect(describeMetaError(metaError(190))).toBe("El token de Meta venció o fue revocado (código 190)");
    expect(describeMetaError(MetaApiError.network("x"))).toBe("No se pudo conectar con Meta; se volverá a intentar");
  });
});
