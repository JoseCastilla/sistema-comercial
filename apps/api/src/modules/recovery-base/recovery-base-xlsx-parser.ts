import ExcelJS from 'exceljs';

import {
  evaluateRecoveryEligibility,
  normalizeRecoveryDocumentNumber,
  normalizeRecoveryPhoneNumber,
  normalizeRecoveryServiceNumber,
  type RecoveryEligibilityConfigInput,
  type RecoveryRecordClassification,
  type RecoveryRecordIssueCode,
} from '@repo/validation';

const maximumWorkbookBytes = 25 * 1024 * 1024;
const businessTimeZoneOffset = '-05:00';

export const recoveryBaseParserVersion = '1.0';

/**
 * SPEC-030 BR-002: de las columnas A–M solo se leen I y J. Las columnas
 * A–H (identidad de la agencia vendedora) y K–M se descartan en el parseo.
 */
const recoveryBaseColumns = [
  {
    key: 'registeredDate',
    required: true,
    aliases: ['FECHA DE REGISTRO DE PEDIDO'],
  },
  {
    key: 'registeredTime',
    required: false,
    aliases: ['HORA DE REGISTRO DE PEDIDO'],
  },
  { key: 'holderName', required: true, aliases: ['NOMBRE DE CLIENTE'] },
  {
    key: 'documentType',
    required: false,
    aliases: ['TIPO DOCUMENTO CLIENTE'],
  },
  {
    key: 'documentNumber',
    required: true,
    aliases: ['NRO DOCUMENTO CLIENTE'],
  },
  { key: 'serviceNumber', required: true, aliases: ['NRO SERVICIO MOVIL'] },
  { key: 'modality', required: true, aliases: ['MODALIDAD ORIGEN'] },
  { key: 'contactPhone', required: true, aliases: ['TELF CONTACTO'] },
  {
    key: 'commercialOperation',
    required: false,
    aliases: ['OPERACION COMERCIAL MOVIL'],
  },
  { key: 'carrier', required: true, aliases: ['OPERADOR CEDENTE MOVIL'] },
  { key: 'plan', required: true, aliases: ['PLAN MOVIL'] },
  { key: 'equipment', required: true, aliases: ['EQUIPO MOVIL'] },
  { key: 'deliveryMethod', required: false, aliases: ['METODO DE ENTREGA'] },
  { key: 'department', required: false, aliases: ['DEPARTAMENTO'] },
  { key: 'province', required: false, aliases: ['PROVINCIA'] },
  { key: 'district', required: false, aliases: ['DITRITO', 'DISTRITO'] },
  { key: 'streetType', required: false, aliases: ['TIPO DE VIA'] },
  { key: 'streetName', required: false, aliases: ['NOMBRE DE VIA'] },
  { key: 'streetNumber', required: false, aliases: ['NUMERO DE VIA'] },
  {
    key: 'housingType',
    required: false,
    aliases: ['TIPO DE COMPLEJO DE VIVIENDA'],
  },
  {
    key: 'housingName',
    required: false,
    aliases: ['NOMBRE DE COMPLEJO DE VIVIENDA'],
  },
  { key: 'block', required: false, aliases: ['BLOQUE MANZANA', 'BLOQUE'] },
  { key: 'lot', required: false, aliases: ['LOTE'] },
  { key: 'reference', required: false, aliases: ['REFERENCIA'] },
  { key: 'latitude', required: false, aliases: ['LATITUDE', 'LATITUD'] },
  { key: 'longitude', required: false, aliases: ['LONGITUDE', 'LONGITUD'] },
  {
    key: 'shippingInstructions',
    required: false,
    aliases: ['INSTRUCCIONES DE ENVIO'],
  },
  { key: 'validation', required: false, aliases: ['VALIDACION'] },
  { key: 'fatherName', required: false, aliases: ['PAPA'] },
  { key: 'motherName', required: false, aliases: ['MAMA'] },
  { key: 'birthPlace', required: false, aliases: ['NACIMIENTO'] },
] as const;

type RecoveryColumnKey = (typeof recoveryBaseColumns)[number]['key'];

export interface ParsedRecoveryBaseRow {
  sourceRow: number;
  classification: RecoveryRecordClassification;
  issueCodes: RecoveryRecordIssueCode[];
  documentNumber: string | null;
  serviceNumber: string | null;
  contactPhone: string | null;
  holderName: string | null;
  registeredAt: Date | null;
  modalityRaw: string | null;
  planRaw: string | null;
  equipmentRaw: string | null;
  carrierRaw: string | null;
  requiresIdentityValidation: boolean;
  rawData: Record<string, string | null>;
}

export interface ParsedRecoveryBaseWorkbook {
  sheetName: string;
  rows: ParsedRecoveryBaseRow[];
}

export function parseRecoveryBaseWorkbook(
  buffer: Buffer,
  config: RecoveryEligibilityConfigInput,
): Promise<ParsedRecoveryBaseWorkbook> {
  if (buffer.byteLength > maximumWorkbookBytes) {
    throw new Error('El archivo supera el tamaño máximo permitido de 25 MB.');
  }

  return readWorkbook(buffer, config);
}

