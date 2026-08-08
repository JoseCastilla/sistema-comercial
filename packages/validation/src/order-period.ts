import { z } from "zod";

export const orderPeriodSchema = z.enum([
  "TODAY",
  "YESTERDAY",
  "WEEK",
  "MONTH",
  "HISTORY",
  "RANGE",
]);

export type OrderPeriod = z.infer<typeof orderPeriodSchema>;

export interface OrderPeriodRange {
  period: OrderPeriod;
  start: Date | null;
  end: Date | null;
  monthStart: Date;
  monthEnd: Date;
}

export interface ParsedOrderRange {
  from: string;
  to: string;
}

const limaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function limaDateParts(value: Date) {
  const parts = Object.fromEntries(
    limaDateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year ?? value.getUTCFullYear(),
    month: parts.month ?? value.getUTCMonth() + 1,
    day: parts.day ?? value.getUTCDate(),
  };
}

function limaMidnight(year: number, month: number, day: number): Date {
  // Perú usa UTC-05:00 durante todo el año y no aplica horario de verano.
  return new Date(Date.UTC(year, month - 1, day, 5));
}

export function parseOrderPeriod(value: unknown): OrderPeriod {
  const result = orderPeriodSchema.safeParse(value);
  return result.success ? result.data : "MONTH";
}

export function getOrderPeriodRange(
  period: OrderPeriod,
  now = new Date(),
): OrderPeriodRange {
  const { year, month, day } = limaDateParts(now);
  const monthStart = limaMidnight(year, month, 1);
  const monthEnd = limaMidnight(year, month + 1, 1);

  if (period === "HISTORY") {
    return { period, start: null, end: null, monthStart, monthEnd };
  }

  if (period === "RANGE") {
    throw new Error("RANGE requiere fechas from/to válidas.");
  }

  if (period === "MONTH") {
    return { period, start: monthStart, end: monthEnd, monthStart, monthEnd };
  }

  const todayStart = limaMidnight(year, month, day);

  if (period === "TODAY") {
    return {
      period,
      start: todayStart,
      end: limaMidnight(year, month, day + 1),
      monthStart,
      monthEnd,
    };
  }

  if (period === "YESTERDAY") {
    return {
      period,
      start: limaMidnight(year, month, day - 1),
      end: todayStart,
      monthStart,
      monthEnd,
    };
  }

  const utcWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (utcWeekday + 6) % 7;
  const mondayStart = limaMidnight(year, month, day - daysSinceMonday);
  const start = mondayStart < monthStart ? monthStart : mondayStart;
  const naturalEnd = new Date(mondayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const end = naturalEnd > monthEnd ? monthEnd : naturalEnd;

  return { period, start, end, monthStart, monthEnd };
}

export function parseOrderRange(
  from: unknown,
  to: unknown,
): ParsedOrderRange | null {
  if (typeof from !== "string" || typeof to !== "string") return null;
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) return null;

  return { from, to };
}

export function getOrderRange(
  from: string,
  to: string,
  now = new Date(),
): OrderPeriodRange {
  const parsed = parseOrderRange(from, to);

  if (!parsed) throw new Error("El rango de fechas no es válido.");

  const startParts = isoDateParts(parsed.from);
  const endParts = isoDateParts(parsed.to);
  const current = limaDateParts(now);

  return {
    period: "RANGE",
    start: limaMidnight(startParts.year, startParts.month, startParts.day),
    end: limaMidnight(endParts.year, endParts.month, endParts.day + 1),
    monthStart: limaMidnight(current.year, current.month, 1),
    monthEnd: limaMidnight(current.year, current.month + 1, 1),
  };
}

function isoDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const { year, month, day } = isoDateParts(value);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}
