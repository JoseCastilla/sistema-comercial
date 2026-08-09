export interface PerformanceMonthRange {
  key: string;
  start: Date;
  end: Date;
  from: string;
  to: string;
}

const limaMonthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
});

function limaMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

function monthParts(value: string): { year: number; month: number } {
  const [year = 0, month = 0] = value.split("-").map(Number);
  return { year, month };
}

export function parsePerformanceMonth(
  value: unknown,
  now = new Date(),
): string {
  const current = limaMonthFormatter.format(now);
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    return current;
  }

  const { year, month } = monthParts(value);
  return year >= 2000 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12 &&
    value <= current
    ? value
    : current;
}

export function getPerformanceMonthRange(key: string): PerformanceMonthRange {
  const parsed = parsePerformanceMonth(key);
  const { year, month } = monthParts(parsed);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    key: parsed,
    start: limaMidnight(year, month, 1),
    end: limaMidnight(year, month + 1, 1),
    from: `${parsed}-01`,
    to: `${parsed}-${pad(lastDay)}`,
  };
}

export function shiftPerformanceMonth(key: string, offset: number): string {
  const parsed = parsePerformanceMonth(key);
  const { year, month } = monthParts(parsed);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return monthKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1);
}
