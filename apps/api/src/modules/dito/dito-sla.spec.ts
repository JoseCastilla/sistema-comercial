import { calculateInitialDeliverySchedule } from './dito-sla';

describe('calculateInitialDeliverySchedule', () => {
  it('creates a continuous three-hour window before the Express cutoff', () => {
    /*
     * 03/08/2026 19:30
     * America/Lima.
     */
    const approvedAt = new Date('2026-08-04T00:30:00.000Z');

    const schedule = calculateInitialDeliverySchedule('EXPRESS', approvedAt);

    expect(schedule).toEqual({
      serviceLevelHours: 3,

      scheduleStatus: 'SCHEDULED',

      deliveryWindowStart: new Date('2026-08-04T00:30:00.000Z'),

      deliveryWindowEnd: new Date('2026-08-04T03:30:00.000Z'),

      deliveryDueAt: new Date('2026-08-04T03:30:00.000Z'),
    });
  });

  it('accepts exactly 20:00 as a same-day Express order', () => {
    /*
     * 03/08/2026 20:00
     * America/Lima.
     */
    const approvedAt = new Date('2026-08-04T01:00:00.000Z');

    const schedule = calculateInitialDeliverySchedule('EXPRESS', approvedAt);

    expect(schedule.deliveryWindowStart).toEqual(
      new Date('2026-08-04T01:00:00.000Z'),
    );

    expect(schedule.deliveryWindowEnd).toEqual(
      new Date('2026-08-04T04:00:00.000Z'),
    );
  });

  it('moves an Express order after 20:00 to 08:00–11:00 the next calendar day', () => {
    /*
     * Aprobación:
     * 03/08/2026 20:10 Lima.
     *
     * Ventana:
     * 04/08/2026 08:00–11:00 Lima.
     */
    const approvedAt = new Date('2026-08-04T01:10:00.000Z');

    const schedule = calculateInitialDeliverySchedule('EXPRESS', approvedAt);

    expect(schedule).toEqual({
      serviceLevelHours: 3,

      scheduleStatus: 'SCHEDULED',

      deliveryWindowStart: new Date('2026-08-04T13:00:00.000Z'),

      deliveryWindowEnd: new Date('2026-08-04T16:00:00.000Z'),

      deliveryDueAt: new Date('2026-08-04T16:00:00.000Z'),
    });
  });

  it('handles month changes when moving an Express order to the next day', () => {
    /*
     * Aprobación:
     * 31/08/2026 20:10 Lima.
     *
     * Ventana:
     * 01/09/2026 08:00–11:00 Lima.
     */
    const approvedAt = new Date('2026-09-01T01:10:00.000Z');

    const schedule = calculateInitialDeliverySchedule('EXPRESS', approvedAt);

    expect(schedule.deliveryWindowStart).toEqual(
      new Date('2026-09-01T13:00:00.000Z'),
    );

    expect(schedule.deliveryWindowEnd).toEqual(
      new Date('2026-09-01T16:00:00.000Z'),
    );
  });

  it.each([
    ['REGULAR_24H', 24],

    ['REGULAR_48H', 48],

    ['REGULAR_72H', 72],
  ] as const)(
    'keeps %s pending until a shift is assigned',
    (deliveryMethod, serviceLevelHours) => {
      const schedule = calculateInitialDeliverySchedule(
        deliveryMethod,
        new Date('2026-08-02T15:03:00.000Z'),
      );

      expect(schedule).toEqual({
        serviceLevelHours,

        scheduleStatus: 'PENDING_SHIFT',

        deliveryWindowStart: null,

        deliveryWindowEnd: null,

        deliveryDueAt: null,
      });
    },
  );

  it('does not mutate approvedAt', () => {
    const approvedAt = new Date('2026-08-04T01:10:00.000Z');

    const originalTime = approvedAt.getTime();

    calculateInitialDeliverySchedule('EXPRESS', approvedAt);

    expect(approvedAt.getTime()).toBe(originalTime);
  });

  it('rejects an invalid approval date', () => {
    expect(() =>
      calculateInitialDeliverySchedule('EXPRESS', new Date('invalid')),
    ).toThrow('approvedAt debe ser una fecha válida');
  });

  it('keeps unknown delivery methods pending configuration', () => {
    const schedule = calculateInitialDeliverySchedule(
      'UNKNOWN',
      new Date('2026-08-02T15:03:00.000Z'),
    );

    expect(schedule).toEqual({
      serviceLevelHours: null,

      scheduleStatus: 'PENDING_CONFIGURATION',

      deliveryWindowStart: null,

      deliveryWindowEnd: null,

      deliveryDueAt: null,
    });
  });
});
