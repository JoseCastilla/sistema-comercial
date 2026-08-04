import {
  isNoStatusIncident,
  normalizeDitoOrderState,
} from './dito-order-state';

describe('normalizeDitoOrderState', () => {
  const occurredAt = new Date('2026-08-04T15:00:00.000Z');

  it('maps ABIERTO to OPEN', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Abierto',

      occurredAt,
    });

    expect(result).toEqual({
      status: 'OPEN',

      statusRaw: 'Abierto',

      sentSubstatus: null,

      sentSubstatusRaw: null,

      deliveryStatus: 'PENDING',

      noStatusDetectedAt: null,

      requiresRecovery: false,

      requiresReentryReview: false,

      activationConfirmed: false,

      isTerminal: false,
    });
  });

  it('maps ENVIADO without a substatus to NO_STATUS', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Enviado',

      occurredAt,
    });

    expect(result.status).toBe('SENT');

    expect(result.sentSubstatus).toBe('NO_STATUS');

    expect(result.noStatusDetectedAt).toEqual(occurredAt);

    expect(result.deliveryStatus).toBe('PENDING');
  });

  it('preserves the original NO_STATUS detection time', () => {
    const detectedAt = new Date('2026-08-04T14:55:00.000Z');

    const result = normalizeDitoOrderState({
      statusRaw: 'Enviado',

      sentSubstatusRaw: 'Sin estado',

      occurredAt,

      currentNoStatusDetectedAt: detectedAt,
    });

    expect(result.noStatusDetectedAt).toEqual(detectedAt);
  });

  it.each([
    ['Asignado', 'ASSIGNED', 'IN_TRANSIT'],

    ['Agendado', 'SCHEDULED', 'IN_TRANSIT'],

    ['Entregado', 'DELIVERED', 'DELIVERED'],
  ] as const)(
    'maps SENT substatus %s',
    (rawSubstatus, expectedSubstatus, expectedDeliveryStatus) => {
      const result = normalizeDitoOrderState({
        statusRaw: 'Enviado',

        sentSubstatusRaw: rawSubstatus,

        occurredAt,
      });

      expect(result.sentSubstatus).toBe(expectedSubstatus);

      expect(result.deliveryStatus).toBe(expectedDeliveryStatus);
    },
  );

  it('marks NO ENTREGADO as recoverable', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Enviado',

      sentSubstatusRaw: 'No entregado',

      occurredAt,
    });

    expect(result.sentSubstatus).toBe('NOT_DELIVERED');

    expect(result.requiresRecovery).toBe(true);

    expect(result.requiresReentryReview).toBe(false);
  });

  it('marks RECHAZADO for reentry review', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Enviado',

      sentSubstatusRaw: 'Rechazado',

      occurredAt,
    });

    expect(result.sentSubstatus).toBe('REJECTED');

    expect(result.deliveryStatus).toBe('CANCELLED');

    expect(result.requiresReentryReview).toBe(true);
  });

  it('does not consider SENT DELIVERED an activated sale', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Enviado',

      sentSubstatusRaw: 'Entregado',

      occurredAt,
    });

    expect(result.deliveryStatus).toBe('DELIVERED');

    expect(result.activationConfirmed).toBe(false);

    expect(result.isTerminal).toBe(false);
  });

  it('marks CERRADO as an activated sale', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Cerrado',

      sentSubstatusRaw: 'Entregado',

      occurredAt,
    });

    expect(result.status).toBe('CLOSED');

    expect(result.sentSubstatus).toBeNull();

    expect(result.deliveryStatus).toBe('DELIVERED');

    expect(result.activationConfirmed).toBe(true);

    expect(result.isTerminal).toBe(true);
  });

  it('marks CANCELADO for reentry review', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'Cancelado',

      occurredAt,
    });

    expect(result.status).toBe('CANCELLED');

    expect(result.deliveryStatus).toBe('CANCELLED');

    expect(result.requiresReentryReview).toBe(true);

    expect(result.isTerminal).toBe(true);
  });

  it('infers SENT when only NO ENTREGADO is received', () => {
    const result = normalizeDitoOrderState({
      statusRaw: 'No entregado',

      occurredAt,
    });

    expect(result.status).toBe('SENT');

    expect(result.sentSubstatus).toBe('NOT_DELIVERED');

    expect(result.sentSubstatusRaw).toBe('No entregado');
  });
});

describe('isNoStatusIncident', () => {
  const detectedAt = new Date('2026-08-04T15:00:00.000Z');

  const state = {
    status: 'SENT' as const,

    sentSubstatus: 'NO_STATUS' as const,

    noStatusDetectedAt: detectedAt,
  };

  it('does not trigger before ten minutes', () => {
    expect(
      isNoStatusIncident(state, new Date('2026-08-04T15:09:59.999Z')),
    ).toBe(false);
  });

  it('triggers at ten minutes', () => {
    expect(
      isNoStatusIncident(state, new Date('2026-08-04T15:10:00.000Z')),
    ).toBe(true);
  });
});
