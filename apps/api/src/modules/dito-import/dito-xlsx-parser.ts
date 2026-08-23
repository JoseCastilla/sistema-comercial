import ExcelJS from 'exceljs';

import {
  ineiProvinceCatalogVersion,
  ineiProvinces,
} from './catalogs/inei-provinces-2025';

const maxWorkbookBytes = 10 * 1024 * 1024;
const businessTimeZoneOffset = '-05:00';

export const ditoBatchParserVersion = '1.8';

const operatorCatalog = {
  '20': 'ENTEL',
  '21': 'CLARO',
  '24': 'BITEL',
} as const;

type DitoCarrier =
  (typeof operatorCatalog)[keyof typeof operatorCatalog] | 'UNKNOWN';
type DitoCommercialOperation = 'NEW_LINE' | 'PORT_PREPAID' | 'PORT_POSTPAID';
type DitoDeliveryMethod =
  'EXPRESS' | 'REGULAR_24H' | 'REGULAR_48H' | 'REGULAR_72H';

export type DitoBatchRowOutcome = 'IMPORTABLE' | 'EXCLUDED' | 'INVALID';

export type DitoBatchRowIssue =
  | 'STATUS_NOT_APPROVED'
  | 'OUTSIDE_CURRENT_MONTH'
  | 'NON_MOBILE_PRODUCT'
  | 'MISSING_REQUIRED_VALUE'
  | 'INVALID_DOCUMENT_NUMBER'
  | 'INVALID_ORDER_CODE'
  | 'INVALID_REGISTERED_AT'
  | 'UNKNOWN_OPERATION'
  | 'MISSING_PORTABILITY_ORIGIN'
  | 'UNKNOWN_PORTABILITY_ORIGIN'
  | 'UNKNOWN_OPERATOR'
  | 'UNKNOWN_DELIVERY_METHOD'
  | 'UNKNOWN_PROVINCE';

export interface ParsedDitoBatchRow {
  sourceRow: number;
  outcome: DitoBatchRowOutcome;
  issues: DitoBatchRowIssue[];
  ditoStatus: string;
  salesCode: string | null;
  orderCodeNormalized: string | null;
  displayedOrderCode: string | null;
  registeredAt: Date | null;
  ditoUsername: string | null;
  ditoUserName: string | null;
  salesAdvisorName: string | null;
  holderName: string | null;
  holderDocumentType: string | null;
  holderDocumentNumber: string | null;
  customerEmail: string | null;
  serviceNumber: string | null;
  portabilityOriginRaw: string | null;
  commercialOperation: DitoCommercialOperation | null;
  carrier: DitoCarrier | null;
  fixedCharge: number | null;
  operationRaw: string | null;
  deliveryMethod: DitoDeliveryMethod | null;
  deliveryMethodRaw: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryInstructions: string | null;
  deliveryOption: string | null;
  sourceLoadType: string | null;
  ubigeoCatalogVersion: string;
}

export interface DitoBatchParsePreview {
  sheetName: string;
  headerRow: number;
  sourceRows: number;
  importable: number;
  excluded: number;
  invalid: number;
  rows: ParsedDitoBatchRow[];
}

interface DitoColumns {
  salesCode: number;
  status: number;
  ditoUsername: number;
  ditoUserName: number;
  salesAdvisorName: number | null;
  registeredDate: number;
  registeredTime: number;
  holderName: number;
  documentType: number;
  documentNumber: number;
  customerEmail: number;
  fixedServiceNumber: number | null;
  fixedOperation: number | null;
  fixedOrderId: number | null;
  fixedPlan: number | null;
  serviceNumber: number;
  operation: number;
  portabilityOrigin: number | null;
  operator: number;
  orderCode: number;
  plan: number;
  deliveryMethod: number;
  department: number;
  province: number;
  district: number;
  streetType: number | null;
  streetName: number | null;
  streetNumber: number | null;
  floor: number | null;
  interior: number | null;
  complexType: number | null;
  complexName: number | null;
  block: number | null;
  lot: number | null;
  reference: number | null;
  latitude: number | null;
  longitude: number | null;
  deliveryOption: number | null;
  deliveryInstructions: number | null;
  loadType: number | null;
}

