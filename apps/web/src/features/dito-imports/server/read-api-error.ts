/** Mensaje de error de una respuesta de la API interna, si lo trae. */
export function readApiError(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return null;
}
