import { describe, expect, it } from "vitest";

import { anonymizeText, anonymizeTurns, DOCUMENT_MARKER, NAME_MARKER, PHONE_MARKER } from "./anonymize";
import { budgetVerdict, BUDGET_EXHAUSTED_REASON, DEFAULT_USD_TO_PEN, monthStartUtc, usdToPenRate } from "./budget";
import { evaluateExpectations, parseExpectations } from "./expectations";
import { estimateCostUsd, priceOf } from "./provider";
import { NO_AGENT_REASON, scheduleApplies, shouldAgentRespond } from "./schedule";

describe("costo del turno", () => {
  it("cobra la lectura de caché al diez por ciento de la entrada", () => {
    // 1M de entrada = $5; 1M leídos de caché = $0.50; 1M de salida = $25.
    expect(estimateCostUsd("claude-opus-5", { input: 1_000_000, output: 0, cacheRead: 0 })).toBeCloseTo(5, 6);
    expect(estimateCostUsd("claude-opus-5", { input: 0, output: 0, cacheRead: 1_000_000 })).toBeCloseTo(0.5, 6);
    expect(estimateCostUsd("claude-opus-5", { input: 0, output: 1_000_000, cacheRead: 0 })).toBeCloseTo(25, 6);
  });

  it("cada modelo tiene su precio y el desconocido se cobra como el más caro", () => {
    expect(priceOf("claude-sonnet-5")).toEqual({ input: 2, output: 10 });
    expect(priceOf("claude-haiku-4-5")).toEqual({ input: 1, output: 5 });
    expect(priceOf("modelo-que-no-existe")).toEqual({ input: 5, output: 25 });
  });

  it("un turno corriente cuesta centavos, no dólares", () => {
    const cost = estimateCostUsd("claude-haiku-4-5", { input: 1_200, output: 300, cacheRead: 8_000 });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });
});

describe("tope mensual", () => {
  it("sin tope siempre puede responder", () => {
    const verdict = budgetVerdict({ spentUsd: 500, monthlyBudgetPen: null });
    expect(verdict.state).toBe("SIN_TOPE");
    expect(verdict.canRespond).toBe(true);
  });

  it("avisa al ochenta por ciento y sigue respondiendo", () => {
    // 100 soles de tope, 3.7 por dólar → 80 % son 21.62 dólares.
    const verdict = budgetVerdict({ spentUsd: 22, monthlyBudgetPen: 100, usdToPen: 3.7 });
    expect(verdict.state).toBe("AVISO");
    expect(verdict.canRespond).toBe(true);
  });

  it("al llegar al cien por ciento deja de responder", () => {
    const verdict = budgetVerdict({ spentUsd: 27.03, monthlyBudgetPen: 100, usdToPen: 3.7 });
    expect(verdict.state).toBe("AGOTADO");
    expect(verdict.canRespond).toBe(false);
    expect(BUDGET_EXHAUSTED_REASON).toBe("tope mensual del asistente alcanzado");
  });

  it("el tipo de cambio sale del entorno y cae en 3.7 si no sirve", () => {
    expect(usdToPenRate("3.9")).toBe(3.9);
    expect(usdToPenRate("3,9")).toBe(3.9);
    expect(usdToPenRate("")).toBe(DEFAULT_USD_TO_PEN);
    expect(usdToPenRate("cero")).toBe(DEFAULT_USD_TO_PEN);
    expect(usdToPenRate("-2")).toBe(DEFAULT_USD_TO_PEN);
  });

  it("el mes empieza a medianoche de Lima, no de UTC", () => {
    // 1 de septiembre 00:00 en Lima son las 05:00 UTC.
    expect(monthStartUtc(new Date("2026-09-12T15:00:00Z"), "America/Lima").toISOString()).toBe("2026-09-01T05:00:00.000Z");
    // A las 02:00 UTC del 1 de octubre en Lima todavía es 30 de septiembre.
    expect(monthStartUtc(new Date("2026-10-01T02:00:00Z"), "America/Lima").toISOString()).toBe("2026-09-01T05:00:00.000Z");
  });
});