const provinceCatalog = new Map(
  ineiProvinces.map((entry) => {
    const [departmentCode, provinceCode, department, province] =
      entry.split('|');

    return [
      `${normalizeLookup(department)}|${provinceCode}`,
      { departmentCode, department, province },
    ] as const;
  }),
);

export async function parseDitoSalesWorkbook(
  input: Buffer,
  now = new Date(),
): Promise<DitoBatchParsePreview> {
  if (input.length === 0 || input.length > maxWorkbookBytes) {
    throw new Error('El archivo XLSX está vacío o supera el límite de 10 MB.');
  }

  const workbook = new ExcelJS.Workbook();
  const workbookBytes = input.buffer.slice(
    input.byteOffset,
    input.byteOffset + input.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(workbookBytes);

  const worksheet = workbook.getWorksheet('Sales') ?? workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('El archivo XLSX no contiene hojas.');
  }

  const header = findHeader(worksheet);
  const columns = resolveColumns(header.values);
  const rows: ParsedDitoBatchRow[] = [];

  for (
    let sourceRow = header.row + 1;
    sourceRow <= worksheet.rowCount;
    sourceRow += 1
  ) {
    if (isBlankRow(worksheet, sourceRow, columns)) continue;

    rows.push(parseRow(worksheet, sourceRow, columns, now));
  }

  return {
    sheetName: worksheet.name,
    headerRow: header.row,
    sourceRows: rows.length,
    importable: rows.filter((row) => row.outcome === 'IMPORTABLE').length,
    excluded: rows.filter((row) => row.outcome === 'EXCLUDED').length,
    invalid: rows.filter((row) => row.outcome === 'INVALID').length,
    rows,
  };
}

function findHeader(worksheet: ExcelJS.Worksheet): {
  row: number;
  values: string[];
} {
  const required = [
    'NRO PEDIDO WC',
    'ESTADO PEDIDO WC',
    'USUARIO DITO',
    'FECHA DE REGISTRO DE PEDIDO',
    'NRO SERVICIO MOVIL',
    'ORDER ID MOVIL',
  ];

  for (
    let rowNumber = 1;
    rowNumber <= Math.min(20, worksheet.rowCount);
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const values = Array.from({ length: row.cellCount }, (_, index) =>
      normalizeLookup(cellValueToText(row.getCell(index + 1).value)),
    );

    if (required.every((label) => values.includes(label))) {
      return { row: rowNumber, values };
    }
  }

  throw new Error('No se encontró una cabecera DITO compatible.');
}

