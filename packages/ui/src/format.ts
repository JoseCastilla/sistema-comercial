/**
 * Formato único de cifras para toda la plataforma.
 *
 * Antes cada módulo resolvía esto por su cuenta: `toLocaleString("es-PE")`
 * repetido inline, un `Intl.NumberFormat` privado dentro del dashboard de
 * rendimiento que nadie más podía importar, y `toFixed()` suelto. El resultado
 * era que la misma variable salía «1234» en una tarjeta y «1.234» tres líneas
 * más abajo. Todo formato de número vive acá.
 */
const LOCALE = "es-PE";
const CURRENCY = "PEN";

/*
 * Sin separador de miles, por decision de producto.
 *
 * `es-PE` agrupa con coma (1,234) porque asi se escribe en Peru, pero en esta
 * herramienta la enorme mayoria de las cifras son conteos de dos o tres
 * digitos: el separador casi nunca aparece y, cuando aparece, mete un signo
 * que compite con el punto decimal en la misma pantalla. El punto sigue siendo
 * el separador decimal.
 */
const countFormatter = new Intl.NumberFormat(LOCALE, { useGrouping: false });

/**
 * Espacio fino de no separación (U+202F) para agrupar los miles del importe.
 *
 * Los conteos van sin separador —son de dos o tres dígitos y el signo solo
 * estorba—, pero un importe largo sin agrupar es ilegible: «S/ 1234567.89».
 * El espacio fino agrupa sin introducir una coma que compita con el punto
 * decimal, y al ser de no separación el importe nunca se parte al final de
 * una línea.
 */
const THIN_SPACE = "\u202F";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
  useGrouping: false,
});

/** Marcador para un dato ausente. Nunca un cero ni una cadena vacía. */
export const EMPTY_VALUE = "—";

/** Conteos y totales enteros: 1234 → «1234». */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }

  return countFormatter.format(value);
}

/** Importes guardados en céntimos: 123456789 → «S/ 1 234 567.89». */
export function formatMoneyFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return EMPTY_VALUE;
  }

  return moneyFormatter
    .formatToParts(cents / 100)
    .map((part) => (part.type === "group" ? THIN_SPACE : part.value))
    .join("");
}

/** Proporciones ya normalizadas: 0.128 → «12.8 %». */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return EMPTY_VALUE;
  }

  return percentFormatter.format(ratio);
}

/** Promedios y tasas con decimales fijos: 4.28 → «4.3». */
export function formatDecimal(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
}
