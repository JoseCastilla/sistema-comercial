import { describe, expect, it } from "vitest";

import { articlesInForce, buildSystem, MANDATORY_POLICY, parseAgentConfig, parseSchedule } from "./prompt";

const NOW = new Date("2026-09-12T15:00:00Z");

const config = parseAgentConfig({
  displayName: "Sofía",
  objective: "Reunir los datos y agendar la llamada",
  tone: "Cercana y directa",
  must: ["Saluda por su nombre"],
  never: ["Prometer entrega el mismo día"],
  dataToCollect: ["Nombre", "DNI", "Distrito"],
  allowedTags: ["portabilidad", "linea nueva"],
});

describe("configuración del agente", () => {
  it("rellena lo que falta en vez de romperse", () => {
    const empty = parseAgentConfig(null);
    expect(empty.displayName).toBe("Asistente virtual");
    expect(empty.must).toEqual([]);
    expect(empty.allowedTags).toEqual([]);
  });

  it("descarta una configuración inválida entera y usa la de partida", () => {
    expect(parseAgentConfig({ must: "un texto suelto" }).must).toEqual([]);
  });

  it("el horario desconocido cae en «solo cuando no hay asesor»", () => {
    expect(parseSchedule({ mode: "CUANDO_SEA" }).mode).toBe("WHEN_NO_ADVISOR");
    expect(parseSchedule({ mode: "ALWAYS" }).mode).toBe("ALWAYS");
  });
});

describe("artículos vigentes", () => {
  const articles = [
    { id: "a", validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: null },
    { id: "b", validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: new Date("2026-09-01T00:00:00Z") },
    { id: "c", validFrom: new Date("2026-10-01T00:00:00Z"), validUntil: null },
    { id: "d", validFrom: new Date("2026-09-12T14:59:00Z"), validUntil: new Date("2026-09-12T15:00:01Z") },
  ];

  it("deja fuera lo vencido y lo que todavía no empieza", () => {
    expect(articlesInForce(articles, NOW).map((article) => article.id)).toEqual(["a", "d"]);
  });

  it("el fin es exclusivo: al llegar la hora deja de usarse", () => {
    const at = new Date("2026-09-01T00:00:00Z");
    expect(articlesInForce([articles[1]!], at)).toEqual([]);
  });

  it("acepta fechas en texto (las que llegan del snapshot publicado)", () => {
    const fromSnapshot = [{ id: "s", validFrom: "2026-01-01T00:00:00.000Z", validUntil: null }];
    expect(articlesInForce(fromSnapshot, NOW)).toHaveLength(1);
  });
});

describe("bloques del system", () => {
  const built = buildSystem({
    config,
    articles: [
      { id: "vigente", title: "Requisitos", content: "DNI vigente y línea activa.", validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: null },
      { id: "vencido", title: "Promo agosto", content: "Ya no aplica.", validFrom: new Date("2026-08-01T00:00:00Z"), validUntil: new Date("2026-09-01T00:00:00Z") },
    ],
    examples: [
      { id: "e1", kind: "GOOD", turns: [{ role: "user", text: "Hola" }, { role: "assistant", text: "Hola, soy la asistente virtual." }], note: null },
      { id: "e2", kind: "BAD", turns: [{ role: "assistant", text: "Te sale 39 soles." }], note: "Inventó el precio" },
    ],
    now: NOW,
    organizationName: "Distribuidor Online",
  });

  it("solo incluye artículos vigentes y los deja anotados", () => {
    const text = built.blocks.map((block) => block.text).join("\n");
    expect(text).toContain("Requisitos");
    expect(text).not.toContain("Promo agosto");
    expect(built.articleIds).toEqual(["vigente"]);
  });

  it("incluye la política obligatoria completa", () => {
    const text = built.blocks[0]?.text ?? "";
    for (const rule of MANDATORY_POLICY) expect(text).toContain(rule);
  });

  it("marca la caché solo en el último bloque", () => {
    const marked = built.blocks.filter((block) => block.cacheControl);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(built.blocks[built.blocks.length - 1]);
  });

  it("separa los ejemplos buenos de los malos", () => {
    const examples = built.blocks[built.blocks.length - 1]?.text ?? "";
    expect(examples).toContain("# Así sí");
    expect(examples).toContain("# Así no");
    expect(examples).toContain("Inventó el precio");
  });

  it("sin artículos vigentes le dice que derive en vez de inventar", () => {
    const alone = buildSystem({ config, articles: [], examples: [], now: NOW });
    expect(alone.blocks.map((block) => block.text).join("\n")).toContain("No hay artículos vigentes");
  });
});