function resolveColumns(headers: string[]): DitoColumns {
  const find = (label: string, after = -1, required = true): number | null => {
    const normalized = normalizeLookup(label);
    const index = headers.findIndex(
      (header, candidateIndex) =>
        candidateIndex > after && header === normalized,
    );

    if (index === -1) {
      if (required) throw new Error(`Falta la columna requerida: ${label}.`);

      return null;
    }

    return index + 1;
  };

  const serviceNumber = find('Nro Servicio Móvil') as number;
  const deliveryMethod = find('Método de Entrega', serviceNumber - 1) as number;

  return {
    salesCode: find('Nro Pedido WC') as number,
    status: find('Estado Pedido WC') as number,
    ditoUsername: find('Usuario DITO') as number,
    ditoUserName: find('Nombre de Usuario') as number,
    salesAdvisorName: find('Asesor', serviceNumber - 1, false),
    registeredDate: find('Fecha de Registro de Pedido') as number,
    registeredTime: find('Hora de Registro de Pedido') as number,
    holderName: find('Nombre de Cliente') as number,
    documentType: find('Tipo Documento Cliente') as number,
    documentNumber: find('Nro Documento Cliente') as number,
    customerEmail: find('Email Cliente') as number,
    fixedServiceNumber: find('Nro Servicio Fijo', -1, false),
    fixedOperation: find('Operación Comercial Fijo', -1, false),
    fixedOrderId: find('Order ID Fijo', -1, false),
    fixedPlan: find('Plan Fijo', -1, false),
    serviceNumber,
    operation: find('Operación Comercial Móvil', serviceNumber - 1) as number,
    portabilityOrigin:
      find('Origen Portabilidad', serviceNumber - 1, false) ??
      find('Origen', serviceNumber - 1, false),
    operator: find('Operador Cedente Móvil', serviceNumber - 1) as number,
    orderCode: find('Order ID Móvil', serviceNumber - 1) as number,
    plan: find('Plan Móvil', serviceNumber - 1) as number,
    deliveryMethod,
    department: find('Departamento', deliveryMethod - 1) as number,
    province: find('Provincia', deliveryMethod - 1) as number,
    district: find('Distrito', deliveryMethod - 1) as number,
    streetType: find('Tipo de Vía', deliveryMethod - 1, false),
    streetName: find('Nombre de Vía', deliveryMethod - 1, false),
    streetNumber: find('Número de Vía', deliveryMethod - 1, false),
    floor: find('Piso', deliveryMethod - 1, false),
    interior: find('Interior / Nro. Dpto', deliveryMethod - 1, false),
    complexType: find(
      'Tipo de Complejo de Vivienda',
      deliveryMethod - 1,
      false,
    ),
    complexName: find(
      'Nombre de Complejo de Vivienda',
      deliveryMethod - 1,
      false,
    ),
    block: find('Bloque / Manzana', deliveryMethod - 1, false),
    lot: find('Lote', deliveryMethod - 1, false),
    reference: find('Referencia', deliveryMethod - 1, false),
    latitude: find('Coordenada X', deliveryMethod - 1, false),
    longitude: find('Coordenada Y', deliveryMethod - 1, false),
    deliveryOption: find('Opción de Entrega', deliveryMethod - 1, false),
    deliveryInstructions: find(
      'Instrucciones de Envío',
      deliveryMethod - 1,
      false,
    ),
    loadType: find('Tipo carga', deliveryMethod - 1, false),
  };
}

