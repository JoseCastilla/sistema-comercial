/**
 * Horario de las consultas automáticas a Máximo (SPEC-046 BR-007, José,
 * 06/09/2026): 08:00, 12:00, 15:00 y 18:00 de Lima. Cualquier otra consulta
 * es manual. Aquí vive la única lista de horas; la sincronización y la
 * pantalla de Logística la leen de aquí para no discrepar (SPEC-045 PL-07).
 */
export const agrSyncSlotHours: readonly number[] = [8, 12, 15, 18];

const dayMs = 24 * 60 * 60 * 1000;

function limaParts(now: Date): {
  year: string;
  month: string;
  day: string;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    minutes: (Number(read("hour")) % 24) * 60 + Number(read("minute")),
  };
}

function limaSlotDate(
  parts: { year: string; month: string; day: string },
  hour: number,
  offsetDays = 0,
): Date {
  // Lima no cambia de horario: -05:00 vale todo el año.
  const base = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:00:00-05:00`,
  );
  return new Date(base.getTime() + offsetDays * dayMs);
}

/**
 * Clave idempotente de la ventana vigente: la última hora programada que ya
 * pasó hoy, o `null` antes de la primera. Una sola ejecución por clave.
 */
export function resolveAgrScheduleKey(now = new Date()): string | null {
  const parts = limaParts(now);
  const slot = [...agrSyncSlotHours]
    .reverse()
    .find((hour) => parts.minutes >= hour * 60);
  if (slot === undefined) return null;
  return `${parts.year}-${parts.month}-${parts.day}-${String(slot).padStart(2, "0")}00`;
}

export interface AgrScheduleView {
  /** Última consulta automática que ya debió ocurrir, o `null` antes de la primera del día. */
  lastExpectedAt: Date | null;
  /** Próxima consulta automática. */
  nextAt: Date;
  /** Si la fuente es más antigua que la última ventana esperada. */
  delayed: boolean;
}

/**
 * PL-07: la hora de la fuente no es la hora de la pantalla. Se dice cuándo
 * debió correr la última consulta, cuándo corre la siguiente, y si la fuente
 * quedó atrás respecto del horario esperado. Se concede un margen de diez
 * minutos porque el reloj dispara en los cinco minutos siguientes a la hora.
 */
export function describeAgrSchedule(
  now: Date,
  lastSuccessAt: Date | null,
): AgrScheduleView {
  const parts = limaParts(now);
  const passed = agrSyncSlotHours.filter((hour) => parts.minutes >= hour * 60);
  const upcoming = agrSyncSlotHours.filter((hour) => parts.minutes < hour * 60);
  const lastExpectedAt =
    passed.length > 0
      ? limaSlotDate(parts, passed[passed.length - 1] as number)
      : null;
  const nextAt =
    upcoming.length > 0
      ? limaSlotDate(parts, upcoming[0] as number)
      : limaSlotDate(parts, agrSyncSlotHours[0] as number, 1);
  const graceMs = 10 * 60 * 1000;
  const delayed =
    lastExpectedAt !== null &&
    now.getTime() - lastExpectedAt.getTime() > graceMs &&
    (lastSuccessAt === null ||
      lastSuccessAt.getTime() < lastExpectedAt.getTime());

  return { lastExpectedAt, nextAt, delayed };
}
