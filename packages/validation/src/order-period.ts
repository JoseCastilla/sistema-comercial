import { z } from "zod";

export const orderPeriodSchema = z.enum(["TODAY", "WEEK", "MONTH", "HISTORY"]);

export type OrderPeriod = z.infer<typeof orderPeriodSchema>;

export interface OrderPeriodRange {
  period: OrderPeriod;
  start: Date | null;
  end: Date | null;
  monthStart: Date;
  monthEnd: Date;
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

  const utcWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (utcWeekday + 6) % 7;
  const mondayStart = limaMidnight(year, month, day - daysSinceMonday);
  const start = mondayStart < monthStart ? monthStart : mondayStart;
  const naturalEnd = new Date(mondayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const end = naturalEnd > monthEnd ? monthEnd : naturalEnd;

  return { period, start, end, monthStart, monthEnd };
}
