/**
 * Reglas puras de plantillas: variables y vista previa del cuerpo.
 * `components` sigue el formato de Meta: [{ type: "BODY", text: "Hola {{1}}" }, …].
 */
export interface TemplateVariable {
  index: number;
  /** "contact.name" | "contact.phone" | "advisor.name" | "manual" */
  source: string;
  label?: string;
}

interface Component {
  type?: string;
  text?: string;
}

export function templateBodyText(components: unknown): string {
  if (!Array.isArray(components)) return "";
  const body = (components as Component[]).find((c) => (c.type ?? "").toUpperCase() === "BODY");
  return body?.text ?? "";
}

/** Sustituye {{1}}, {{2}}… por los valores en orden. Lo que falte queda vacío. */
export function renderTemplateBody(components: unknown, values: string[]): string {
  return templateBodyText(components).replace(/\{\{(\d+)\}\}/g, (_match, index: string) => values[Number(index) - 1] ?? "");
}

/** Detecta las variables numeradas del cuerpo, en orden y sin repetir. */
export function detectVariables(bodyText: string): number[] {
  const found = new Set<number>();
  for (const match of bodyText.matchAll(/\{\{(\d+)\}\}/g)) found.add(Number(match[1]));
  return [...found].sort((a, b) => a - b);
}

const PROMOTIONAL_WORDS = ["oferta", "descuento", "promoción", "promocion", "gratis", "aprovecha", "regalo"];

/** Una plantilla de utilidad con estas palabras la reclasifica Meta como marketing (SPEC-055 BR-005). */
export function promotionalWordsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return PROMOTIONAL_WORDS.filter((word) => lower.includes(word));
}
