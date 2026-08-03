import type { DitoDeliveryMethod } from '@repo/contracts';

export type DeliveryScheduleStatus =
  'SCHEDULED' | 'PENDING_SHIFT' | 'PENDING_CONFIGURATION';

export interface InitialDeliverySchedule {
  serviceLevelHours: 3 | 24 | 48 | 72 | null;

  scheduleStatus: DeliveryScheduleStatus;

  deliveryWindowStart: Date | null;

  deliveryWindowEnd: Date | null;

  deliveryDueAt: Date | null;
}

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function assertValidDate(value: Date): void {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError('approvedAt debe ser una fecha válida');
  }
}

export function calculateInitialDeliverySchedule(
  deliveryMethod: DitoDeliveryMethod,

  approvedAt: Date,
): InitialDeliverySchedule {
  assertValidDate(approvedAt);

  if (deliveryMethod === 'EXPRESS') {
    const deliveryWindowStart = cloneDate(approvedAt);

    const deliveryWindowEnd = new Date(
      approvedAt.getTime() + 3 * HOUR_IN_MILLISECONDS,
    );

    return {
      serviceLevelHours: 3,
      scheduleStatus: 'SCHEDULED',

      deliveryWindowStart,
      deliveryWindowEnd,

      deliveryDueAt: cloneDate(deliveryWindowEnd),
    };
  }

  if (
    deliveryMethod === 'REGULAR_24H' ||
    deliveryMethod === 'REGULAR_48H' ||
    deliveryMethod === 'REGULAR_72H'
  ) {
    const serviceLevelHours =
      deliveryMethod === 'REGULAR_24H'
        ? 24
        : deliveryMethod === 'REGULAR_48H'
          ? 48
          : 72;

    return {
      serviceLevelHours,
      scheduleStatus: 'PENDING_SHIFT',

      deliveryWindowStart: null,

      deliveryWindowEnd: null,

      deliveryDueAt: null,
    };
  }

  return {
    serviceLevelHours: null,

    scheduleStatus: 'PENDING_CONFIGURATION',

    deliveryWindowStart: null,

    deliveryWindowEnd: null,

    deliveryDueAt: null,
  };
}
