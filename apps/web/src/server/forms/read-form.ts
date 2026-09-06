/**
 * Lectura de campos de formulario en las acciones de servidor (SPEC-037,
 * helpers duplicados). Antes `readText` vivía idéntico en ocho archivos,
 * `readPassword` en dos y el patrón de UUID en tres —con dos versiones: una
 * aceptaba las versiones 1 a 8 y otra solo 1 a 5, así que un identificador
 * v7 rompía la idempotencia de los intentos de recupero sin avisar—.
 */
export function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Una contraseña no se recorta: los espacios pueden ser parte de ella. */
export function readPassword(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** UUID de cualquier versión (1 a 8), como los genera `crypto.randomUUID`. */
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function readUuid(value: FormDataEntryValue | null): string | null {
  const text = readText(value);
  return isUuid(text) ? text : null;
}
