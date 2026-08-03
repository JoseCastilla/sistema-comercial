import { calculateInitialDeliverySchedule } from './dito-sla';

describe('calculateInitialDeliverySchedule', () => {
  it('creates a three-hour window for Express', () => {
    const approvedAt = new Date('2026-08-02T15:03:00.000Z');

    const schedule = calculateInitialDeliverySchedule('EXPRESS', approvedAt);

    expect(schedule).toEqual({
      serviceLevelHours: 3,

      scheduleStatus: 'SCHEDULED',

      deliveryWindowStart: new Date('2026-08-02T15:03:00.000Z'),

      deliveryWindowEnd: new Date('2026-08-02T18:03:00.000Z'),

      deliveryDueAt: new Date('2026-08-02T18:03:00.000Z'),
    });
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
    const approvedAt = new Date('2026-08-02T15:03:00.000Z');

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
