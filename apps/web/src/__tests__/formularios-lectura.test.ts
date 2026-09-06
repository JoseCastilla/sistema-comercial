import { describe, expect, it } from "vitest";

import {
  isUuid,
  readPassword,
  readText,
  readUuid,
} from "@/server/forms/read-form";
import { firstValue, firstValueOrEmpty } from "@/server/search-params";

/**
 * SPEC-037: los helpers compartidos sustituyen a ocho `readText`, dos
 * `readPassword`, tres patrones de UUID (uno rechazaba las versiones 6 a 8)
 * y seis `firstValue` con dos firmas.
 */
describe("Lectura de formularios", () => {
  it("recorta el texto, conserva la contraseña y rechaza lo que no es texto", () => {
    expect(readText("  hola ")).toBe("hola");
    expect(readText(null)).toBe("");
    expect(readPassword(" con espacio ")).toBe(" con espacio ");
    expect(readPassword(null)).toBe("");
  });

  it("acepta UUID de cualquier versión, incluido el v7 de los intentos de recupero", () => {
    expect(isUuid("018f2c3a-9b1e-7cde-8a5b-1234567890ab")).toBe(true);
    expect(isUuid("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(true);
    expect(isUuid("no-es-uuid")).toBe(false);
    expect(readUuid(" 018f2c3a-9b1e-7cde-8a5b-1234567890ab ")).toBe(
      "018f2c3a-9b1e-7cde-8a5b-1234567890ab",
    );
    expect(readUuid("x")).toBeNull();
  });
});

describe("Parámetros de búsqueda", () => {
  it("toma el primer valor y ofrece la variante con vacío", () => {
    expect(firstValue(["a", "b"])).toBe("a");
    expect(firstValue(undefined)).toBeUndefined();
    expect(firstValueOrEmpty(undefined)).toBe("");
    expect(firstValueOrEmpty("x")).toBe("x");
  });
});
