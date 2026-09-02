import { describe, expect, it } from "vitest";

import {
  EMPTY_VALUE,
  formatCount,
  formatDecimal,
  formatMoneyFromCents,
  formatPercent,
} from "@repo/ui/format";

/**
 * Estas reglas son decisiones de producto, no detalles de implementación: los
 * conteos van sin separador de miles y los importes se agrupan con un espacio
 * fino. Cambiar el módulo cambia todas las cifras de la plataforma a la vez
 * —61 llamadas en 8 módulos—, así que la regla se fija acá.
 */
describe("formatCount", () => {
  it("no agrupa los miles", () => {
    expect(formatCount(1899)).toBe("1899");
    expect(formatCount(12345)).toBe("12345");
    expect(formatCount(1234567)).toBe("1234567");
  });

  it("deja intactos los conteos cortos, que son la mayoría en el CRM", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(9)).toBe("9");
    expect(formatCount(177)).toBe("177");
  });

  it("nunca inventa un cero cuando el dato falta", () => {
    expect(formatCount(null)).toBe(EMPTY_VALUE);
    expect(formatCount(undefined)).toBe(EMPTY_VALUE);
    expect(formatCount(Number.NaN)).toBe(EMPTY_VALUE);
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe(EMPTY_VALUE);
  });
});

describe("formatMoneyFromCents", () => {
  it("agrupa con espacio fino, no con coma", () => {
    // U+202F: agrupa sin introducir un signo que compita con el punto decimal.
    expect(formatMoneyFromCents(123456789)).toBe(
      "S/\u00a01\u202f234\u202f567.89",
    );
    expect(formatMoneyFromCents(123456)).toBe("S/\u00a01\u202f234.56");
  });

  it("no contiene comas en ningún caso", () => {
    for (const cents of [1, 999, 100000, 999999999]) {
      expect(formatMoneyFromCents(cents)).not.toContain(",");
    }
  });

  it("convierte céntimos a soles con dos decimales", () => {
    expect(formatMoneyFromCents(12345)).toBe("S/\u00a0123.45");
    expect(formatMoneyFromCents(0)).toBe("S/\u00a00.00");
  });

  it("marca el dato ausente", () => {
    expect(formatMoneyFromCents(null)).toBe(EMPTY_VALUE);
  });
});

describe("formatPercent", () => {
  it("normaliza proporciones a porcentaje", () => {
    expect(formatPercent(0.128)).toBe("12.8%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("distingue el cero del dato ausente", () => {
    expect(formatPercent(0)).not.toBe(EMPTY_VALUE);
    expect(formatPercent(null)).toBe(EMPTY_VALUE);
  });
});

describe("formatDecimal", () => {
  it("fija la cantidad de decimales", () => {
    expect(formatDecimal(4.28)).toBe("4.3");
    expect(formatDecimal(4)).toBe("4.0");
    expect(formatDecimal(4.28, 2)).toBe("4.28");
  });

  it("marca el dato ausente en vez de imprimir NaN", () => {
    expect(formatDecimal(null)).toBe(EMPTY_VALUE);
    expect(formatDecimal(Number.NaN)).toBe(EMPTY_VALUE);
  });
});