describe("cuándo responde el agente", () => {
  const base = {
    responderState: "IA_ACTIVA",
    agentStatus: "PUBLISHED",
    hasPublishedVersion: true,
    scheduleMode: "ALWAYS" as const,
    withinBusinessHours: true,
    advisorAvailable: true,
  };

  it("responde con agente publicado y horario «siempre»", () => {
    expect(shouldAgentRespond(base)).toEqual({ respond: true });
  });

  it("no toca la conversación si la lleva una persona", () => {
    expect(shouldAgentRespond({ ...base, responderState: "CONTROL_HUMANO" })).toEqual({ respond: false, handoffReason: null });
    expect(shouldAgentRespond({ ...base, responderState: "REQUIERE_ASESOR" })).toEqual({ respond: false, handoffReason: null });
  });

  it("en IA_ACTIVA sin agente publicado manda la conversación a la cola", () => {
    expect(shouldAgentRespond({ ...base, agentStatus: null })).toEqual({ respond: false, handoffReason: NO_AGENT_REASON });
    expect(shouldAgentRespond({ ...base, agentStatus: "PAUSED" })).toEqual({ respond: false, handoffReason: NO_AGENT_REASON });
    expect(shouldAgentRespond({ ...base, hasPublishedVersion: false })).toEqual({ respond: false, handoffReason: NO_AGENT_REASON });
  });

  it("fuera de horario: contesta solo cuando el negocio está cerrado", () => {
    expect(scheduleApplies({ scheduleMode: "OUTSIDE_BUSINESS_HOURS", withinBusinessHours: true, advisorAvailable: false })).toBe(false);
    expect(scheduleApplies({ scheduleMode: "OUTSIDE_BUSINESS_HOURS", withinBusinessHours: false, advisorAvailable: true })).toBe(true);
  });

  it("sin asesor conectado: contesta solo si no hay nadie", () => {
    expect(scheduleApplies({ scheduleMode: "WHEN_NO_ADVISOR", withinBusinessHours: true, advisorAvailable: true })).toBe(false);
    expect(scheduleApplies({ scheduleMode: "WHEN_NO_ADVISOR", withinBusinessHours: true, advisorAvailable: false })).toBe(true);
  });

  it("si el horario no aplica, la conversación tampoco se queda callada", () => {
    expect(shouldAgentRespond({ ...base, scheduleMode: "OUTSIDE_BUSINESS_HOURS", withinBusinessHours: true })).toEqual({
      respond: false,
      handoffReason: NO_AGENT_REASON,
    });
  });
});

describe("expectativas de un caso de prueba", () => {
  const outcome = { text: "Te paso con un asesor para que te confirme.", toolNames: ["pasar_a_asesor"], handoff: true };

  it("pasa cuando se cumple todo", () => {
    const verdict = evaluateExpectations(outcome, { mustCallTool: "pasar_a_asesor", mustHandoff: true, mustNotContain: ["S/"] });
    expect(verdict).toEqual({ passed: true, problems: [] });
  });

  it("explica en lenguaje directo qué faltó", () => {
    const verdict = evaluateExpectations({ text: "Te sale S/ 39.90 al mes.", toolNames: [], handoff: false }, {
      mustCallTool: "consultar_planes",
      mustNotContain: ["S/"],
      mustHandoff: true,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.problems).toEqual(["No usó «consultar_planes».", "Dijo «S/» y no debía.", "No derivó a un asesor."]);
  });

  it("compara sin tildes ni mayúsculas", () => {
    expect(evaluateExpectations({ text: "Un asesor te confirmará", toolNames: [], handoff: false }, { mustContain: ["CONFIRMARA"] }).passed).toBe(true);
  });

  it("marca cuando usó una herramienta que no debía", () => {
    const verdict = evaluateExpectations(outcome, { mustNotCallTool: "pasar_a_asesor" });
    expect(verdict.problems).toEqual(["Usó «pasar_a_asesor» y no debía."]);
  });

  it("una expectativa inválida se lee como «sin expectativas», no rompe la corrida", () => {
    expect(parseExpectations("cualquier cosa")).toEqual({});
    expect(evaluateExpectations(outcome, parseExpectations(null)).passed).toBe(true);
  });
});

describe("anonimización de ejemplos", () => {
  it("reemplaza DNI, teléfono y nombre", () => {
    const text = anonymizeText("Hola, soy María Quispe, mi DNI es 45871236 y mi número 987654321.", "María Quispe");
    expect(text).toContain(NAME_MARKER);
    expect(text).toContain(DOCUMENT_MARKER);
    expect(text).toContain(PHONE_MARKER);
    expect(text).not.toMatch(/45871236|987654321|María|Quispe/);
  });

  it("un teléfono con espacios o guiones tampoco se cuela", () => {
    expect(anonymizeText("mi celu es 987 654 321")).toBe(`mi celu es ${PHONE_MARKER}`);
    expect(anonymizeText("+51 987-654-321")).toBe(PHONE_MARKER);
  });

  it("un número de ocho dígitos es DNI, no teléfono", () => {
    expect(anonymizeText("DNI 45871236")).toBe(`DNI ${DOCUMENT_MARKER}`);
  });

  it("no toca números cortos como la cantidad de líneas", () => {
    expect(anonymizeText("quiero 2 líneas")).toBe("quiero 2 líneas");
  });

  it("anonimiza cada turno y conserva quién habló", () => {
    const turns = anonymizeTurns(
      [
        { role: "user", text: "Soy Ana Torres, DNI 45871236" },
        { role: "assistant", text: "Gracias Ana, ya lo anoté." },
      ],
      "Ana Torres",
    );
    expect(turns[0]).toEqual({ role: "user", text: `Soy ${NAME_MARKER}, DNI ${DOCUMENT_MARKER}` });
    expect(turns[1]).toEqual({ role: "assistant", text: `Gracias ${NAME_MARKER}, ya lo anoté.` });
  });

  it("sin nombre de contacto igual limpia los números", () => {
    expect(anonymizeText("mi dni 10203040", null)).toBe(`mi dni ${DOCUMENT_MARKER}`);
  });
});