function parseRow(
  worksheet: ExcelJS.Worksheet,
  sourceRow: number,
  columns: DitoColumns,
  now: Date,
): ParsedDitoBatchRow {
  const text = (column: number | null) =>
    column ? cleanText(worksheet.getCell(sourceRow, column).text) : null;
  const ditaStatus = normalizeLookup(text(columns.status));
  const registeredAt = parseRegisteredAt(
    worksheet.getCell(sourceRow, columns.registeredDate).value,
    worksheet.getCell(sourceRow, columns.registeredTime).value,
  );
  const operationValue = normalizeLookup(text(columns.operation));
  const portabilityOriginRaw = text(columns.portabilityOrigin);
  const portabilityOrigin = parsePortabilityOrigin(portabilityOriginRaw);
  const commercialOperation = parseCommercialOperation(
    operationValue,
    portabilityOrigin,
  );
  const operatorCode = normalizeCode(text(columns.operator));
  const carrier = resolveCarrier(operationValue, operatorCode);
  const plan = text(columns.plan);
  const fixedCharge = parseFixedCharge(plan);
  const orderCodeNormalized = digits(text(columns.orderCode));
  const deliveryMethodRaw = text(columns.deliveryMethod);
  const deliveryMethod = parseDeliveryMethod(deliveryMethodRaw);
  const department = text(columns.department);
  const province = resolveProvince(department, text(columns.province));
  const district = text(columns.district);
  const holderDocumentType = text(columns.documentType);
  const holderDocumentNumber = normalizeDocumentNumber(
    holderDocumentType,
    text(columns.documentNumber),
  );
  const serviceNumber = digits(text(columns.serviceNumber));
  const nonMobileProduct =
    !serviceNumber &&
    !operationValue &&
    hasFixedProductData([
      text(columns.fixedServiceNumber),
      text(columns.fixedOperation),
      text(columns.fixedOrderId),
      text(columns.fixedPlan),
    ]);
  const issues: DitoBatchRowIssue[] = [];

  if (ditaStatus !== 'APROBADO') issues.push('STATUS_NOT_APPROVED');

  if (registeredAt && !isCurrentBusinessMonth(registeredAt, now)) {
    issues.push('OUTSIDE_CURRENT_MONTH');
  }

  if (nonMobileProduct) {
    issues.push('NON_MOBILE_PRODUCT');
  } else {
    if (!registeredAt) issues.push('INVALID_REGISTERED_AT');
    if (!orderCodeNormalized) issues.push('INVALID_ORDER_CODE');
    if (operationValue === 'PORTABILIDAD') {
      if (!normalizeLookup(portabilityOriginRaw)) {
        issues.push('MISSING_PORTABILITY_ORIGIN');
      } else if (!portabilityOrigin) {
        issues.push('UNKNOWN_PORTABILITY_ORIGIN');
      }
    } else if (operationValue !== 'ALTA') {
      issues.push('UNKNOWN_OPERATION');
    }
    if (
      (operationValue === 'PORTABILIDAD' || operationValue === 'ALTA') &&
      !carrier
    ) {
      issues.push('UNKNOWN_OPERATOR');
    }
    if (!deliveryMethod) issues.push('UNKNOWN_DELIVERY_METHOD');
    if (!province) issues.push('UNKNOWN_PROVINCE');
    if (
      normalizeLookup(holderDocumentType) === 'DNI' &&
      (!holderDocumentNumber || holderDocumentNumber.length !== 8)
    ) {
      issues.push('INVALID_DOCUMENT_NUMBER');
    }

    const requiredValues = [
      text(columns.ditoUsername),
      text(columns.ditoUserName),
      text(columns.holderName),
      holderDocumentNumber,
      serviceNumber,
      department,
      district,
    ];

    if (requiredValues.some((value) => !value)) {
      issues.push('MISSING_REQUIRED_VALUE');
    }
  }

  const excluded = issues.some(
    (issue) =>
      issue === 'STATUS_NOT_APPROVED' ||
      issue === 'OUTSIDE_CURRENT_MONTH' ||
      issue === 'NON_MOBILE_PRODUCT',
  );
  const invalid = issues.some(
    (issue) =>
      issue !== 'STATUS_NOT_APPROVED' &&
      issue !== 'OUTSIDE_CURRENT_MONTH' &&
      issue !== 'NON_MOBILE_PRODUCT',
  );
  const outcome: DitoBatchRowOutcome = excluded
    ? 'EXCLUDED'
    : invalid
      ? 'INVALID'
      : 'IMPORTABLE';
  const salesCode = text(columns.salesCode);
  const operationRaw = createOperationRaw(
    commercialOperation,
    carrier,
    fixedCharge,
  );

  return {
    sourceRow,
    outcome,
    issues: unique(issues),
    ditoStatus: ditaStatus,
    salesCode,
    orderCodeNormalized,
    displayedOrderCode: orderCodeNormalized ? `${orderCodeNormalized}A` : null,
    registeredAt,
    ditoUsername: text(columns.ditoUsername),
    ditoUserName: text(columns.ditoUserName),
    salesAdvisorName: cleanOptional(text(columns.salesAdvisorName)),
    holderName: text(columns.holderName),
    holderDocumentType,
    holderDocumentNumber,
    customerEmail: normalizeEmail(text(columns.customerEmail)),
    serviceNumber,
    portabilityOriginRaw: cleanOptional(portabilityOriginRaw),
    commercialOperation,
    carrier: carrier ?? null,
    fixedCharge,
    operationRaw,
    deliveryMethod,
    deliveryMethodRaw,
    department,
    province,
    district,
    deliveryAddress: composeAddress({
      department,
      streetType: text(columns.streetType),
      streetName: text(columns.streetName),
      streetNumber: text(columns.streetNumber),
      floor: text(columns.floor),
      interior: text(columns.interior),
      complexType: text(columns.complexType),
      complexName: text(columns.complexName),
      block: text(columns.block),
      lot: text(columns.lot),
    }),
    deliveryReference: cleanOptional(text(columns.reference)),
    deliveryLatitude: parseCoordinate(text(columns.latitude), -90, 90),
    deliveryLongitude: parseCoordinate(text(columns.longitude), -180, 180),
    deliveryInstructions: cleanOptional(text(columns.deliveryInstructions)),
    deliveryOption: cleanOptional(text(columns.deliveryOption)),
    sourceLoadType: cleanOptional(text(columns.loadType)),
    ubigeoCatalogVersion: ineiProvinceCatalogVersion,
  };
}

