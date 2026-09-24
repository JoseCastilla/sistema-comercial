import { describe, expect, it } from "vitest";

import { districtCoverage, normalizeDistrict } from "./coverage";
import {
  ALWAYS_ON_TOOLS,
  DEFAULT_TOOLS,
  FORBIDDEN_CAPABILITIES,
  isToolName,
  TOOL_DEFINITIONS,
  TOOL_LABELS,
  TOOL_NAMES,
  toolDefinitionsFor,
} from "./tool-definitions";

/**
 * SPEC-058 BR-008 / AC-011: el agente no tiene forma de ingresar un pedido,
 * consultar el DNI pagado, cambiar de asesor ni enviar plantillas. La prueba
 * es sobre la lista de herramientas registradas, que es lo único que el
 * modelo puede llamar.
 */
describe("lista de herramientas registradas", () => {
  it("son exactamente las nueve del catálogo", () => {
    expect([...TOOL_NAMES]).toEqual([
      "guardar_dato_lead",
      "consultar_planes",
      "consultar_cobertura",
      "consultar_horarios",
      "avanzar_oportunidad",
      "agendar_llamada",
      "pasar_a_asesor",
      "etiquetar",
      "registrar_baja",
    ]);
  });

  it("no incluye ninguna capacidad prohibida", () => {
    for (const forbidden of FORBIDDEN_CAPABILITIES) {
      expect(TOOL_NAMES as readonly string[]).not.toContain(forbidden);
    }
  });

  it("ninguna herramienta habla de pedidos, DNI pagado, cambiar asesor ni plantillas", () => {
    const text = Object.values(TOOL_DEFINITIONS)
      .map((tool) => `${tool.name} ${tool.description}`)
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/ingresa(r)? (un )?pedido/);
    expect(text).not.toMatch(/reniec|servicio pagado|consulta de dni/);
    expect(text).not.toMatch(/cambiar de asesor|reasignar/);
    expect(text).not.toMatch(/plantilla de marketing|enviar plantilla/);
  });

  it("cada herramienta tiene esquema estricto: sin claves extra y todo obligatorio", () => {
    for (const tool of Object.values(TOOL_DEFINITIONS)) {
      const schema = tool.inputSchema as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(schema.additionalProperties).toBe(false);
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });

  it("cada herramienta tiene texto para la pantalla", () => {
    for (const name of TOOL_NAMES) {
      expect(TOOL_LABELS[name].title.length).toBeGreaterThan(0);
      expect(TOOL_LABELS[name].help.length).toBeGreaterThan(0);
    }
  });

  it("reconoce nombres válidos e ignora los inventados", () => {
    expect(isToolName("pasar_a_asesor")).toBe(true);
    expect(isToolName("ingresar_pedido")).toBe(false);
  });
});

describe("herramientas activas de una versión", () => {
  it("derivar a un asesor está siempre disponible aunque no se marque", () => {
    const names = toolDefinitionsFor(["consultar_planes"]).map((tool) => tool.name);
    expect(names).toContain("pasar_a_asesor");
    for (const always of ALWAYS_ON_TOOLS) expect(names).toContain(always);
  });

  it("respeta el orden del catálogo para que la caché no se invalide", () => {
    const names = toolDefinitionsFor(["registrar_baja", "guardar_dato_lead", "consultar_planes"]).map((tool) => tool.name);
    expect(names).toEqual(["guardar_dato_lead", "consultar_planes", "pasar_a_asesor", "registrar_baja"]);
  });

  it("las de partida son de lectura y recolección, no de avance", () => {
    expect(DEFAULT_TOOLS).not.toContain("avanzar_oportunidad");
    expect(DEFAULT_TOOLS).toContain("pasar_a_asesor");
  });
});

describe("cobertura de reparto", () => {
  it("reconoce distritos con y sin tildes", () => {
    expect(districtCoverage("san isidro").covered).toBe(true);
    expect(districtCoverage("Jesus Maria").district).toBe("Jesús María");
    expect(normalizeDistrict("  Villa  El   Salvador ")).toBe("villa el salvador");
  });

  it("acepta la forma corta cuando es inequívoca", () => {
    expect(districtCoverage("Surco").district).toBe("Santiago de Surco");
  });

  it("fuera de la lista no promete nada", () => {
    expect(districtCoverage("Trujillo")).toEqual({ district: null, covered: false });
    expect(districtCoverage("")).toEqual({ district: null, covered: false });
  });
});
