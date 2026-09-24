import { describe, expect, it } from "vitest";

import { advance, newRunState, resume, stop, type RunContext } from "./engine";
import { parseDefinition } from "./schema";

const NOW = new Date("2026-09-12T15:00:00.000Z");
const LATER = new Date("2026-09-12T16:00:00.000Z");

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    contact: { name: "Ana", phone: "51987654321", tags: [], hasDocument: false, marketingOptIn: false },
    conversation: { fromAd: true, hasAiAgent: true, windowOpen: true, advisorName: "Luis" },
    opportunity: { stage: "NUEVO" },
    businessHoursNow: true,
    templates: {},
    ...overrides,
  };
}

describe("advance", () => {
  const waitDefinition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
    { id: "p1", type: "send_text", params: { text: "Hola {nombre}, soy {asesor}." } },
    { id: "p2", type: "wait_reply", params: { hours: 6 }, onReply: "p3", onTimeout: "p4" },
    { id: "p3", type: "require_advisor", params: { note: "Contestó la retoma." }, next: "p5" },
    { id: "p4", type: "end", params: { reason: "no contestó la retoma" } },
    { id: "p5", type: "end", params: { reason: "lo atiende un asesor" } },
  ]);

  it("envía el mensaje con las variables puestas y se queda esperando la respuesta", () => {
    const result = advance(waitDefinition, newRunState(NOW, "p1"), context(), NOW);
    expect(result.effects).toEqual([{ kind: "send_text", stepId: "p1", stepIndex: 1, text: "Hola Ana, soy Luis." }]);
    expect(result.nextRun.status).toBe("WAITING");
    expect(result.nextRun.waitingForReply).toBe(true);
    expect(result.nextRun.resumeAt?.toISOString()).toBe("2026-09-12T21:00:00.000Z");
  });

  it("si responde, sigue por la rama de respuesta", () => {
    const waiting = advance(waitDefinition, newRunState(NOW, "p1"), context(), NOW).nextRun;
    const resumed = resume(waitDefinition, waiting, "reply", LATER, "sí, sigo interesada");
    const result = advance(waitDefinition, resumed, context(), LATER);
    expect(result.effects.map((effect) => effect.kind)).toEqual(["set_responder"]);
    expect(result.nextRun.status).toBe("DONE");
    expect(result.nextRun.endReason).toBe("lo atiende un asesor");
    expect(result.nextRun.log.some((entry) => entry.branch === "onReply")).toBe(true);
  });

  it("si no responde a tiempo, sigue por la rama de espera vencida", () => {
    const waiting = advance(waitDefinition, newRunState(NOW, "p1"), context(), NOW).nextRun;
    const resumed = resume(waitDefinition, waiting, "timeout", LATER);
    const result = advance(waitDefinition, resumed, context(), LATER);
    expect(result.effects).toEqual([]);
    expect(result.nextRun.endReason).toBe("no contestó la retoma");
    expect(result.nextRun.log.some((entry) => entry.branch === "onTimeout")).toBe(true);
  });

  it("la condición toma cada rama según el dato del contacto", () => {
    const definition = parseDefinition({ kind: "CONTACT_TAGGED", filters: { tag: "vip" } }, [
      { id: "p1", type: "condition", params: { field: "contact.marketingOptIn", op: "eq" }, onTrue: "p2", onFalse: "p3" },
      { id: "p2", type: "notify", params: { text: "Aceptó marketing." }, next: "p3" },
      { id: "p3", type: "end", params: {} },
    ]);
    const sinConsentimiento = advance(definition, newRunState(NOW, "p1"), context(), NOW);
    expect(sinConsentimiento.effects).toEqual([]);
    expect(sinConsentimiento.nextRun.log[0]?.branch).toBe("onFalse");

    const conConsentimiento = advance(
      definition,
      newRunState(NOW, "p1"),
      context({ contact: { name: "Ana", phone: null, tags: [], hasDocument: true, marketingOptIn: true } }),
      NOW,
    );
    expect(conConsentimiento.effects.map((effect) => effect.kind)).toEqual(["notify"]);
    expect(conConsentimiento.nextRun.log[0]?.branch).toBe("onTrue");
  });

  it("un bucle sin espera termina al tope de 50 pasos", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "notify", params: { text: "vuelta" }, next: "p1" },
    ]);
    const result = advance(definition, newRunState(NOW, "p1"), context(), NOW);
    expect(result.effects).toHaveLength(50);
    expect(result.nextRun.status).toBe("DONE");
    expect(result.nextRun.endReason).toBe("superó los 50 pasos");
  });

  it("sin ventana abierta toma la rama «no se pudo enviar»", () => {
    const definition = parseDefinition({ kind: "CLIENT_SILENT", filters: { hours: 30 } }, [
      { id: "p1", type: "send_text", params: { text: "¿Seguimos?" }, onFail: "p3" },
      { id: "p2", type: "end", params: { reason: "mensaje enviado" } },
      { id: "p3", type: "require_advisor", params: { note: "No se le pudo escribir: llámalo." }, next: "p4" },
      { id: "p4", type: "end", params: { reason: "quedó para el asesor" } },
    ]);
    const cerrada = context({ conversation: { fromAd: false, hasAiAgent: false, windowOpen: false, advisorName: null } });
    const result = advance(definition, newRunState(NOW, "p1"), cerrada, NOW);
    expect(result.effects.map((effect) => effect.kind)).toEqual(["set_responder"]);
    expect(result.nextRun.endReason).toBe("quedó para el asesor");
    expect(result.nextRun.log[0]).toMatchObject({ result: "no se pudo enviar: ventana cerrada", branch: "onFail" });
  });

  it("sin rama de fallo, termina con el motivo del envío rechazado", () => {
    const definition = parseDefinition({ kind: "CLIENT_SILENT", filters: { hours: 30 } }, [
      { id: "p1", type: "send_text", params: { text: "¿Seguimos?" } },
      { id: "p2", type: "end", params: {} },
    ]);
    const cerrada = context({ conversation: { fromAd: false, hasAiAgent: false, windowOpen: false, advisorName: null } });
    const result = advance(definition, newRunState(NOW, "p1"), cerrada, NOW);
    expect(result.nextRun.endReason).toBe("no se pudo enviar: ventana cerrada");
  });

  it("una plantilla de marketing sin consentimiento no se envía", () => {
    const definition = parseDefinition({ kind: "ORDER_STATUS", filters: { status: "ENTREGADO" } }, [
      { id: "p1", type: "send_template", params: { templateId: "t1", values: {} } },
      { id: "p2", type: "end", params: {} },
    ]);
    const result = advance(definition, newRunState(NOW, "p1"), context({ templates: { t1: { name: "Promo", status: "APPROVED", category: "MARKETING" } } }), NOW);
    expect(result.effects).toEqual([]);
    expect(result.nextRun.endReason).toBe("sin consentimiento de marketing");
  });

  it("una plantilla aprobada de utilidad se envía con sus valores", () => {
    const definition = parseDefinition({ kind: "APPOINTMENT_DUE", filters: { hoursBefore: 2 } }, [
      { id: "p1", type: "send_template", params: { templateId: "t1", values: { "1": "{nombre}" } } },
      { id: "p2", type: "end", params: { reason: "recordatorio enviado" } },
    ]);
    const result = advance(definition, newRunState(NOW, "p1"), context({ templates: { t1: { name: "Recordatorio", status: "APPROVED", category: "UTILITY" } } }), NOW);
    expect(result.effects[0]).toMatchObject({ kind: "send_template", templateId: "t1", values: { "1": "Ana" } });
    expect(result.nextRun.endReason).toBe("recordatorio enviado");
  });

  it("la pausa deja la ejecución dormida y luego sigue en el paso siguiente", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "wait", params: { minutes: 30 } },
      { id: "p2", type: "add_tag", params: { tag: "seguimiento" } },
      { id: "p3", type: "end", params: {} },
    ]);
    const paused = advance(definition, newRunState(NOW, "p1"), context(), NOW).nextRun;
    expect(paused.status).toBe("WAITING");
    expect(paused.waitingForReply).toBe(false);
    expect(paused.resumeAt?.toISOString()).toBe("2026-09-12T15:30:00.000Z");
    const result = advance(definition, resume(definition, paused, "wait", LATER), context(), LATER);
    expect(result.effects.map((effect) => effect.kind)).toEqual(["add_tag"]);
    expect(result.nextRun.status).toBe("DONE");
  });

  it("detener una ejecución deja el motivo y no admite más pasos", () => {
    const stopped = stop(newRunState(NOW, "p1"), "lo tomó un asesor", LATER);
    expect(stopped.status).toBe("STOPPED");
    expect(stopped.endReason).toBe("lo tomó un asesor");
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [{ id: "p1", type: "notify", params: { text: "hola" } }]);
    expect(advance(definition, stopped, context(), LATER).effects).toEqual([]);
  });
});