async function readWorkbook(
  buffer: Buffer,
  config: RecoveryEligibilityConfigInput,
): Promise<ParsedRecoveryBaseWorkbook> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet =
    workbook.getWorksheet('Base Consolidada') ?? workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('El archivo no contiene hojas de cálculo legibles.');
  }

  const columns = resolveColumns(worksheet);
  const rows: ParsedRecoveryBaseRow[] = [];

  for (let sourceRow = 2; sourceRow <= worksheet.rowCount; sourceRow += 1) {
    const parsed = parseRow(worksheet, sourceRow, columns, config);

    if (parsed) {
      rows.push(parsed);
    }
  }

  return { sheetName: worksheet.name, rows };
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function resolveColumns(
  worksheet: ExcelJS.Worksheet,
): Map<RecoveryColumnKey, number> {
  const headerRow = worksheet.getRow(1);
  const byHeader = new Map<string, number>();

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const text = normalizeHeader(cellValueToText(cell.value));

    if (text && !byHeader.has(text)) {
      byHeader.set(text, columnNumber);
    }
  });

  const columns = new Map<RecoveryColumnKey, number>();
  const missing: string[] = [];

  for (const column of recoveryBaseColumns) {
    const match = column.aliases
      .map((alias) => byHeader.get(normalizeHeader(alias)))
      .find((index) => index !== undefined);

    if (match !== undefined) {
      columns.set(column.key, match);
    } else if (column.required) {
      missing.push(column.aliases[0]);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `El archivo no coincide con la estructura de la base consolidada. Faltan columnas: ${missing.join(', ')}.`,
    );
  }

  return columns;
}

function parseRow(
  worksheet: ExcelJS.Worksheet,
  sourceRow: number,
  columns: Map<RecoveryColumnKey, number>,
  config: RecoveryEligibilityConfigInput,
): ParsedRecoveryBaseRow | null {
  const rawData: Record<string, string | null> = {};

  for (const [key, columnNumber] of columns) {
    const text = cleanText(
      cellValueToText(worksheet.getCell(sourceRow, columnNumber).value),
    );

    rawData[key] = text;
  }

  const hasContent = Object.values(rawData).some((value) => value !== null);

  if (!hasContent) {
    return null;
  }

  const registeredAt = parseRegisteredAt(
    columns.has('registeredDate')
      ? worksheet.getCell(sourceRow, columns.get('registeredDate')).value
      : null,
    columns.has('registeredTime')
      ? worksheet.getCell(sourceRow, columns.get('registeredTime')).value
      : null,
  );

  const documentNumber = normalizeRecoveryDocumentNumber(
    rawData.documentNumber,
  );
  // La línea a portar exige formato de móvil peruano; el teléfono de
  // contacto conserva la regla laxa (puede ser fijo).
  const serviceNumber = normalizeRecoveryServiceNumber(rawData.serviceNumber);
  const serviceNumberMalformed =
    serviceNumber === null &&
    normalizeRecoveryPhoneNumber(rawData.serviceNumber) !== null;
  const contactPhone = normalizeRecoveryPhoneNumber(rawData.contactPhone);

  const requiresIdentityValidation =
    normalizeBoolean(rawData.validation) === false;

  const evaluation = evaluateRecoveryEligibility(
    {
      documentNumber,
      serviceNumber,
      serviceNumberMalformed,
      registeredAt,
      modalityRaw: rawData.modality,
      planRaw: rawData.plan,
      equipmentRaw: rawData.equipment,
      carrierRaw: rawData.carrier,
    },
    config,
  );

  return {
    sourceRow,
    classification: evaluation.classification,
    issueCodes: evaluation.issueCodes,
    documentNumber,
    serviceNumber,
    contactPhone,
    holderName: rawData.holderName,
    registeredAt,
    modalityRaw: rawData.modality,
    planRaw: rawData.plan,
    equipmentRaw: rawData.equipment,
    carrierRaw: rawData.carrier,
    requiresIdentityValidation,
    rawData,
  };
}

function normalizeBoolean(value: string | null): boolean | null {
  if (value === null) return null;

  const text = value.trim().toUpperCase();

  if (['TRUE', 'VERDADERO', 'SI', 'SÍ', '1'].includes(text)) return true;
  if (['FALSE', 'FALSO', 'NO', '0'].includes(text)) return false;

  return null;
}

function cleanText(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim();

  return trimmed.length > 0 ? trimmed : null;
}

function cellValueToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return cellValueToText(value.result ?? null);
    if ('richText' in value)
      return value.richText.map((item) => item.text).join('');
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return '';
}

function parseRegisteredAt(
  dateValue: ExcelJS.CellValue,
  timeValue: ExcelJS.CellValue,
): Date | null {
  const dateParts = parseDateParts(dateValue);

  if (!dateParts) return null;

  const timeParts = parseTimeParts(timeValue) ?? {
    hour: 0,
    minute: 0,
    second: 0,
  };

  const iso = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}T${String(timeParts.hour).padStart(2, '0')}:${String(timeParts.minute).padStart(2, '0')}:${String(timeParts.second).padStart(2, '0')}${businessTimeZoneOffset}`;
  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateParts(
  value: ExcelJS.CellValue,
): { year: number; month: number; day: number } | null {
  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const text = cellValueToText(value);
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const latinMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (latinMatch) {
    return {
      year: Number(latinMatch[3]),
      month: Number(latinMatch[2]),
      day: Number(latinMatch[1]),
    };
  }

  const serial =
    typeof value === 'number' ? value : Number(text.replace(',', '.'));
  if (!Number.isFinite(serial) || serial < 1) return null;

  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + Math.floor(serial) * 86_400_000);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function parseTimeParts(
  value: ExcelJS.CellValue,
): { hour: number; minute: number; second: number } | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return {
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
    };
  }

  const text = cellValueToText(value);
  const clockMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (clockMatch) {
    return {
      hour: Number(clockMatch[1]),
      minute: Number(clockMatch[2]),
      second: Number(clockMatch[3] ?? '0'),
    };
  }

  const fraction =
    typeof value === 'number' ? value : Number(text.replace(',', '.'));
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) return null;

  const totalSeconds = Math.round(fraction * 86_400) % 86_400;

  return {
    hour: Math.floor(totalSeconds / 3_600),
    minute: Math.floor((totalSeconds % 3_600) / 60),
    second: totalSeconds % 60,
  };
}
