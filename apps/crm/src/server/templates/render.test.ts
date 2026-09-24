import { describe, expect, it } from "vitest";

import { detectVariables, promotionalWordsIn, renderTemplateBody } from "./render";

describe("plantillas", () => {
  const components = [{ type: "HEADER", format: "TEXT", text: "Hola" }, { type: "BODY", text: "Hola {{1}}, tu cita es el {{2}}." }];

  it("renderiza el cuerpo con los valores en orden", () => {
    expect(renderTemplateBody(components, ["Ana", "lunes"])).toBe("Hola Ana, tu cita es el lunes.");
  });

  it("deja vacío lo que falta y no rompe", () => {
    expect(renderTemplateBody(components, ["Ana"])).toBe("Hola Ana, tu cita es el .");
    expect(renderTemplateBody(null, [])).toBe("");
  });

  it("detecta variables sin repetir", () => {
    expect(detectVariables("{{2}} y {{1}} y {{2}}")).toEqual([1, 2]);
  });

  it("avisa de palabras promocionales", () => {
    expect(promotionalWordsIn("Aprovecha la OFERTA de hoy")).toEqual(["oferta", "aprovecha"]);
    expect(promotionalWordsIn("Tu chip llega mañana")).toEqual([]);
  });
});
