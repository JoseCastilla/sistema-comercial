/**
 * Filtros de las colas administrativas de Campañas — SPEC-030 fase 2 del
 * plan de usabilidad (05/09/2026).
 *
 * Aquí viven las decisiones que no dependen de la pantalla: cómo se llama un
 * plan para el ojo humano, qué tramos de antigüedad existen y qué fechas
 * abarca cada uno. Las tres páginas que filtran la base —triage,
 * distribución y la bandeja del asesor— tenían cada una su copia de
 * `summarizePlan`; una etiqueta podía cambiar en una y quedar vieja en las
 * otras dos.
 */
import { getLimaIsoDate } from "./order-period.js";

/**
 * Etiqueta comercial legible de un plan. La base trae el plan como texto
 * largo del sistema origen; lo que distingue a un plan de otro para quien
 * vende es el precio.
 */
export function summarizeRecoveryPlan(planRaw: string | null): string {
  if (!planRaw) return "—";

  const match = planRaw.match(/S\/\s?\d+(?:\.\d+)?/);

  return match ? `Máximo ${match[0]}` : planRaw;
}

/** Valor del filtro de equipo que significa «casos sin equipo asignado». */
export const recoveryTeamFilterNone = "none";

/**
 * Tramos de antigüedad comercial, sobre la fecha del último registro del
 * pedido (BR-004: la antigüedad se mide desde el pedido, nunca desde la
 * carga del archivo). Un lead frío pierde valor con cada día; más allá de
 * tres días casi no queda población, porque BR-084 vence a los siete.
 */
export type RecoveryAgeBucket = "hoy" | "ayer" | "2-3" | "mas";

export const recoveryAgeBuckets: ReadonlyArray<{
  value: RecoveryAgeBucket;
  label: string;
}> = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "2-3", label: "2 a 3 días" },
  { value: "mas", label: "Más de 3 días" },
];

export function parseRecoveryAgeBucket(
  value: string | null | undefined,
): RecoveryAgeBucket | null {
  const text = String(value ?? "").trim();

  return recoveryAgeBuckets.some((bucket) => bucket.value === text)
    ? (text as RecoveryAgeBucket)
    : null;
}

/** Medianoche de Lima del día que contiene `moment`, desplazada `days`. */
function limaDayStart(moment: Date, days: number): Date {
  const iso = getLimaIsoDate(moment);
  // Lima no cambia de horario: -05:00 vale todo el año.
  const start = new Date(`${iso}T00:00:00-05:00`);

  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Rango [gte, lt) de la fecha de registro para un tramo. Los tramos son
 * excluyentes y cubren toda la recta: nada queda en dos a la vez ni fuera
 * de todos.
 */
export function recoveryAgeBucketRange(
  bucket: RecoveryAgeBucket,
  now: Date,
): { gte?: Date; lt?: Date } {
  const today = limaDayStart(now, 0);

  switch (bucket) {
    case "hoy":
      return { gte: today };
    case "ayer":
      return { gte: limaDayStart(now, -1), lt: today };
    case "2-3":
      return { gte: limaDayStart(now, -3), lt: limaDayStart(now, -1) };
    case "mas":
      return { lt: limaDayStart(now, -3) };
  }
}
