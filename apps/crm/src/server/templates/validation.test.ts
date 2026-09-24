import { describe, expect, it } from "vitest";

import {
  buildTemplateComponents,
  isValidTemplateName,
  normalizeTemplateName,
  templatePreview,
  templateVariablesFor,
  templateWarnings,
  validateTemplateDraft,
  type TemplateDraft,
} from "./validation";

function draft(overrides: Partial<TemplateDraft> = {}): TemplateDraft {
  return {
    name: "recordatorio_de_cita",
    language: "es",
    category: "UTILITY",
    header: "Tu cita con nosotros",
    body: "Hola {{1}}, te esperamos el {{2}} en la tienda. Si no puedes, respóndenos y la movemos.",
    footer: "Alka Perú",
    buttons: [{ type: "QUICK_REPLY", text: "Confirmo" }],
    variables: [
      { index: 1, source: "contact.name", label: "Nombre", example: "Ana" },
      { index: 2, source: "manual", label: "Fecha", example: "lunes 14 a las 10:00" },
    ],
    ...overrides,
  };
}

describe("nombre de la plantilla", () => {
  it("lo deja como lo pide Meta", () => {
    expect(normalizeTemplateName("Recordatorio de Cita")).toBe("recordatorio_de_cita");
    expect(normalizeTemplateName("  Confirmación   de  entrega ")).toBe("confirmacion_de_entrega");
    expect(normalizeTemplateName("¡Oferta 2x1!")).toBe("oferta_2x1");
  });

  it("valida el formato final", () => {
    expect(isValidTemplateName("recordatorio_de_cita")).toBe(true);
    expect(isValidTemplateName("Recordatorio")).toBe(false);
    expect(isValidTemplateName("con-guion")).toBe(false);
    expect(isValidTemplateName("")).toBe(false);
  });
});

describe("validación antes de mandarla a Meta", () => {
  it("una plantilla bien armada no tiene problemas", () => {
    expect(validateTemplateDraft(draft())).toEqual([]);
  });

  it("dice cuánto sobra en cada parte", () => {
    const errors = validateTemplateDraft(
      draft({ body: "a".repeat(1030), header: "b".repeat(70), footer: "c".repeat(65), variables: [] }),
    );
    expect(errors).toContain("El cuerpo tiene 1030 caracteres: sobran 6 (el máximo de WhatsApp es 1024).");
    expect(errors).toContain("El encabezado tiene 70 caracteres: sobran 10 (el máximo de WhatsApp es 60).");
    expect(errors).toContain("El pie tiene 65 caracteres: sobran 5 (el máximo de WhatsApp es 60).");
  });

  it("el texto de un botón no pasa de 25 caracteres y no se repite", () => {
    const errors = validateTemplateDraft(
      draft({
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmo mi cita del lunes en la tienda" },
          { type: "QUICK_REPLY", text: "Confirmo mi cita del lunes en la tienda" },
        ],
      }),
    );
    expect(errors.some((error) => error.includes("sobran 14"))).toBe(true);
    expect(errors).toContain("Dos botones no pueden decir lo mismo.");
  });

  it("un botón de enlace necesita dirección web", () => {
    expect(validateTemplateDraft(draft({ buttons: [{ type: "URL", text: "Ver planes", url: "tienda.pe" }] }))).toContain(
      "El botón 1 necesita una dirección web que empiece con https://",
    );
    expect(validateTemplateDraft(draft({ buttons: [{ type: "URL", text: "Ver planes", url: "https://alka.pe/planes" }] }))).toEqual([]);
  });

  it("cada variable necesita ejemplo y numeración seguida", () => {
    expect(validateTemplateDraft(draft({ variables: [{ index: 1, source: "contact.name", label: "Nombre", example: "" }, { index: 2, source: "manual", label: "Fecha", example: "lunes" }] }))).toContain(
      "Escribe un ejemplo para {{1}}: Meta rechaza la plantilla sin él.",
    );
    expect(validateTemplateDraft(draft({ body: "Hola {{2}}, tu pedido llegó.", variables: [] }))).toContain(
      "Numera las variables seguidas desde {{1}}: si usas {{2}} tiene que existir {{1}}.",
    );
    expect(validateTemplateDraft(draft({ body: "Hola {{1}}", variables: [] }))).toContain("Falta decir qué va en {{1}}.");
  });

  it("el encabezado no admite variables y el nombre debe ser válido", () => {
    expect(validateTemplateDraft(draft({ header: "Hola {{1}}" }))).toContain(
      "El encabezado no admite variables aquí: escribe un texto fijo y deja las variables para el cuerpo.",
    );
    expect(validateTemplateDraft(draft({ name: "Recordatorio Cita" }))).toContain(
      "El nombre solo admite minúsculas, números y guiones bajos (por ejemplo: recordatorio_de_cita).",
    );
    expect(validateTemplateDraft(draft({ language: "espanol" }))).toContain("El idioma se escribe como «es» o «es_MX».");
  });
});

describe("avisos", () => {
  it("una plantilla de utilidad con palabras promocionales avisa del costo", () => {
    const warnings = templateWarnings(draft({ body: "Hola {{1}}, aprovecha esta oferta de hoy en tu {{2}}." }));
    expect(warnings[0]).toContain("«oferta»");
    expect(warnings[0]).toContain("Marketing");
  });

  it("una de marketing con las mismas palabras no avisa", () => {
    expect(templateWarnings(draft({ category: "MARKETING", body: "Aprovecha la oferta de hoy en tu plan nuevo de fibra." }))).toEqual([]);
  });
});

describe("cuerpo que se le manda a Meta", () => {
  it("arma los componentes con el ejemplo obligatorio", () => {
    expect(buildTemplateComponents(draft())).toEqual([
      { type: "HEADER", format: "TEXT", text: "Tu cita con nosotros" },
      {
        type: "BODY",
        text: "Hola {{1}}, te esperamos el {{2}} en la tienda. Si no puedes, respóndenos y la movemos.",
        example: { body_text: [["Ana", "lunes 14 a las 10:00"]] },
      },
      { type: "FOOTER", text: "Alka Perú" },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Confirmo" }] },
    ]);
  });

  it("sin variables no manda ejemplo", () => {
    const components = buildTemplateComponents(draft({ body: "Tu chip ya salió a reparto.", header: null, footer: null, buttons: [], variables: [] }));
    expect(components).toEqual([{ type: "BODY", text: "Tu chip ya salió a reparto." }]);
  });

  it("guarda el origen de cada variable y arma la vista previa", () => {
    expect(templateVariablesFor(draft())).toEqual([
      { index: 1, source: "contact.name", label: "Nombre" },
      { index: 2, source: "manual", label: "Fecha" },
    ]);
    expect(templatePreview(draft())).toBe(
      "Tu cita con nosotros\n\nHola Ana, te esperamos el lunes 14 a las 10:00 en la tienda. Si no puedes, respóndenos y la movemos.\n\nAlka Perú",
    );
  });
});
