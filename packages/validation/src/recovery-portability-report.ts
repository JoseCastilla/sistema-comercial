/**
 * Lectura del reporte de portabilidad — SPEC-030 BR-018, BR-018b y BR-018c.
 *
 * Regla pura sobre el texto del archivo, sin dependencias de plataforma,
 * para poder probarla con los archivos reales. El API la envuelve con la
 * conversión de bytes a texto.
 */
import {
  isMovistarReceiver,
  parseRecoveryPortabilityState,
  parseRecoveryPortabilityWindow,
  type RecoveryPortabilityState,
} from "./recovery-portability.js";
import { normalizeRecoveryPhoneNumber } from "./recovery-base.js";

export type RecoveryPortabilityReportKind = "FULL" | "QUICK";

export interface ParsedPortabilityRow {
  serviceNumber: string;
  state: RecoveryPortabilityState;
  receiverRaw: string | null;
  cedentRaw: string | null;
  windowDate: Date | null;
  isMovistarReceiver: boolean;
  rawData: Record<string, string>;
}

export interface ParsedPortabilityReport {
  kind: RecoveryPortabilityReportKind;
  rows: ParsedPortabilityRow[];
  ignoredRows: number;
}

/**
 * Columnas que definen el reporte completo. La exportación real de la
 * herramienta de consulta trae seis columnas — `numero_consultado` y
 * `asignatario_original` pueden faltar según la versión —, así que solo se
 * exigen las distintivas (BR-018, corregido el 01/09/2026 con el archivo
 * real del cruce del día 27).
 */
const fullReportRequiredHeaders = [
  "numero",
  "receptor",
  "cedente",
  "fecha_de_la_ventana",
  "estado",
];

/**
 * Un archivo con cualquiera de estas columnas es un reporte de resultados,
 * nunca una lista de números activos: si no califica como reporte completo,
 * la importación se rechaza en lugar de caer al cruce rápido — ese fallback
 * descartaría también los números no portados (BR-018c).
 */
const fullReportSignatureHeaders = [
  "estado",
  "fecha_de_la_ventana",
  "receptor",
  "cedente",
];

export function parsePortabilityReportText(
  text: string,
  options: { quickColumn?: string | null } = {},
): ParsedPortabilityReport {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("El reporte no contiene filas de datos.");
  }

  const header = splitCsvLine(lines[0] ?? "").map((value) =>
    value.trim().toLowerCase(),
  );

  const isFullReport = fullReportRequiredHeaders.every((column) =>
    header.includes(column),
  );

  if (isFullReport) {
    return parseFullReport(header, lines);
  }

  const signatureColumns = fullReportSignatureHeaders.filter((column) =>
    header.includes(column),
  );

  if (signatureColumns.length > 0) {
    const missing = fullReportRequiredHeaders.filter(
      (column) => !header.includes(column),
    );

    throw new Error(
      `El archivo parece un reporte completo (trae ${signatureColumns.join(", ")}) pero le falta ${missing.join(", ")}. ` +
        "No se procesa como cruce rápido porque eso descartaría también los números no portados. Corrige el encabezado.",
    );
  }

  return parseQuickReport(header, lines, options.quickColumn ?? null);
}

function parseFullReport(
  header: string[],
  lines: string[],
): ParsedPortabilityReport {
  const index = (name: string) => header.indexOf(name);
  const columns = {
    numero: index("numero"),
    consultado: index("numero_consultado"),
    receptor: index("receptor"),
    cedente: index("cedente"),
    ventana: index("fecha_de_la_ventana"),
    estado: index("estado"),
    asignatario: index("asignatario_original"),
  };

  const rows: ParsedPortabilityRow[] = [];
  let ignoredRows = 0;

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const rawNumber =
      cells[columns.consultado] ?? cells[columns.numero] ?? null;
    const serviceNumber = normalizeRecoveryPhoneNumber(rawNumber);

    if (!serviceNumber) {
      ignoredRows += 1;
      continue;
    }

    const receiverRaw = cleanCell(cells[columns.receptor]);
    const state = parseRecoveryPortabilityState(cells[columns.estado]);

    rows.push({
      serviceNumber,
      state,
      receiverRaw,
      cedentRaw: cleanCell(cells[columns.cedente]),
      windowDate: parseRecoveryPortabilityWindow(cells[columns.ventana]),
      isMovistarReceiver: isMovistarReceiver(receiverRaw),
      rawData: {
        numero: cells[columns.numero] ?? "",
        receptor: cells[columns.receptor] ?? "",
        cedente: cells[columns.cedente] ?? "",
        asignatario_original: cells[columns.asignatario] ?? "",
        fecha_de_la_ventana: cells[columns.ventana] ?? "",
        estado: cells[columns.estado] ?? "",
      },
    });
  }

  return { kind: "FULL", rows, ignoredRows };
}

/**
 * El cruce rápido solo dice que el número ya está en Movistar, así que cada
 * fila se interpreta como `PORTADO` hacia Movistar y nunca aporta fechas.
 */
function parseQuickReport(
  header: string[],
  lines: string[],
  quickColumn: string | null,
): ParsedPortabilityReport {
  const requested = quickColumn?.trim().toLowerCase() ?? null;
  let columnIndex = requested ? header.indexOf(requested) : -1;

  if (columnIndex < 0) {
    columnIndex = header.findIndex((name) =>
      [
        "numero",
        "número",
        "telefono",
        "teléfono",
        "linea",
        "línea",
        "msisdn",
      ].includes(name),
    );
  }

  if (columnIndex < 0 && header.length === 1) {
    columnIndex = 0;
  }

  if (columnIndex < 0) {
    throw new Error(
      "No se pudo identificar la columna con el número. Indícala al subir el archivo.",
    );
  }

  const rows: ParsedPortabilityRow[] = [];
  const seen = new Set<string>();
  let ignoredRows = 0;

  const headerLooksLikeNumber =
    normalizeRecoveryPhoneNumber(header[columnIndex]) !== null;
  const dataLines = headerLooksLikeNumber ? lines : lines.slice(1);

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const serviceNumber = normalizeRecoveryPhoneNumber(cells[columnIndex]);

    if (!serviceNumber || seen.has(serviceNumber)) {
      ignoredRows += 1;
      continue;
    }

    seen.add(serviceNumber);
    rows.push({
      serviceNumber,
      state: "PORTADO",
      receiverRaw: "MOVISTAR",
      cedentRaw: null,
      windowDate: null,
      isMovistarReceiver: true,
      rawData: { numero: cells[columnIndex] ?? "" },
    });
  }

  return { kind: "QUICK", rows, ignoredRows };
}

function cleanCell(value: string | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length === 0 || text === "-" ? null : text;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }

      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === "," || char === ";") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);

  return cells;
}
