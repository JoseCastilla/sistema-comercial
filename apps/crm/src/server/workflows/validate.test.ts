import { describe, expect, it } from "vitest";

import { WORKFLOW_PRESETS } from "./presets";
import { parseDefinition } from "./schema";
import { blockingProblems, sendsMarketing, validateWorkflow, type TemplateFacts } from "./validate";

const APPROVED: TemplateFacts[] = [
  { id: "t1", name: "Recordatorio de cita", status: "APPROVED", category: "UTILITY" },
  { id: "t2", name: "Promoción del mes", status: "APPROVED", category: "MARKETING" },
  { id: "t3", name: "Aviso de entrega", status: "PENDING", category: "UTILITY" },
];

const errors = (definition: Parameters<typeof validateWorkflow>[0], templates: TemplateFacts[] = APPROVED) =>
  blockingProblems(validateWorkflow(definition, templates)).map((problem) => problem.message);

describe("validateWorkflow", () => {
  it("los flujos prearmados que no piden plantilla se pueden activar tal cual", () => {
    for (const preset of WORKFLOW_PRESETS) {
      const pidePlantilla = preset.definition.steps.some((step) => step.type === "send_template");
      if (pidePlantilla) continue;
      expect(errors(preset.definition), preset.name).toEqual([]);
    }
  });

  it("un flujo prearmado con plantilla sin elegir no se puede activar", () => {
    const preset = WORKFLOW_PRESETS.find((candidate) => candidate.key === "recordatorio-cita")!;
    expect(errors(preset.definition)).toEqual(["Elige la plantilla que se va a enviar."]);
  });

  it("una espera de respuesta sin rama «no respondió» bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "send_buttons", params: { text: "¿Te llamamos?", buttons: [{ id: "si", title: "Sí" }] } },
      { id: "p2", type: "wait_reply", params: { hours: 2 }, onReply: "p3" },
      { id: "p3", type: "end", params: {} },
    ]);
    expect(errors(definition)).toContain("Falta decir qué pasa si no responde: elige el paso de esa rama.");
  });

  it("un paso al que no se llega bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "end", params: {} },
      { id: "p2", type: "notify", params: { text: "nadie me ve" } },
    ]);
    expect(errors(definition)).toContain("No se llega a este paso desde el inicio: conéctalo o quítalo.");
  });

  it("un mensaje libre después de un día de espera bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "wait", params: { minutes: 1440 } },
      { id: "p2", type: "send_text", params: { text: "¿Seguimos?" } },
      { id: "p3", type: "end", params: {} },
    ]);
    expect(errors(definition)).toContain("Aquí ya pasaron 24 h desde el último mensaje del cliente: no se puede escribir libre, usa una plantilla.");
  });

  it("un mensaje libre tras una espera corta no bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "wait", params: { minutes: 120 } },
      { id: "p2", type: "send_text", params: { text: "¿Seguimos?" } },
      { id: "p3", type: "end", params: {} },
    ]);
    expect(errors(definition)).toEqual([]);
  });

  it("un mensaje libre con un disparador que no depende del chat solo avisa", () => {
    const definition = parseDefinition({ kind: "ORDER_STATUS", filters: { status: "ENTREGADO" } }, [
      { id: "p1", type: "send_text", params: { text: "Tu pedido llegó." } },
      { id: "p2", type: "end", params: {} },
    ]);
    const problems = validateWorkflow(definition, APPROVED);
    expect(blockingProblems(problems)).toEqual([]);
    expect(problems.map((problem) => problem.level)).toEqual(["aviso"]);
  });

  it("un bucle sin ninguna espera bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "notify", params: { text: "vuelta" }, next: "p2" },
      { id: "p2", type: "add_tag", params: { tag: "loop" }, next: "p1" },
    ]);
    expect(errors(definition)).toContain("Este camino vuelve sobre sí mismo sin ninguna espera: el flujo daría vueltas hasta el tope de 50 pasos.");
  });

  it("un bucle con espera no bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "wait", params: { minutes: 60 }, next: "p2" },
      { id: "p2", type: "notify", params: { text: "recordatorio" }, next: "p1" },
    ]);
    expect(errors(definition)).toEqual([]);
  });

  it("una plantilla no aprobada bloquea y una de marketing se marca", () => {
    const definition = parseDefinition({ kind: "APPOINTMENT_DUE", filters: { hoursBefore: 2 } }, [
      { id: "p1", type: "send_template", params: { templateId: "t3", values: {} } },
      { id: "p2", type: "end", params: {} },
    ]);
    expect(errors(definition)).toContain("Esa plantilla no está aprobada por Meta: elige una aprobada.");

    const marketing = parseDefinition({ kind: "APPOINTMENT_DUE", filters: { hoursBefore: 2 } }, [
      { id: "p1", type: "send_template", params: { templateId: "t2", values: {} } },
      { id: "p2", type: "end", params: {} },
    ]);
    expect(errors(marketing)).toEqual([]);
    expect(sendsMarketing(marketing, APPROVED)).toBe(true);
    expect(sendsMarketing(definition, APPROVED)).toBe(false);
  });

  it("un salto a un paso borrado bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "notify", params: { text: "hola" }, next: "p9" },
    ]);
    expect(errors(definition)).toContain("«Después» apunta a un paso que ya no existe.");
  });

  it("elegir un asesor concreto sin decir cuál bloquea", () => {
    const definition = parseDefinition({ kind: "INBOUND_MESSAGE", filters: {} }, [
      { id: "p1", type: "assign_advisor", params: { mode: "specific" } },
      { id: "p2", type: "end", params: {} },
    ]);
    expect(errors(definition)).toContain("Elige a qué asesor se asigna.");
  });
});
