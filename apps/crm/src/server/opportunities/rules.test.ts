import { describe, expect, it } from "vitest";

import {
  canTransition,
  customerRelation,
  isStale,
  LOST_REASONS,
  manualTargets,
  orderLinkCandidates,
  originForConversation,
  phoneKey,
  shouldOpenOpportunity,
  staleAfterDays,
  type LinkCandidateOpportunity,
} from "./rules";

describe("abrir oportunidad (BR-001 / BR-002)", () => {
  it("con una abierta no abre otra ni marca consulta de pedido", () => {
    expect(shouldOpenOpportunity({ hasOpenOpportunity: true, hasOrderInProgress: false })).toEqual({ open: false, markOrderInquiry: false });
    expect(shouldOpenOpportunity({ hasOpenOpportunity: true, hasOrderInProgress: true })).toEqual({ open: false, markOrderInquiry: false });
  });

  it("con pedido ingresado en curso no abre y marca la conversación como consulta de pedido", () => {
    expect(shouldOpenOpportunity({ hasOpenOpportunity: false, hasOrderInProgress: true })).toEqual({ open: false, markOrderInquiry: true });
  });

  it("sin abierta ni pedido en curso abre", () => {
    expect(shouldOpenOpportunity({ hasOpenOpportunity: false, hasOrderInProgress: false })).toEqual({ open: true, markOrderInquiry: false });
  });
});

describe("origen y relación (BR-004 / BR-006)", () => {
  it("anuncio manda sobre difusión, difusión sobre orgánico", () => {
    expect(originForConversation({ originAdId: "1203", repliedToBroadcast: true })).toBe("AD");
    expect(originForConversation({ originAdId: null, repliedToBroadcast: true })).toBe("BROADCAST");
    expect(originForConversation({ originAdId: undefined, repliedToBroadcast: false })).toBe("ORGANIC");
  });

  it("la relación depende de un pedido entregado previo", () => {
    expect(customerRelation({ hadDeliveredOrderBefore: true })).toBe("EXISTING");
    expect(customerRelation({ hadDeliveredOrderBefore: false })).toBe("NEW");
  });
});

describe("transiciones (BR-007 / BR-008 / BR-015)", () => {
  it("avanzar entre etapas manuales no pide motivo", () => {
    expect(canTransition("NUEVO", "EN_CONTACTO", "USER")).toEqual({ allowed: true, requiresReason: false, backwards: false });
    expect(canTransition("CALIFICADO", "EN_CIERRE", "USER")).toEqual({ allowed: true, requiresReason: false, backwards: false });
  });

  it("retroceder pide motivo", () => {
    expect(canTransition("PROPUESTA", "CALIFICADO", "USER")).toEqual({ allowed: true, requiresReason: true, backwards: true });
  });

  it("perdida desde cualquier abierta, con motivo", () => {
    for (const from of ["NUEVO", "EN_CONTACTO", "CALIFICADO", "PROPUESTA", "EN_CIERRE"] as const) {
      expect(canTransition(from, "PERDIDA", "USER")).toEqual({ allowed: true, requiresReason: true, backwards: false });
    }
  });

  it("ganada solo la pone el sistema", () => {
    const manual = canTransition("EN_CIERRE", "GANADA", "USER");
    expect(manual.allowed).toBe(false);
    if (!manual.allowed) expect(manual.message).toMatch(/pedido/);
    expect(canTransition("EN_CIERRE", "GANADA", "SYSTEM").allowed).toBe(true);
    expect(canTransition("NUEVO", "GANADA", "SYSTEM").allowed).toBe(true);
  });

  it("desde ganada no se mueve; desde perdida solo se reabre a En contacto", () => {
    expect(canTransition("GANADA", "EN_CIERRE", "USER").allowed).toBe(false);
    expect(canTransition("GANADA", "PERDIDA", "USER").allowed).toBe(false);
    expect(canTransition("PERDIDA", "NUEVO", "USER").allowed).toBe(false);
    expect(canTransition("PERDIDA", "EN_CONTACTO", "USER")).toEqual({ allowed: true, requiresReason: true, backwards: false });
    expect(canTransition("NUEVO", "NUEVO", "USER").allowed).toBe(false);
  });

  it("los destinos manuales excluyen Ganada y la propia etapa", () => {
    expect(manualTargets("CALIFICADO")).toEqual(["NUEVO", "EN_CONTACTO", "PROPUESTA", "EN_CIERRE", "PERDIDA"]);
    expect(manualTargets("GANADA")).toEqual([]);
    expect(manualTargets("PERDIDA")).toEqual(["EN_CONTACTO"]);
  });
});

