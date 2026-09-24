import { describe, expect, it } from "vitest";

import { mediaResponseHeaders } from "./media-headers";

describe("cabeceras de adjuntos", () => {
  it("una imagen se muestra en línea con su tipo guardado", () => {
    const headers = mediaResponseHeaders("image/jpeg", "foto.jpg");
    expect(headers["content-type"]).toBe("image/jpeg");
    expect(headers["content-disposition"]).toBe("inline");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it("un HTML que mandó un cliente se descarga y nunca se interpreta", () => {
    const headers = mediaResponseHeaders("text/html; charset=utf-8", "oferta.html");
    expect(headers["content-type"]).toBe("application/octet-stream");
    expect(headers["content-disposition"]).toBe('attachment; filename="oferta.html"');
    expect(headers["content-security-policy"]).toContain("sandbox");
  });

  it("un PDF o un tipo desconocido también se descargan", () => {
    expect(mediaResponseHeaders("application/pdf", "a.pdf")["content-disposition"]).toMatch(/^attachment/);
    expect(mediaResponseHeaders(null, "x")["content-type"]).toBe("application/octet-stream");
  });

  it("el nombre del archivo no puede romper la cabecera", () => {
    expect(mediaResponseHeaders("text/plain", 'a"b\r\nc.txt')["content-disposition"]).toBe(
      'attachment; filename="abc.txt"',
    );
  });
});
