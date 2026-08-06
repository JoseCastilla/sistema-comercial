import ExcelJS from 'exceljs';

import { parseDitoSalesWorkbook } from './dito-xlsx-parser';

const usefulHeaders = [
  'Nro Pedido WC',
  'Estado Pedido WC',
  'Usuario DITO',
  'Nombre de Usuario',
  'Fecha de Registro de Pedido',
  'Hora de Registro de Pedido',
  'Nombre de Cliente',
  'Tipo Documento Cliente',
  'Nro Documento Cliente',
  'Email Cliente',
  'Nro Servicio Móvil',
  'Operación Comercial Móvil',
  'Operador Cedente Móvil',
  'Order ID Móvil',
  'Plan Móvil',
  'Equipo Móvil',
  'Método de Entrega',
  'Departamento',
  'Provincia',
  'Distrito',
  'Tipo de Vía',
  'Nombre de Vía',
  'Número de Vía',
  'Piso',
  'Interior / Nro. Dpto',
  'Tipo de Complejo de Vivienda',
  'Nombre de Complejo de Vivienda',
  'Bloque / Manzana',
  'Lote',
  'Referencia',
  'Coordenada X',
  'Coordenada Y',
  'Opción de Entrega',
  'Instrucciones de Envío',
  'Tipo carga',
] as const;

type RowValue = string | number | null;

interface RowEntry {
  header: string;
  value: RowValue;
  occurrence?: number;
}

function createValidEntries(overrides: RowEntry[] = []): RowEntry[] {
  const defaults: RowEntry[] = [
    { header: 'Nro Pedido WC', value: 'FE-TEST-001' },
    { header: 'Estado Pedido WC', value: 'APROBADO' },
    { header: 'Usuario DITO', value: 'asesora01' },
    { header: 'Nombre de Usuario', value: 'ASESORA DEMO' },
    { header: 'Fecha de Registro de Pedido', value: '2026-08-01' },
    { header: 'Hora de Registro de Pedido', value: '08:16:09' },
    { header: 'Nombre de Cliente', value: 'CLIENTE DEMO' },
    { header: 'Tipo Documento Cliente', value: 'DNI' },
    { header: 'Nro Documento Cliente', value: '00000001' },
    { header: 'Email Cliente', value: 'cliente@example.com' },
    { header: 'Nro Servicio Móvil', value: '900000001' },
    { header: 'Operación Comercial Móvil', value: 'PORTABILIDAD' },
    { header: 'Operador Cedente Móvil', value: 21 },
    { header: 'Order ID Móvil', value: '1943000001' },
    {
      header: 'Plan Móvil',
      value: 'Abierto Movistar Libre Plan Movistar Máximo S/39.9',
    },
    { header: 'Equipo Móvil', value: 'Simcard' },
    { header: 'Método de Entrega', value: 'Delivery Express' },
    { header: 'Departamento', value: 'AYACUCHO' },
    { header: 'Provincia', value: 1 },
    { header: 'Distrito', value: 'AYACUCHO' },
    { header: 'Tipo de Vía', value: 'AV' },
    { header: 'Nombre de Vía', value: 'PRUEBA' },
    { header: 'Número de Vía', value: '100' },
    { header: 'Piso', value: 45 },
    { header: 'Interior / Nro. Dpto', value: 'AYACUCHO' },
    { header: 'Tipo de Complejo de Vivienda', value: 'URBANIZACION' },
    { header: 'Nombre de Complejo de Vivienda', value: 'DEMO' },
    { header: 'Bloque / Manzana', value: 45 },
    { header: 'Lote', value: 45 },
    { header: 'Referencia', value: 'FRENTE AL PARQUE' },
    { header: 'Coordenada X', value: -13.1631 },
    { header: 'Coordenada Y', value: -74.2236 },
    { header: 'Opción de Entrega', value: 'Deliveryundefined' },
    { header: 'Instrucciones de Envío', value: 'CLIENTE DISPONIBLE' },
    { header: 'Tipo carga', value: 'MANUAL' },
  ];

  return [...defaults, ...overrides];
}