describe("motivos de pérdida (SPEC-054 BR-017)", () => {
  it("es la lista cerrada de siete motivos", () => {
    expect(LOST_REASONS.map((reason) => reason.code)).toEqual([
      "NO_INTERESA",
      "NO_CUMPLE_REQUISITOS",
      "YA_ES_CLIENTE",
      "NO_RESPONDE",
      "PRECIO",
      "DATOS_INVALIDOS",
      "OTRO",
    ]);
  });
});

describe("vínculo de pedidos (BR-011)", () => {
  const now = new Date("2026-09-12T15:00:00Z");
  const open = (id: string, extra: Partial<LinkCandidateOpportunity> = {}): LinkCandidateOpportunity => ({
    id,
    stage: "EN_CIERRE",
    documentNumber: "12345678",
    phone: "51987654321",
    closedAt: null,
    ...extra,
  });

  it("DNI coincide y una sola candidata: automático", () => {
    expect(orderLinkCandidates({ orderDocument: "12345678", orderPhone: null, opportunities: [open("a")], now })).toEqual({ kind: "AUTO", opportunityId: "a" });
  });

  it("DNI coincide con varias candidatas: sugerido", () => {
    expect(orderLinkCandidates({ orderDocument: "12345678", orderPhone: null, opportunities: [open("a"), open("b")], now })).toEqual({
      kind: "SUGGESTED",
      opportunityIds: ["a", "b"],
    });
  });

  it("solo teléfono: sugerido aunque haya una sola", () => {
    expect(orderLinkCandidates({ orderDocument: null, orderPhone: "987654321", opportunities: [open("a")], now })).toEqual({ kind: "SUGGESTED", opportunityIds: ["a"] });
    expect(orderLinkCandidates({ orderDocument: "99999999", orderPhone: "987 654 321", opportunities: [open("a")], now })).toEqual({ kind: "SUGGESTED", opportunityIds: ["a"] });
  });

  it("sin coincidencias: ninguna", () => {
    expect(orderLinkCandidates({ orderDocument: "00000000", orderPhone: "900000000", opportunities: [open("a")], now })).toEqual({ kind: "NONE" });
    expect(orderLinkCandidates({ orderDocument: null, orderPhone: null, opportunities: [open("a")], now })).toEqual({ kind: "NONE" });
  });

  it("una ganada cerrada hace menos de 7 días sigue siendo candidata; una perdida o más vieja no", () => {
    const recentWon = open("won", { stage: "GANADA", closedAt: new Date("2026-09-08T00:00:00Z") });
    const oldWon = open("old", { stage: "GANADA", closedAt: new Date("2026-08-20T00:00:00Z") });
    const lost = open("lost", { stage: "PERDIDA", closedAt: new Date("2026-09-11T00:00:00Z") });
    expect(orderLinkCandidates({ orderDocument: "12345678", orderPhone: null, opportunities: [recentWon, oldWon, lost], now })).toEqual({ kind: "AUTO", opportunityId: "won" });
  });

  it("normaliza teléfonos a los últimos nueve dígitos", () => {
    expect(phoneKey("+51 987 654 321")).toBe("987654321");
    expect(phoneKey("51987654321")).toBe("987654321");
    expect(phoneKey(null)).toBe("");
  });
});

describe("vencimiento por inactividad (BR-003)", () => {
  it("son 30 días", () => {
    const now = new Date("2026-09-12T15:00:00Z");
    expect(staleAfterDays).toBe(30);
    expect(isStale(new Date("2026-08-13T15:00:00Z"), now)).toBe(true);
    expect(isStale(new Date("2026-08-13T15:00:01Z"), now)).toBe(false);
  });
});