function hasFixedProductData(values: Array<string | null>): boolean {
  return values.some((value) => Boolean(normalizeLookup(value)));
}

function isBlankRow(
  worksheet: ExcelJS.Worksheet,
  sourceRow: number,
  columns: DitoColumns,
): boolean {
  return ![
    columns.salesCode,
    columns.status,
    columns.orderCode,
    columns.holderName,
  ].some((column) => cleanText(worksheet.getCell(sourceRow, column).text));
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

function normalizeLookup(value: string | null): string {
  return (
    cleanText(value)
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase() ?? ''
  );
}

function cleanText(value: string | null): string | null {
  if (!value) return null;

  const repaired = repairMojibake(value).replace(/\s+/g, ' ').trim();

  return repaired || null;
}

function repairMojibake(value: string): string {
  if (!/[ÃÂ]/.test(value)) return value;

  return value
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã©/g, 'é')
    .replace(/Ã/g, 'Í')
    .replace(/Ã­/g, 'í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ãº/g, 'ú')
    .replace(/Â/g, '');
}

function cleanOptional(value: string | null): string | null {
  const normalized = normalizeLookup(value);

  if (
    !normalized ||
    normalized === '45' ||
    normalized === '82' ||
    normalized === 'DELIVERYUNDEFINED' ||
    normalized === 'NO SE REGISTRO INSTRUCCIONES'
  ) {
    return null;
  }

  return cleanText(value);
}

function digits(value: string | null): string | null {
  const result = value?.replace(/\D/g, '') ?? '';

  return result || null;
}

function normalizeDocumentNumber(
  documentType: string | null,
  value: string | null,
): string | null {
  const numeric = digits(value);

  if (!numeric || normalizeLookup(documentType) !== 'DNI') return numeric;

  return numeric.length <= 8 ? numeric.padStart(8, '0') : numeric;
}

function normalizeCode(value: string | null): string | null {
  if (!value) return null;

  const numeric = Number(value.replace(',', '.'));

  return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : value.trim();
}

function parseRegisteredAt(
  dateValue: ExcelJS.CellValue,
  timeValue: ExcelJS.CellValue,
): Date | null {
  const dateParts = parseDateParts(dateValue);
  const timeParts = parseTimeParts(timeValue);

  if (!dateParts || !timeParts) return null;

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

function isCurrentBusinessMonth(value: Date, now: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
  });

  return formatter.format(value) === formatter.format(now);
}

function parseCommercialOperation(
  value: string,
  portabilityOrigin: 'PREPAID' | 'POSTPAID' | null,
): DitoCommercialOperation | null {
  if (value === 'ALTA') return 'NEW_LINE';
  if (value === 'PORTABILIDAD' && portabilityOrigin === 'PREPAID') {
    return 'PORT_PREPAID';
  }
  if (value === 'PORTABILIDAD' && portabilityOrigin === 'POSTPAID') {
    return 'PORT_POSTPAID';
  }

  return null;
}

