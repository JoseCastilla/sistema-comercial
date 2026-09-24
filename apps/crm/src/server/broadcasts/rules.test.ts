import { describe, expect, it } from "vitest";

import {
  brakeDecision,
  dailyLimitForTier,
  dailyLimitIsAssumed,
  DEFAULT_DAILY_LIMIT,
  estimateCost,
  evaluateRecipient,
  exclusionText,
  splitByDailyLimit,
  withinSendWindow,
  type RecipientFacts,
} from "./rules";

const NOW = new Date("2026-09-12T15:00:00Z"); // sábado 10:00 en Lima

const person = (extra: Partial<RecipientFacts> = {}): RecipientFacts => ({
  id: "c1",
  phone: "51999888777",
  tags: [],
  marketingConsent: true,
  marketingOptOutAt: null,
  lastMarketingSentAt: null,
  advisorActivityAt: null,
  sendingBlocked: false,
  ...extra,
});

const MARKETING = { category: "MARKETING" } as const;
const UTILITY = { category: "UTILITY" } as const;
const context = { now: NOW };

describe("exclusiones fijas de la difusión (BR-003)", () => {
  it("deja pasar a quien aceptó promociones y no tiene nada en contra", () => {
    expect(evaluateRecipient(person(), context, MARKETING)).toEqual({ eligible: true });
  });

  it("excluye de marketing a quien nunca aceptó recibir promociones", () => {
    const result = evaluateRecipient(person({ marketingConsent: null }), context, MARKETING);
    expect(result).toMatchObject({ eligible: false, reason: "SIN_CONSENTIMIENTO", reasonText: "no aceptó recibir promociones" });
  });

  it("excluye de marketing a quien se dio de baja, aunque el consentimiento siga en true", () => {
    const result = evaluateRecipient(
      person({ marketingOptOutAt: new Date("2026-08-01T00:00:00Z") }),
      context,
      MARKETING,
    );
    expect(result).toMatchObject({ eligible: false, reason: "BAJA_MARKETING" });
  });

  it("excluye siempre a quien está marcado «no-contactar», sin importar la categoría", () => {
    const marcado = person({ tags: ["cliente", "No-Contactar"] });
    expect(evaluateRecipient(marcado, context, MARKETING)).toMatchObject({ reason: "NO_CONTACTAR" });
    expect(evaluateRecipient(marcado, context, UTILITY)).toMatchObject({ reason: "NO_CONTACTAR" });
  });

  it("excluye de marketing a quien recibió una promoción hace 3 días, pero no de utilidad (AC-003)", () => {
    const reciente = person({ lastMarketingSentAt: new Date("2026-09-09T15:00:00Z") });
    expect(evaluateRecipient(reciente, context, MARKETING)).toMatchObject({
      reason: "MARKETING_RECIENTE",
      reasonText: "ya recibió una promoción esta semana",
    });
    expect(evaluateRecipient(reciente, context, UTILITY)).toEqual({ eligible: true });
  });

  it("deja pasar a quien recibió una promoción hace más de 7 días", () => {
    const antigua = person({ lastMarketingSentAt: new Date("2026-09-01T15:00:00Z") });
    expect(evaluateRecipient(antigua, context, MARKETING)).toEqual({ eligible: true });
  });

  it("no interrumpe a quien está atendiendo un asesor en las últimas 24 h", () => {
    const atendido = person({ advisorActivityAt: new Date("2026-09-12T09:00:00Z") });
    expect(evaluateRecipient(atendido, context, MARKETING)).toMatchObject({
      reason: "LO_ATIENDE_UN_ASESOR",
      reasonText: "la está atendiendo un asesor: escríbele desde la bandeja",
    });
    // La de utilidad avisa de algo que la persona ya pidió: no estorba al asesor.
    expect(evaluateRecipient(atendido, context, UTILITY)).toEqual({ eligible: true });
  });

  it("vuelve a incluirlo pasadas las 24 h desde la última actividad del asesor", () => {
    const atendido = person({ advisorActivityAt: new Date("2026-09-11T09:00:00Z") });
    expect(evaluateRecipient(atendido, context, MARKETING)).toEqual({ eligible: true });
  });

  it("excluye en las dos categorías a quien tuvo un envío fallido por número inválido o bloqueo", () => {
    const fallido = person({ sendingBlocked: true });
    expect(evaluateRecipient(fallido, context, MARKETING)).toMatchObject({ reason: "ENVIO_FALLIDO" });
    expect(evaluateRecipient(fallido, context, UTILITY)).toMatchObject({ reason: "ENVIO_FALLIDO" });
  });

  it("excluye en las dos categorías a quien no tiene teléfono", () => {
    const sinTelefono = person({ phone: "  " });
    expect(evaluateRecipient(sinTelefono, context, MARKETING)).toMatchObject({ reason: "SIN_TELEFONO" });
    expect(evaluateRecipient(sinTelefono, context, UTILITY)).toMatchObject({ reason: "SIN_TELEFONO" });
  });

  it("una plantilla de utilidad solo tropieza con «no contactar», el fallo previo y la falta de teléfono", () => {
    const sinConsentimiento = person({ marketingConsent: false, marketingOptOutAt: new Date("2026-01-01T00:00:00Z") });
    expect(evaluateRecipient(sinConsentimiento, context, UTILITY)).toEqual({ eligible: true });
  });

  it("traduce el código guardado a texto directo", () => {
    expect(exclusionText("SIN_TELEFONO")).toBe("no tenemos su número de WhatsApp");
    expect(exclusionText(null)).toBe("sin motivo registrado");
  });
});

