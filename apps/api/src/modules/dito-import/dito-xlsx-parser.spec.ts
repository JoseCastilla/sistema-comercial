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
  'Origen Portabilidad',
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
  'Asesor',
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
    { header: 'Origen Portabilidad', value: 'POSTPAGO' },
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
    { header: 'Asesor', value: 'Asesora Reportada' },
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
  it.each([
    ['Delivery Regular 24 horas', 'REGULAR_24H'],
    ['Delivery Regular 48 horas', 'REGULAR_48H'],
    ['Delivery Regular 72 horas', 'REGULAR_72H'],
  ] as const)('recognizes %s as %s', async (rawMethod, expectedMethod) => {
    const input = await createWorkbook(usefulHeaders, [
      createRow(
        usefulHeaders,
        createValidEntries([{ header: 'Método de Entrega', value: rawMethod }]),
      ),
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({ importable: 1, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({
      deliveryMethod: expectedMethod,
      deliveryMethodRaw: rawMethod,
    });
    expect(preview.rows[0]?.issues).not.toContain('UNKNOWN_DELIVERY_METHOD');
  });

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

  it('excludes fixed-only sales without blocking the mobile import', async () => {
    const serviceIndex = usefulHeaders.indexOf('Nro Servicio Móvil');
    const headers = [
      ...usefulHeaders.slice(0, serviceIndex),
      'Nro Servicio Fijo',
      'Operación Comercial Fijo',
      'Order ID Fijo',
      'Plan Fijo',
      ...usefulHeaders.slice(serviceIndex),
    ];
    const fixedOnlyOverrides: RowEntry[] = [
      { header: 'Nro Servicio Móvil', value: null },
      { header: 'Operación Comercial Móvil', value: null },
      { header: 'Operador Cedente Móvil', value: null },
      { header: 'Plan Móvil', value: null },
      { header: 'Método de Entrega', value: null },
      { header: 'Departamento', value: null },
      { header: 'Provincia', value: null },
      { header: 'Distrito', value: null },
      { header: 'Nro Servicio Fijo', value: '012345678' },
      { header: 'Operación Comercial Fijo', value: 'ALTA' },
      { header: 'Order ID Fijo', value: 'HOGAR-1001' },
      { header: 'Plan Fijo', value: 'Internet Fibra 400 Mbps' },
    ];
    const approvedFixed = createRow(
      headers,
      createValidEntries(fixedOnlyOverrides),
    );
    const pendingFixed = createRow(
      headers,
      createValidEntries([
        ...fixedOnlyOverrides,
        { header: 'Estado Pedido WC', value: 'PENDIENTE' },
        { header: 'Nro Pedido WC', value: 'FE-HOGAR-002' },
        { header: 'Order ID Móvil', value: '1943000092' },
      ]),
    );
    const convergentSale = createRow(
      headers,
      createValidEntries([
        { header: 'Nro Servicio Fijo', value: '012345679' },
        { header: 'Operación Comercial Fijo', value: 'ALTA' },
        { header: 'Order ID Fijo', value: 'HOGAR-1002' },
        { header: 'Plan Fijo', value: 'Internet Fibra 400 Mbps' },
      ]),
    );
    const input = await createWorkbook(headers, [
      approvedFixed,
      pendingFixed,
      convergentSale,
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({
      sourceRows: 3,
      importable: 1,
      excluded: 2,
      invalid: 0,
    });
    expect(preview.rows[0]).toMatchObject({
      outcome: 'EXCLUDED',
      issues: ['NON_MOBILE_PRODUCT'],
      serviceNumber: null,
      commercialOperation: null,
    });
    expect(preview.rows[1]?.issues).toEqual(
      expect.arrayContaining(['STATUS_NOT_APPROVED', 'NON_MOBILE_PRODUCT']),
    );
    expect(preview.rows[2]).toMatchObject({
      outcome: 'IMPORTABLE',
      commercialOperation: 'PORT_POSTPAID',
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

  it('uses explicit portability origin independently from the plan price', async () => {
    const prepaid = createRow(
      usefulHeaders,
      createValidEntries([
        { header: 'Order ID Móvil', value: '1943000010' },
        { header: 'Origen Portabilidad', value: 'PREPAGO' },
        {
          header: 'Plan Móvil',
          value: 'Abierto Movistar Libre Plan Movistar Máximo S/29.90',
        },
      ]),
    );
    const postpaid = createRow(
      usefulHeaders,
      createValidEntries([
        { header: 'Order ID Móvil', value: '1943000011' },
        { header: 'Origen Portabilidad', value: 'POST PAGO' },
        {
          header: 'Plan Móvil',
          value: 'Abierto Movistar Libre Plan Movistar Máximo S/49.90',
        },
      ]),
    );
    const input = await createWorkbook(usefulHeaders, [prepaid, postpaid]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({ importable: 2, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({
      portabilityOriginRaw: 'PREPAGO',
      commercialOperation: 'PORT_PREPAID',
      fixedCharge: 29.9,
      operationRaw: 'PORTA CLARO PRE 29.9',
    });
    expect(preview.rows[1]).toMatchObject({
      portabilityOriginRaw: 'POST PAGO',
      commercialOperation: 'PORT_POSTPAID',
      fixedCharge: 49.9,
      operationRaw: 'PORTA CLARO POST 49.9',
    });
  });

  it('accepts the DITO Origen header and numeric Excel date/time values', async () => {
    const headers = usefulHeaders.map((header) =>
      header === 'Origen Portabilidad' ? 'Origen' : header,
    );
    const entries = createValidEntries([
      { header: 'Fecha de Registro de Pedido', value: 46235 },
      { header: 'Hora de Registro de Pedido', value: 0.3445486111111111 },
      { header: 'Nro Documento Cliente', value: 9386875 },
    ]).map((entry) =>
      entry.header === 'Origen Portabilidad'
        ? { ...entry, header: 'Origen' }
        : entry,
    );
    const input = await createWorkbook(headers, [createRow(headers, entries)]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-21T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({ importable: 1, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({
      portabilityOriginRaw: 'POSTPAGO',
      commercialOperation: 'PORT_POSTPAID',
      salesAdvisorName: 'Asesora Reportada',
      holderDocumentNumber: '09386875',
    });
    expect(preview.rows[0]?.registeredAt?.toISOString()).toBe(
      '2026-08-01T13:16:09.000Z',
    );
  });

  it('blocks only portability rows when the origin column is absent', async () => {
    const headersWithoutOrigin = usefulHeaders.filter(
      (header) => header !== 'Origen Portabilidad',
    );
    const portabilityEntries = createValidEntries().filter(
      (entry) => entry.header !== 'Origen Portabilidad',
    );
    const newLineEntries = createValidEntries([
      { header: 'Order ID Móvil', value: '1943000012' },
      { header: 'Operación Comercial Móvil', value: 'ALTA' },
      { header: 'Operador Cedente Móvil', value: 45 },
    ]).filter((entry) => entry.header !== 'Origen Portabilidad');
    const input = await createWorkbook(headersWithoutOrigin, [
      createRow(headersWithoutOrigin, portabilityEntries),
      createRow(headersWithoutOrigin, newLineEntries),
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({ importable: 1, invalid: 1 });
    expect(preview.rows[0]).toMatchObject({
      commercialOperation: null,
      portabilityOriginRaw: null,
    });
    expect(preview.rows[0]?.issues).toContain('MISSING_PORTABILITY_ORIGIN');
    expect(preview.rows[1]).toMatchObject({
      commercialOperation: 'NEW_LINE',
      operationRaw: 'ALTA NUEVA POST 39.9',
    });
  });

  it('rejects an unrecognized portability origin instead of inferring it', async () => {
    const input = await createWorkbook(usefulHeaders, [
      createRow(
        usefulHeaders,
        createValidEntries([
          { header: 'Origen Portabilidad', value: 'NO DEFINIDO' },
        ]),
      ),
    ]);

    const preview = await parseDitoSalesWorkbook(
      input,
      new Date('2026-08-06T12:00:00.000Z'),
    );

    expect(preview).toMatchObject({ importable: 0, invalid: 1 });
    expect(preview.rows[0]?.issues).toContain('UNKNOWN_PORTABILITY_ORIGIN');
  });
});