function parsePortabilityOrigin(
  value: string | null,
): 'PREPAID' | 'POSTPAID' | null {
  const normalized = normalizeLookup(value).replace(/[\s_-]+/g, '');

  if (normalized === 'PREPAGO' || normalized === 'PREPAID') return 'PREPAID';
  if (normalized === 'POSTPAGO' || normalized === 'POSTPAID') {
    return 'POSTPAID';
  }

  return null;
}

function resolveCarrier(
  operation: string,
  operatorCode: string | null,
): DitoCarrier | null {
  if (operation === 'ALTA') return 'UNKNOWN';
  if (operation !== 'PORTABILIDAD') return null;
  if (!operatorCode) return null;

  return operatorCatalog[operatorCode as keyof typeof operatorCatalog] ?? null;
}

function parseFixedCharge(plan: string | null): number | null {
  const match = plan?.match(/S\/?\s*(\d+(?:[.,]\d+)?)/i);
  const value = match?.[1] ? Number(match[1].replace(',', '.')) : Number.NaN;

  return Number.isFinite(value) ? value : null;
}

function createOperationRaw(
  operation: DitoCommercialOperation | null,
  carrier: DitoCarrier | null,
  fixedCharge: number | null,
): string | null {
  if (!operation) return null;

  const charge = fixedCharge === null ? null : String(fixedCharge);

  if (operation === 'NEW_LINE') {
    return ['ALTA NUEVA POST', charge].filter(Boolean).join(' ');
  }

  if (!carrier) return null;

  const origin = operation === 'PORT_PREPAID' ? 'PRE' : 'POST';

  return ['PORTA', carrier, origin, charge].filter(Boolean).join(' ');
}

function parseDeliveryMethod(value: string | null): DitoDeliveryMethod | null {
  const normalized = normalizeLookup(value);

  if (normalized.includes('EXPRESS')) return 'EXPRESS';
  if (normalized.includes('REGULAR 24')) return 'REGULAR_24H';
  if (normalized.includes('REGULAR 48')) return 'REGULAR_48H';
  if (normalized.includes('REGULAR 72')) return 'REGULAR_72H';

  return null;
}

function resolveProvince(
  department: string | null,
  provinceValue: string | null,
): string | null {
  if (!department || !provinceValue) return null;

  const code = normalizeCode(provinceValue);

  if (code && /^\d{1,2}$/.test(code)) {
    return (
      provinceCatalog.get(
        `${normalizeLookup(department)}|${code.padStart(2, '0')}`,
      )?.province ?? null
    );
  }

  return cleanOptional(provinceValue);
}

function composeAddress(input: {
  department: string | null;
  streetType: string | null;
  streetName: string | null;
  streetNumber: string | null;
  floor: string | null;
  interior: string | null;
  complexType: string | null;
  complexName: string | null;
  block: string | null;
  lot: string | null;
}): string | null {
  const parts = [
    cleanOptional(input.streetType),
    cleanOptional(input.streetName),
    cleanOptional(input.streetNumber),
    labelPart('PISO', input.floor),
    normalizeLookup(input.interior) === normalizeLookup(input.department)
      ? null
      : labelPart('INT.', input.interior),
    cleanOptional(input.complexType),
    cleanOptional(input.complexName),
    labelPart('MZ.', input.block),
    labelPart('LT.', input.lot),
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(' ') : null;
}

function labelPart(label: string, value: string | null): string | null {
  const cleaned = cleanOptional(value);

  return cleaned ? `${label} ${cleaned}` : null;
}

function normalizeEmail(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';

  return normalized || null;
}

function parseCoordinate(
  value: string | null,
  minimum: number,
  maximum: number,
): number | null {
  if (!value) return null;

  const parsed = Number(value.replace(',', '.'));

  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
