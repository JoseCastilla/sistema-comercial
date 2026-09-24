import { describe, expect, it } from "vitest";

import { hourKey, idempotencyKey, matchesInbound, normalizeText } from "./triggers";

const facts = {
  isFirstInConversation: false,
  fromAd: false,
  body: "Hola, quiero información de portabilidad",
  withinBusinessHours: true,
};

describe("matchesInbound", () => {
  it("sin filtros, cualquier mensaje dispara", () => {
    expect(matchesInbound({}, facts)).toBe(true);
  });

  it("la palabra clave no distingue mayúsculas ni tildes", () => {
    expect(matchesInbound({ keyword: "PORTA" }, facts)).toBe(true);
    expect(matchesInbound({ keyword: "portabilidád" }, facts)).toBe(true);
    expect(matchesInbound({ keyword: "renovación" }, facts)).toBe(false);
  });

  it("«solo el primer mensaje» y «desde un anuncio» filtran", () => {
    expect(matchesInbound({ firstMessageOnly: true }, facts)).toBe(false);
    expect(matchesInbound({ firstMessageOnly: true }, { ...facts, isFirstInConversation: true })).toBe(true);
    expect(matchesInbound({ fromAd: true }, facts)).toBe(false);
    expect(matchesInbound({ fromAd: true }, { ...facts, fromAd: true })).toBe(true);
  });

  it("«fuera de horario» solo dispara cuando el negocio está cerrado", () => {
    expect(matchesInbound({ outsideBusinessHours: true }, facts)).toBe(false);
    expect(matchesInbound({ outsideBusinessHours: true }, { ...facts, withinBusinessHours: false })).toBe(true);
  });

  it("los filtros se suman", () => {
    const filters = { firstMessageOnly: true, fromAd: true, keyword: "porta" };
    expect(matchesInbound(filters, { ...facts, isFirstInConversation: true, fromAd: true })).toBe(true);
    expect(matchesInbound(filters, { ...facts, isFirstInConversation: true, fromAd: true, body: "hola" })).toBe(false);
  });
});

describe("claves", () => {
  it("normaliza texto para comparar etiquetas y palabras", () => {
    expect(normalizeText("  Portabilidad  ")).toBe("portabilidad");
  });

  it("la hora redondeada agrupa todo lo que pasa dentro de la misma hora", () => {
    expect(hourKey(new Date("2026-09-12T15:10:00.000Z"))).toBe(hourKey(new Date("2026-09-12T15:59:59.000Z")));
    expect(hourKey(new Date("2026-09-12T15:10:00.000Z"))).not.toBe(hourKey(new Date("2026-09-12T16:00:00.000Z")));
  });

  it("la clave de idempotencia junta disparador, objeto y evento", () => {
    expect(idempotencyKey("ORDER_STATUS", "pedido-1", "ENTREGADO")).toBe("ORDER_STATUS:pedido-1:ENTREGADO");
    expect(idempotencyKey("INBOUND_MESSAGE", "c".repeat(300), "x").length).toBe(200);
  });
});
