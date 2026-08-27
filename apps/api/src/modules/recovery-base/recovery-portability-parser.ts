import {
  isMovistarReceiver,
  normalizeRecoveryPhoneNumber,
  parseRecoveryPortabilityState,
  parseRecoveryPortabilityWindow,
  type RecoveryPortabilityState,
} from '@repo/validation';

export type RecoveryPortabilityReportKind = 'FULL' | 'QUICK';

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

const fullReportHeaders = [
  'numero',
  'receptor',
  'cedente',
  'asignatario_original',
  'fecha_de_la_ventana',
  'estado',
  'numero_consultado',
];

/**
 * Lee el CSV de `consulta.portabilidad.pe` (BR-018) o, cuando no trae las
 * columnas del reporte completo, el cruce rápido de números ya activos en
 * Movistar (BR-018b).
 */
export function parsePortabilityReport(
  buffer: Buffer,
  options: { quickColumn?: string | null } = {},
): ParsedPortabilityReport {
  const text = stripBom(buffer.toString('utf8'));
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('El reporte no contiene filas de datos.');
  }

  const header = splitCsvLine(lines[0] ?? '').map((value) =>
    value.trim().toLowerCase(),
  );

  const isFullReport = fullReportHeaders.every((column) =>
    header.includes(column),
  );

  return isFullReport
    ? parseFullReport(header, lines)
    : parseQuickReport(header, lines, options.quickColumn ?? null);
}

function parseFullReport(
  header: string[],
  lines: string[],
): ParsedPortabilityReport {
  const index = (name: string) => header.indexOf(name);
  const columns = {
    numero: index('numero'),
    consultado: index('numero_consultado'),
    receptor: index('receptor'),
    cedente: index('cedente'),
    ventana: index('fecha_de_la_ventana'),
    estado: index('estado'),
    asignatario: index('asignatario_original'),
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
        numero: cells[columns.numero] ?? '',
        receptor: cells[columns.receptor] ?? '',
        cedente: cells[columns.cedente] ?? '',
        asignatario_original: cells[columns.asignatario] ?? '',
        fecha_de_la_ventana: cells[columns.ventana] ?? '',
        estado: cells[columns.estado] ?? '',
      },
    });
  }

  return { kind: 'FULL', rows, ignoredRows };
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
        'numero',
        'número',
        'telefono',
        'teléfono',
        'linea',
        'línea',
        'msisdn',
      ].includes(name),
    );
  }

  if (columnIndex < 0 && header.length === 1) {
    columnIndex = 0;
  }

  if (columnIndex < 0) {
    throw new Error(
      'No se pudo identificar la columna con el número. Indícala al subir el archivo.',
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
      state: 'PORTADO',
      receiverRaw: 'MOVISTAR',
      cedentRaw: null,
      windowDate: null,
      isMovistarReceiver: true,
      rawData: { numero: cells[columnIndex] ?? '' },
    });
  }

  return { kind: 'QUICK', rows, ignoredRows };
}

function cleanCell(value: string | undefined): string | null {
  const text = (value ?? '').trim();

  return text.length === 0 || text === '-' ? null : text;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
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
    } else if (char === ',' || char === ';') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);

  return cells;
}