describe("límite de envío diario del número", () => {
  it("traduce el tier de Meta a personas por día", () => {
    expect(dailyLimitForTier("TIER_250")).toBe(250);
    expect(dailyLimitForTier("tier_1k")).toBe(1_000);
    expect(dailyLimitForTier("TIER_10K")).toBe(10_000);
    expect(dailyLimitForTier("TIER_100K")).toBe(100_000);
    expect(dailyLimitForTier("TIER_UNLIMITED")).toBeNull();
  });

  it("sin tier asume el más bajo real y lo dice", () => {
    expect(dailyLimitForTier(null)).toBe(DEFAULT_DAILY_LIMIT);
    expect(dailyLimitIsAssumed(null)).toBe(true);
    expect(dailyLimitIsAssumed("TIER_1K")).toBe(false);
  });
});

describe("reparto en días (BR-007)", () => {
  it("todo sale el mismo día cuando cabe en el límite", () => {
    const plan = splitByDailyLimit(["a", "b", "c"], 250, NOW);
    expect(plan.days).toEqual([{ day: "2026-09-12", count: 3 }]);
    expect(plan.schedule["2026-09-12"]).toEqual(["a", "b", "c"]);
  });

  it("reparte en varios días y salta el domingo", () => {
    const plan = splitByDailyLimit(["a", "b", "c", "d", "e"], 2, NOW);
    expect(plan.days).toEqual([
      { day: "2026-09-12", count: 2 }, // sábado
      { day: "2026-09-14", count: 2 }, // lunes: el domingo no se envía
      { day: "2026-09-15", count: 1 },
    ]);
    expect(plan.schedule["2026-09-14"]).toEqual(["c", "d"]);
  });

  it("empieza el lunes cuando la programación cae en domingo", () => {
    const plan = splitByDailyLimit(["a"], 250, new Date("2026-09-13T15:00:00Z"));
    expect(plan.days).toEqual([{ day: "2026-09-14", count: 1 }]);
  });

  it("sin límite todo sale el primer día", () => {
    const plan = splitByDailyLimit(["a", "b", "c"], null, NOW);
    expect(plan.days).toEqual([{ day: "2026-09-12", count: 3 }]);
  });

  it("sin destinatarios no hay días", () => {
    expect(splitByDailyLimit([], 250, NOW)).toEqual({ schedule: {}, days: [] });
  });
});

describe("franja de envío en Lima (BR-006)", () => {
  it("acepta lunes a sábado entre 9:00 y 20:00", () => {
    expect(withinSendWindow(new Date("2026-09-14T15:00:00Z"))).toBe(true); // lunes 10:00
    expect(withinSendWindow(new Date("2026-09-12T15:00:00Z"))).toBe(true); // sábado 10:00
    expect(withinSendWindow(new Date("2026-09-15T00:59:00Z"))).toBe(true); // lunes 19:59
  });

  it("rechaza el domingo y lo que cae fuera del horario", () => {
    expect(withinSendWindow(new Date("2026-09-13T15:00:00Z"))).toBe(false); // domingo
    expect(withinSendWindow(new Date("2026-09-14T13:00:00Z"))).toBe(false); // lunes 08:00
    expect(withinSendWindow(new Date("2026-09-15T01:00:00Z"))).toBe(false); // lunes 20:00
  });
});

describe("freno automático (BR-009)", () => {
  it("no evalúa bloqueos con menos de 50 entregados", () => {
    expect(brakeDecision({ delivered: 40, failed: 0, optOuts: 3, blocked: 3 })).toEqual({ pause: false });
  });

  it("pausa cuando bloqueos y bajas pasan el 2 % de lo entregado (AC-006)", () => {
    const decision = brakeDecision({ delivered: 100, failed: 0, optOuts: 0, blocked: 3 });
    expect(decision.pause).toBe(true);
    expect(decision.pause && decision.reason).toContain("3 de 100");
  });

  it("no pausa con exactamente el 2 %", () => {
    expect(brakeDecision({ delivered: 100, failed: 0, optOuts: 1, blocked: 1 })).toEqual({ pause: false });
  });

  it("pausa cuando los fallos pasan el 10 % de lo enviado", () => {
    const decision = brakeDecision({ delivered: 40, failed: 10, optOuts: 0, blocked: 0 });
    expect(decision.pause).toBe(true);
    expect(decision.pause && decision.reason).toContain("fallaron");
  });

  it("no evalúa fallos con menos de 20 envíos", () => {
    expect(brakeDecision({ delivered: 5, failed: 5, optOuts: 0, blocked: 0 })).toEqual({ pause: false });
  });
});

describe("costo aproximado (BR-007)", () => {
  it("cobra la tarifa de marketing por mensaje y la pasa a soles", () => {
    const cost = estimateCost(100, "MARKETING", 3.7);
    expect(cost.ratePerMessageUsd).toBe(0.0809);
    expect(cost.usd).toBeCloseTo(8.09, 2);
    expect(cost.pen).toBeCloseTo(29.93, 2);
  });

  it("la utilidad cuesta bastante menos", () => {
    expect(estimateCost(100, "UTILITY", 3.7).usd).toBeCloseTo(2.3, 2);
  });

  it("sin destinatarios no cuesta nada", () => {
    expect(estimateCost(0, "MARKETING", 3.7)).toMatchObject({ usd: 0, pen: 0 });
  });
});
