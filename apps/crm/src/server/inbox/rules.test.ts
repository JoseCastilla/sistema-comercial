import { describe, expect, it } from "vitest";

import { applyQuickReply, deliveryGlyph, describeConversationEvent, groupTimelineByDay, listTimeLabel, matchQuickReplies, outboundOriginLabel, responderLabel, windowTone } from "./rules";

describe("etiqueta de quién responde", () => {
  it("dice quién escribe, no el nombre del estado", () => {
    expect(responderLabel("IA_ACTIVA")).toEqual({ label: "Asistente", tone: "info" });
    expect(responderLabel("REQUIERE_ASESOR")).toEqual({ label: "Requiere asesor", tone: "warning" });
    expect(responderLabel("CONTROL_HUMANO", "Ana")).toEqual({ label: "Asesor: Ana", tone: "success" });
    expect(responderLabel("CONTROL_HUMANO", null).label).toBe("Asesor");
  });

  it("el origen de cada saliente se nombra", () => {
    expect(outboundOriginLabel("USER", "Luis")).toBe("Luis");
    expect(outboundOriginLabel("USER")).toBe("Asesor");
    expect(outboundOriginLabel("AGENT_AI")).toBe("Asistente virtual");
    expect(outboundOriginLabel("WORKFLOW")).toBe("Flujo");
    expect(outboundOriginLabel("BROADCAST")).toBe("Difusión");
  });

  it("los estados de envío van en glifos y el fallo trae el motivo", () => {
    expect(deliveryGlyph("QUEUED").glyph).toBe("🕓");
    expect(deliveryGlyph("SENT").glyph).toBe("✓");
    expect(deliveryGlyph("DELIVERED")).toMatchObject({ glyph: "✓✓", tone: "sent" });
    expect(deliveryGlyph("READ")).toMatchObject({ glyph: "✓✓", tone: "read" });
    expect(deliveryGlyph("FAILED", "Número no registrado en WhatsApp")).toMatchObject({ glyph: "✗", title: "No se entregó: Número no registrado en WhatsApp" });
  });
});

describe("respuestas rápidas", () => {
  const replies = [
    { id: "1", shortcut: "saludo", body: "Hola {nombre}, soy {asesor} de Claro." },
    { id: "2", shortcut: "requisitos", body: "Necesitamos tu DNI y un recibo." },
  ];

  it("sustituye {nombre} y {asesor} y limpia espacios dobles si faltan", () => {
    expect(applyQuickReply(replies[0]!.body, { nombre: "Ana", asesor: "Luis" })).toBe("Hola Ana, soy Luis de Claro.");
    expect(applyQuickReply("Hola {nombre} , ¿cómo estás?", { nombre: null, asesor: "Luis" })).toBe("Hola , ¿cómo estás?");
  });

  it("el atajo «/» filtra por lo escrito y se cierra al seguir escribiendo", () => {
    expect(matchQuickReplies(replies, "/")).toHaveLength(2);
    expect(matchQuickReplies(replies, "/req").map((r) => r.id)).toEqual(["2"]);
    expect(matchQuickReplies(replies, "/saludo hola")).toEqual([]);
    expect(matchQuickReplies(replies, "hola")).toEqual([]);
  });
});

describe("línea de tiempo", () => {
  it("ordena cronológicamente y agrupa por día de Lima", () => {
    const now = new Date("2026-09-12T20:00:00Z");
    const items = [
      { id: "b", createdAt: new Date("2026-09-12T04:30:00Z") }, // 11/09 23:30 en Lima
      { id: "a", createdAt: new Date("2026-09-11T15:00:00Z") },
      { id: "c", createdAt: new Date("2026-09-12T15:00:00Z") },
    ];
    const days = groupTimelineByDay(items, "America/Lima", now);
    expect(days.map((d) => d.label)).toEqual(["Ayer", "Hoy"]);
    expect(days[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(days[1]!.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("con la misma hora mantiene un orden estable por id", () => {
    const at = new Date("2026-09-12T15:00:00Z");
    const days = groupTimelineByDay([{ id: "z", createdAt: at }, { id: "a", createdAt: at }], "America/Lima", at);
    expect(days[0]!.items.map((i) => i.id)).toEqual(["a", "z"]);
  });
});

describe("hora de la lista y ventana", () => {
  const now = new Date("2026-09-12T20:00:00Z"); // 15:00 en Lima

  it("hoy muestra la hora; antes, el día", () => {
    expect(listTimeLabel(new Date("2026-09-12T15:00:00Z"), "America/Lima", now)).toMatch(/10:00/);
    expect(listTimeLabel(new Date("2026-09-11T15:00:00Z"), "America/Lima", now)).toBe("Ayer");
    expect(listTimeLabel(null, "America/Lima", now)).toBe("");
  });

  it("la barra avisa cuando quedan menos de dos horas y cuando ya se cerró", () => {
    expect(windowTone(new Date(now.getTime() - 1 * 3_600_000), now)).toBe("neutral");
    expect(windowTone(new Date(now.getTime() - 23 * 3_600_000), now)).toBe("warning");
    expect(windowTone(new Date(now.getTime() - 25 * 3_600_000), now)).toBe("danger");
    expect(windowTone(null, now)).toBe("danger");
  });
});

describe("historial en lenguaje directo", () => {
  const names = new Map([["u-1", "Ana"], ["u-2", "Luis"]]);

  it("traduce ids a nombres y añade el motivo", () => {
    expect(describeConversationEvent({ type: "TRANSFERRED", actorUserId: "u-1", detail: { from: "u-1", to: "u-2", reason: "va de vacaciones" } }, names)).toBe("Ana la pasó de Ana a Luis · va de vacaciones");
    expect(describeConversationEvent({ type: "TOOK_CONTROL", actorUserId: "u-2", detail: { reason: "Respondió", cancelledPending: 1 } }, names)).toBe("Luis tomó el control · Respondió · se cancelaron 1 envío(s) automático(s)");
    expect(describeConversationEvent({ type: "OPENED", detail: { origin: "AD" } }, names)).toBe("Empezó desde un anuncio");
    expect(describeConversationEvent({ type: "UNATTENDED", detail: { minutes: 17 } }, names)).toBe("Sin respuesta del asesor durante 17 min");
  });
});
