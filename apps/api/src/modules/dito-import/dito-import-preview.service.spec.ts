import ExcelJS from 'exceljs';

import { DatabaseService } from '../database/database.service';

import { DitoImportPreviewService } from './dito-import-preview.service';

const headers = [
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
  'Nro Servicio Movil',
  'Operacion Comercial Movil',
  'Operador Cedente Movil',
  'Order ID Movil',
  'Plan Movil',
  'Método de Entrega',
  'Departamento',
  'Provincia',
  'Distrito',
] as const;

const values = [
  'FE-TEST-001',
  'APROBADO',
  'asesora01',
  'ASESORA DEMO',
  '2026-08-01',
  '08:16:09',
  'CLIENTE DEMO',
  'DNI',
  '00000001',
  'cliente@example.com',
  '900000001',
  'PORTABILIDAD',
  21,
  '1943000001',
  'Plan Movistar Maximo S/39.9',
  'Delivery Express',
  'AYACUCHO',
  1,
  'AYACUCHO',
] as const;

interface BatchSummary {
  id: string;
  status: 'PREVIEW' | 'READY';
  sourceRows: number;
  importableRows: number;
  excludedRows: number;
  invalidRows: number;
  newRows: number;
  enrichmentRows: number;
  unchangedRows: number;
  blockedRows: number;
  conflictRows: number;
}

interface BatchCreateArguments {
  data: Omit<BatchSummary, 'id'> & {
    rows: {
      create: Array<{
        classification: string;
        issueCodes: string[];
      }>;
    };
  };
}

type TransactionCallback = (transaction: unknown) => Promise<unknown>;

interface DatabaseMock {
  ditoImportBatch: {
    findUnique: jest.Mock<Promise<BatchSummary | null>, [unknown]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
}

function existingSummary(): BatchSummary {
  return {
    id: 'batch-existing',
    status: 'READY',
    sourceRows: 1,
    importableRows: 1,
    excludedRows: 0,
    invalidRows: 0,
    newRows: 1,
    enrichmentRows: 0,
    unchangedRows: 0,
    blockedRows: 0,
    conflictRows: 0,
  };
}

function batchFindMock(value: BatchSummary | null) {
  return jest
    .fn<Promise<BatchSummary | null>, [unknown]>()
    .mockResolvedValue(value);
}

function transactionMock() {
  return jest.fn<Promise<unknown>, [TransactionCallback]>();
}

async function createWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales');
  worksheet.addRow(['Ventas']);
  worksheet.addRow([]);
  worksheet.addRow([...headers]);
  worksheet.addRow([...values]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('DitoImportPreviewService', () => {
  it('reuses an existing batch with the same organization and file hash', async () => {
    const database: DatabaseMock = {
      ditoImportBatch: {
        findUnique: batchFindMock(existingSummary()),
      },
      $transaction: transactionMock(),
    };
    const service = new DitoImportPreviewService({
      getClient: () => database,
    } as unknown as DatabaseService);

    const result = await service.createPreview({
      organizationId: 'organization-1',
      actorUserId: 'admin-1',
      fileName: 'sales.xlsx',
      workbook: await createWorkbook(),
      now: new Date('2026-08-06T12:00:00.000Z'),
    });

    expect(result).toEqual({
      batchId: 'batch-existing',
      reused: true,
      status: 'READY',
      sourceRows: 1,
      importableRows: 1,
      excludedRows: 0,
      invalidRows: 0,
      newRows: 1,
      enrichmentRows: 0,
      unchangedRows: 0,
      blockedRows: 0,
      conflictRows: 0,
    });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('persists an unresolved identity and blocks the row without touching orders', async () => {
    const transaction = {
      ditoImportBatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn<Promise<BatchSummary>, [BatchCreateArguments]>()
          .mockImplementation((input) =>
            Promise.resolve<BatchSummary>({
              id: 'batch-new',
              status: input.data.status,
              sourceRows: input.data.sourceRows,
              importableRows: input.data.importableRows,
              excludedRows: input.data.excludedRows,
              invalidRows: input.data.invalidRows,
              newRows: input.data.newRows,
              enrichmentRows: input.data.enrichmentRows,
              unchangedRows: input.data.unchangedRows,
              blockedRows: input.data.blockedRows,
              conflictRows: input.data.conflictRows,
            }),
          ),
      },
      ditoAgentIdentity: {
        upsert: jest.fn().mockResolvedValue({
          id: 'identity-1',
          userId: null,
          isActive: true,
          user: null,
        }),
      },
      ditoOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const database: DatabaseMock = {
      ditoImportBatch: { findUnique: batchFindMock(null) },
      $transaction: transactionMock().mockImplementation(
        (callback: TransactionCallback) => callback(transaction),
      ),
    };
    const service = new DitoImportPreviewService({
      getClient: () => database,
    } as unknown as DatabaseService);

    const result = await service.createPreview({
      organizationId: 'organization-1',
      actorUserId: 'admin-1',
      fileName: 'sales.xlsx',
      workbook: await createWorkbook(),
      now: new Date('2026-08-06T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      batchId: 'batch-new',
      reused: false,
      status: 'PREVIEW',
      importableRows: 1,
      blockedRows: 1,
      newRows: 0,
    });
    const persistedRow =
      transaction.ditoImportBatch.create.mock.calls[0]?.[0].data.rows.create[0];
    expect(persistedRow).toMatchObject({
      classification: 'BLOCKED_IDENTITY',
      issueCodes: ['UNRESOLVED_DITO_IDENTITY'],
    });
    expect(transaction.ditoOrder.create).not.toHaveBeenCalled();
    expect(transaction.ditoOrder.update).not.toHaveBeenCalled();
  });

  it('marks a new row ready when its DITO identity points to an active agent', async () => {
    const transaction = {
      ditoImportBatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn<Promise<BatchSummary>, [BatchCreateArguments]>()
          .mockImplementation((input) =>
            Promise.resolve<BatchSummary>({
              id: 'batch-ready',
              status: input.data.status,
              sourceRows: input.data.sourceRows,
              importableRows: input.data.importableRows,
              excludedRows: input.data.excludedRows,
              invalidRows: input.data.invalidRows,
              newRows: input.data.newRows,
              enrichmentRows: input.data.enrichmentRows,
              unchangedRows: input.data.unchangedRows,
              blockedRows: input.data.blockedRows,
              conflictRows: input.data.conflictRows,
            }),
          ),
      },
      ditoAgentIdentity: {
        upsert: jest.fn().mockResolvedValue({
          id: 'identity-1',
          userId: 'agent-1',
          isActive: true,
          user: {
            status: 'ACTIVE',
            memberships: [{ userId: 'agent-1' }],
          },
        }),
      },
      ditoOrder: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const database: DatabaseMock = {
      ditoImportBatch: { findUnique: batchFindMock(null) },
      $transaction: transactionMock().mockImplementation(
        (callback: TransactionCallback) => callback(transaction),
      ),
    };
    const service = new DitoImportPreviewService({
      getClient: () => database,
    } as unknown as DatabaseService);

    const result = await service.createPreview({
      organizationId: 'organization-1',
      actorUserId: 'admin-1',
      fileName: 'sales.xlsx',
      workbook: await createWorkbook(),
      now: new Date('2026-08-06T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      status: 'READY',
      newRows: 1,
      blockedRows: 0,
    });
  });
});