function createRow(
  headers: readonly string[],
  entries: RowEntry[],
): RowValue[] {
  const row: RowValue[] = Array.from({ length: headers.length }, () => null);

  for (const entry of entries) {
    const indexes = headers
      .map((header, index) => (header === entry.header ? index : -1))
      .filter((index) => index >= 0);
    const target = indexes[entry.occurrence ?? indexes.length - 1];

    if (target === undefined) {
      throw new Error(`Missing test header ${entry.header}`);
    }

    row[target] = entry.value;
  }

  return row;
}

async function createWorkbook(
  headers: readonly string[],
  rows: RowValue[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales');

  worksheet.addRow(['Ventas']);
  worksheet.addRow([]);
  worksheet.addRow([...headers]);
  rows.forEach((row) => worksheet.addRow(row));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('parseDitoSalesWorkbook', () => {
  it('parses approved rows and excludes non-approved or older rows', async () => {
    const approved = createRow(usefulHeaders, createValidEntries());
    const newLine = createRow(
      usefulHeaders,
      createValidEntries([
        { header: 'Nro Pedido WC', value: 'FE-TEST-002' },
        { header: 'Order ID Móvil', value: '1943000002' },
        { header: 'Operación Comercial Móvil', value: 'ALTA' },
        { header: 'Operador Cedente Móvil', value: 45 },
        { header: 'Método de Entrega', value: 'Delivery Regular 24 horas' },
      ]),
    );
    const fallen = createRow(
      usefulHeaders,
      createValidEntries([
        { header: 'Estado Pedido WC', value: 'CAIDA' },
        { header: 'Order ID Móvil', value: '1943000003' },
      ]),
    );
    const rejected = createRow(
      usefulHeaders,
      createValidEntries([
        { header: 'Estado Pedido WC', value: 'RECHAZADO' },
        { header: 'Order ID Móvil', value: '1943000004' },
      ]),
    );
    const older = createRow(
      usefulHeaders,
      createValidEntries([
        { header: 'Fecha de Registro de Pedido', value: '2026-07-31' },
        { header: 'Order ID Móvil', value: '1943000005' },
      ]),
    );
    const input = await createWorkbook(usefulHeaders, [
      approved,
      newLine,
      fallen,
      rejected,
      older,
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({
      headerRow: 3,
      sourceRows: 5,
      importable: 2,
      excluded: 3,
      invalid: 0,
    });
    expect(preview.rows[0]).toMatchObject({
      displayedOrderCode: '1943000001A',
      commercialOperation: 'PORT_POSTPAID',
      carrier: 'CLARO',
      fixedCharge: 39.9,
      operationRaw: 'PORTA CLARO POST 39.9',
      province: 'HUAMANGA',
      deliveryOption: null,
      deliveryAddress: 'AV PRUEBA 100 URBANIZACION DEMO',
    });
    expect(preview.rows[0]?.registeredAt?.toISOString()).toBe(
      '2026-08-01T13:16:09.000Z',
    );
    expect(preview.rows[1]).toMatchObject({
      commercialOperation: 'NEW_LINE',
      carrier: 'UNKNOWN',
      operationRaw: 'ALTA NUEVA POST 39.9',
      deliveryMethod: 'REGULAR_24H',
    });
  });

  it('uses the mobile address columns when the full template repeats headers', async () => {
    const serviceIndex = usefulHeaders.indexOf('Nro Servicio Móvil');
    const fullHeaders = [
      ...usefulHeaders.slice(0, serviceIndex),
      'Departamento',
      'Provincia',
      'Distrito',
      ...usefulHeaders.slice(serviceIndex),
    ];
    const entries = createValidEntries([
      { header: 'Departamento', occurrence: 0, value: 82 },
      { header: 'Provincia', occurrence: 0, value: 82 },
      { header: 'Distrito', occurrence: 0, value: 82 },
    ]);
    const input = await createWorkbook(fullHeaders, [
      createRow(fullHeaders, entries),
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview.invalid).toBe(0);
    expect(preview.rows[0]).toMatchObject({
      department: 'AYACUCHO',
      province: 'HUAMANGA',
      district: 'AYACUCHO',
    });
  });

  it('blocks an approved portability with an unknown operator code', async () => {
    const input = await createWorkbook(usefulHeaders, [
      createRow(
        usefulHeaders,
        createValidEntries([{ header: 'Operador Cedente Móvil', value: 99 }]),
      ),
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({ importable: 0, excluded: 0, invalid: 1 });
    expect(preview.rows[0]?.issues).toContain('UNKNOWN_OPERATOR');
  });
});
