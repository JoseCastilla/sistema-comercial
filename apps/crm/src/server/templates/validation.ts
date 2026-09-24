import { detectVariables, promotionalWordsIn, templateBodyText } from "./render";

/**
 * Reglas de las plantillas antes de mandarlas a Meta (SPEC-055 BR-003/BR-004).
 * Todo puro: la pantalla y la acción de servidor usan lo mismo.
 *
 * Topes según https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */
export const TEMPLATE_LIMITS = {
  name: 512,
  header: 60,
  body: 1024,
  footer: 60,
  buttonText: 25,
  buttonUrl: 2000,
  /** El MVP arma hasta tres botones; Meta admite más tipos que aquí no se usan. */
  buttons: 3,
} as const;

export type TemplateCategoryValue = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface TemplateButtonDraft {
  type: "QUICK_REPLY" | "URL";
  text: string;
  url?: string | null;
}

export interface TemplateVariableDraft {
  index: number;
  /** contact.name | contact.phone | advisor.name | manual */
  source: string;
  label: string;
  /** Meta exige un ejemplo por variable. */
  example: string;
}

export interface TemplateDraft {
  name: string;
  language: string;
  category: TemplateCategoryValue;
  header?: string | null;
  body: string;
  footer?: string | null;
  buttons: TemplateButtonDraft[];
  variables: TemplateVariableDraft[];
}

export const VARIABLE_SOURCES = [
  ["contact.name", "Nombre del contacto"],
  ["contact.phone", "Teléfono del contacto"],
  ["advisor.name", "Nombre del asesor"],
  ["manual", "Lo completa quien envía"],
] as const;

/** Meta solo admite minúsculas, números y guiones bajos en el nombre. */
export function normalizeTemplateName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, TEMPLATE_LIMITS.name);
}

export function isValidTemplateName(name: string): boolean {
  return /^[a-z0-9_]{1,512}$/.test(name);
}

function tooLong(what: string, text: string, limit: number): string | null {
  const length = [...text].length;
  if (length <= limit) return null;
  return `${what} tiene ${length} caracteres: sobran ${length - limit} (el máximo de WhatsApp es ${limit}).`;
}

/**
 * Devuelve los problemas que impiden enviar la plantilla a revisión, en
 * lenguaje directo. Lista vacía = se puede enviar.
 */
export function validateTemplateDraft(draft: TemplateDraft): string[] {
  const errors: string[] = [];

  if (!draft.name) {
    errors.push("Ponle un nombre a la plantilla.");
  } else if (!isValidTemplateName(draft.name)) {
    errors.push("El nombre solo admite minúsculas, números y guiones bajos (por ejemplo: recordatorio_de_cita).");
  }
  if (!/^[a-z]{2}(_[A-Za-z]{2})?$/.test(draft.language)) {
    errors.push("El idioma se escribe como «es» o «es_MX».");
  }

  const body = draft.body.trim();
  if (!body) errors.push("Escribe el cuerpo del mensaje.");
  const bodyTooLong = tooLong("El cuerpo", body, TEMPLATE_LIMITS.body);
  if (bodyTooLong) errors.push(bodyTooLong);

  const header = draft.header?.trim() ?? "";
  if (header) {
    const headerTooLong = tooLong("El encabezado", header, TEMPLATE_LIMITS.header);
    if (headerTooLong) errors.push(headerTooLong);
    if (/\{\{\d+\}\}/.test(header)) {
      errors.push("El encabezado no admite variables aquí: escribe un texto fijo y deja las variables para el cuerpo.");
    }
  }

  const footer = draft.footer?.trim() ?? "";
  const footerTooLong = tooLong("El pie", footer, TEMPLATE_LIMITS.footer);
  if (footerTooLong) errors.push(footerTooLong);

  if (draft.buttons.length > TEMPLATE_LIMITS.buttons) {
    errors.push(`Puedes poner hasta ${TEMPLATE_LIMITS.buttons} botones.`);
  }
  for (const [position, button] of draft.buttons.entries()) {
    const label = `El botón ${position + 1}`;
    if (!button.text.trim()) {
      errors.push(`${label} no tiene texto.`);
      continue;
    }
    const textTooLong = tooLong(`El texto ${label.toLowerCase()}`, button.text.trim(), TEMPLATE_LIMITS.buttonText);
    if (textTooLong) errors.push(textTooLong);
    if (button.type === "URL") {
      const url = button.url?.trim() ?? "";
      if (!/^https?:\/\/\S+$/.test(url)) errors.push(`${label} necesita una dirección web que empiece con https://`);
      if (url.length > TEMPLATE_LIMITS.buttonUrl) errors.push(`${label} tiene una dirección demasiado larga.`);
    }
  }
  const repeated = draft.buttons.map((button) => button.text.trim().toLowerCase()).filter((text, index, all) => text && all.indexOf(text) !== index);
  if (repeated.length) errors.push("Dos botones no pueden decir lo mismo.");

  // Variables: consecutivas desde {{1}} y todas con ejemplo, que Meta exige.
  const detected = detectVariables(body);
  const expected = detected.map((_value, index) => index + 1);
  if (detected.join(",") !== expected.join(",")) {
    errors.push("Numera las variables seguidas desde {{1}}: si usas {{2}} tiene que existir {{1}}.");
  }
  for (const index of detected) {
    const variable = draft.variables.find((item) => item.index === index);
    if (!variable) {
      errors.push(`Falta decir qué va en {{${index}}}.`);
      continue;
    }
    if (!variable.example.trim()) {
      errors.push(`Escribe un ejemplo para {{${index}}}: Meta rechaza la plantilla sin él.`);
    }
    if (/\{\{|\}\}/.test(variable.example)) {
      errors.push(`El ejemplo de {{${index}}} no puede llevar llaves.`);
    }
  }

  return errors;
}

