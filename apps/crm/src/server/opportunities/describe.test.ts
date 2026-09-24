import { describe, expect, it } from "vitest";

import { actorLabel, describeOpportunityEvent } from "./describe";

const event = (type: string, detail: unknown, actorKind = "USER", actorUserId: string | null = null) => ({ type, detail, actorKind, actorUserId });

describe("historial en lenguaje directo", () => {
  it("cuenta la apertura con origen y relación", () => {
    expect(describeOpportunityEvent(event("OPENED", { origin: "AD", relation: "NEW" }))).toBe(
      "Se abrió la oportunidad. Llegó por anuncio y el cliente es nuevo.",
    );
  });

  it("dice la consecuencia de perder, no el nombre de la etapa", () => {
    expect(describeOpportunityEvent(event("STAGE_CHANGED", { from: "PROPUESTA", to: "PERDIDA", lostReason: "PRECIO", lostDetail: "Pidió S/ 10 menos." }))).toBe(
      "Se cerró como perdida: precio. Pidió S/ 10 menos.",
    );
  });

  it("explica el retroceso con su motivo", () => {
    expect(describeOpportunityEvent(event("STAGE_CHANGED", { from: "PROPUESTA", to: "CALIFICADO", reason: "faltan datos" }))).toBe(
      "Pasó de Propuesta a Calificado. Motivo: faltan datos.",
    );
  });

  it("el pedido caído no borra la venta", () => {
    expect(describeOpportunityEvent(event("ORDER_DROPPED", { externalRef: "P-100" }))).toBe(
      "El pedido P-100 se canceló. La venta sigue contada, pero marcada como caída.",
    );
  });

  it("nombra al autor cuando se conoce y al sistema cuando no", () => {
    const names = new Map([["u1", "Ana"]]);
    expect(actorLabel(event("TOUCH", {}, "USER", "u1"), names)).toBe("Ana");
    expect(actorLabel(event("STAGE_CHANGED", {}, "SYSTEM"), names)).toBe("El sistema");
  });
});
