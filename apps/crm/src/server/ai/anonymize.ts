/**
 * Anonimización de los tramos que se guardan como ejemplo (SPEC-058 BR-005,
 * AC-010). Un ejemplo es material de entrenamiento del agente: no puede
 * conservar el nombre, el DNI ni el teléfono de nadie. Función pura.
 */

export interface AnonymizableTurn {
  role: "user" | "assistant";
  text: string;
}

export const NAME_MARKER = "[NOMBRE]";
export const DOCUMENT_MARKER = "[DNI]";
export const PHONE_MARKER = "[TELÉFONO]";

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Palabras del nombre que valen la pena reemplazar: se dejan fuera partículas como «de» o «la». */
function nameParts(displayName: string | null | undefined): string[] {
  if (!displayName) return [];
  const full = displayName.trim();
  if (!full) return [];
  const parts = full
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
  // Primero el nombre completo, para que no quede medio reemplazado.
  return [full, ...parts].filter((part, index, all) => all.indexOf(part) === index).sort((a, b) => b.length - a.length);
}

/**
 * Reemplaza teléfonos (9 dígitos o más), DNI (8 dígitos exactos) y el nombre
 * del contacto por marcadores. El orden importa: primero los números largos,
 * para que un teléfono no se convierta en un DNI a medias.
 */
export function anonymizeText(text: string, contactName?: string | null): string {
  let result = text;
  // Teléfonos: nueve dígitos o más, con espacios, puntos, guiones o «+» entremedio.
  result = result.replace(/(?<![\d])\+?\d[\d\s.-]{7,}\d(?!\d)/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 9 ? PHONE_MARKER : match;
  });
  // DNI: exactamente 8 dígitos seguidos.
  result = result.replace(/(?<!\d)\d{8}(?!\d)/g, DOCUMENT_MARKER);
  for (const part of nameParts(contactName)) {
    result = result.replace(new RegExp(`\\b${escapeForRegExp(part)}\\b`, "gi"), NAME_MARKER);
  }
  return result;
}

export function anonymizeTurns(turns: readonly AnonymizableTurn[], contactName?: string | null): AnonymizableTurn[] {
  return turns.map((turn) => ({ role: turn.role, text: anonymizeText(turn.text, contactName) }));
}