/** Avisos que no impiden enviar, pero conviene leer antes. */
export function templateWarnings(draft: TemplateDraft): string[] {
  const warnings: string[] = [];
  const full = `${draft.header ?? ""} ${draft.body} ${draft.footer ?? ""}`;
  if (draft.category === "UTILITY") {
    const words = promotionalWordsIn(full);
    if (words.length) {
      warnings.push(
        `Dice «${words.join("», «")}»: Meta la va a pasar a Marketing y cada envío te va a costar. Si es un aviso de algo que la persona ya pidió, quita esas palabras.`,
      );
    }
  }
  if (draft.body.trim().length < 20) {
    warnings.push("El cuerpo es muy corto: Meta suele rechazar plantillas que no dicen de qué se trata.");
  }
  return warnings;
}

// ───────────────────────── Cuerpo para Meta ─────────────────────────

export interface MetaComponentDraft {
  type: string;
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: { type: string; text: string; url?: string }[];
}

/**
 * Componentes tal como los pide Meta al crear la plantilla, con el
 * `example.body_text` obligatorio cuando hay variables.
 */
export function buildTemplateComponents(draft: TemplateDraft): MetaComponentDraft[] {
  const components: MetaComponentDraft[] = [];
  const header = draft.header?.trim();
  if (header) components.push({ type: "HEADER", format: "TEXT", text: header });

  const body = draft.body.trim();
  const indexes = detectVariables(body);
  const examples = indexes.map((index) => draft.variables.find((variable) => variable.index === index)?.example.trim() ?? "");
  components.push({
    type: "BODY",
    text: body,
    ...(indexes.length ? { example: { body_text: [examples] } } : {}),
  });

  const footer = draft.footer?.trim();
  if (footer) components.push({ type: "FOOTER", text: footer });

  if (draft.buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: draft.buttons.slice(0, TEMPLATE_LIMITS.buttons).map((button) =>
        button.type === "URL"
          ? { type: "URL", text: button.text.trim(), url: (button.url ?? "").trim() }
          : { type: "QUICK_REPLY", text: button.text.trim() },
      ),
    });
  }
  return components;
}

/** Variables que se guardan en `MessageTemplate.variables`. */
export function templateVariablesFor(draft: TemplateDraft): { index: number; source: string; label: string }[] {
  return detectVariables(draft.body.trim()).map((index) => {
    const variable = draft.variables.find((item) => item.index === index);
    return { index, source: variable?.source ?? "manual", label: variable?.label?.trim() || `Variable ${index}` };
  });
}

/** Vista previa de cómo se verá en WhatsApp, con los ejemplos puestos. */
export function templatePreview(draft: TemplateDraft): string {
  const values = detectVariables(draft.body.trim()).map(
    (index) => draft.variables.find((variable) => variable.index === index)?.example.trim() || `{{${index}}}`,
  );
  const body = draft.body.trim().replace(/\{\{(\d+)\}\}/g, (_match, index: string) => values[Number(index) - 1] ?? "");
  return [draft.header?.trim(), body, draft.footer?.trim()].filter(Boolean).join("\n\n");
}

/** Texto del cuerpo de una plantilla ya guardada (para la lista). */
export function bodyOf(components: unknown): string {
  return templateBodyText(components);
}
