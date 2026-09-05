/**
 * Composición de condiciones de consulta — SPEC-030 fase 1 de usabilidad
 * (05/09/2026), corrección COR-01.
 *
 * Las pantallas de campaña armaban su `where` por *spread* de fragmentos:
 * `{ ...alcance, ...vista, ...filtroDePlan }`. Cuando dos fragmentos usan la
 * misma clave, el último gana en silencio. Así fue como elegir un plan en el
 * triage **borraba** la condición de verificación: la vista aportaba
 * `services: { none: … }`, el plan aportaba `services: { some: … }`, y solo
 * sobrevivía el plan. El contador usaba el mismo objeto, así que contador y
 * lista coincidían entre sí y mentían los dos.
 *
 * `allOf` junta los fragmentos con `AND`, donde cada condición se conserva
 * entera. Los fragmentos vacíos, nulos o falsos se descartan para que el
 * llamador pueda escribir `filtro ? { … } : null` sin ensuciar la consulta.
 */
export function allOf<T extends object>(
  ...parts: Array<T | null | undefined | false>
): { AND: T[] } {
  const kept = parts.filter(
    (part): part is T =>
      part !== null &&
      part !== undefined &&
      part !== false &&
      Object.keys(part).length > 0,
  );

  return { AND: kept };
}
