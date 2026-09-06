import type { DniLookupStats } from "./dni.types";

/**
 * SPEC-045 PL-10: la actividad de consultas DNI se cuenta en dos alcances
 * —la propia y la de toda la organización, esta última solo para
 * administración— y distingue las consultas nuevas al proveedor (gastan
 * crédito) de las lecturas de la ficha guardada (no gastan).
 */
export interface DniSourceCounts {
  today: number;
  month: number;
  uniqueDnisThisMonth: number;
  /** Consultas del mes por origen: `API` gasta crédito, `CACHE` no. */
  apiThisMonth: number;
  cacheThisMonth: number;
}

export function buildDniLookupStats(
  personal: DniSourceCounts,
  organization: DniSourceCounts | null,
): DniLookupStats {
  return {
    today: personal.today,
    month: personal.month,
    uniqueDnisThisMonth: personal.uniqueDnisThisMonth,
    apiThisMonth: personal.apiThisMonth,
    cacheThisMonth: personal.cacheThisMonth,
    organization: organization
      ? {
          today: organization.today,
          month: organization.month,
          uniqueDnisThisMonth: organization.uniqueDnisThisMonth,
          apiThisMonth: organization.apiThisMonth,
          cacheThisMonth: organization.cacheThisMonth,
        }
      : null,
  };
}

/** Cuenta por origen a partir de un `groupBy` de eventos. */
export function splitBySource(
  rows: ReadonlyArray<{ source: string; count: number }>,
): { api: number; cache: number } {
  return rows.reduce(
    (sum, row) =>
      row.source === "API"
        ? { ...sum, api: sum.api + row.count }
        : { ...sum, cache: sum.cache + row.count },
    { api: 0, cache: 0 },
  );
}
