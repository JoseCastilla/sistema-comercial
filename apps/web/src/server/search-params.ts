/**
 * Lectura de parámetros de búsqueda en las páginas (SPEC-037, helpers
 * duplicados). Next entrega `string | string[] | undefined`; aquí siempre se
 * toma el primero. Antes había seis copias con dos firmas distintas.
 */
export type SearchParamValue = string | string[] | undefined;

export function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function firstValueOrEmpty(value: SearchParamValue): string {
  return firstValue(value) ?? "";
}
