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

interface BusinessDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

type BusinessDateTimePartName =
  'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

const BUSINESS_TIME_ZONE = 'America/Lima';

const EXPRESS_CUTOFF_HOUR = 20;

const EXPRESS_NEXT_DAY_START_HOUR = 8;

const EXPRESS_DURATION_HOURS = 3;

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

const businessDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,

  year: 'numeric',

  month: '2-digit',

  day: '2-digit',

  hour: '2-digit',

  minute: '2-digit',

  second: '2-digit',

  hourCycle: 'h23',
});

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function assertValidDate(value: Date): void {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError('approvedAt debe ser una fecha válida');
  }
}

function getNumericPart(
  parts: Intl.DateTimeFormatPart[],

  type: BusinessDateTimePartName,
): number {
  const part = parts.find((candidate) => candidate.type === type);

  if (!part) {
    throw new Error(`No se pudo obtener ${type} en ${BUSINESS_TIME_ZONE}`);
  }

  return Number(part.value);
}

function getBusinessDateTimeParts(value: Date): BusinessDateTimeParts {
  const parts = businessDateTimeFormatter.formatToParts(value);

  return {
    year: getNumericPart(parts, 'year'),

    month: getNumericPart(parts, 'month'),

    day: getNumericPart(parts, 'day'),

    hour: getNumericPart(parts, 'hour'),

    minute: getNumericPart(parts, 'minute'),

    second: getNumericPart(parts, 'second'),

    millisecond: value.getUTCMilliseconds(),
  };
}

function getBusinessTimeZoneOffset(value: Date): number {
  const wholeSecondValue = new Date(Math.floor(value.getTime() / 1000) * 1000);

  const parts = getBusinessDateTimeParts(wholeSecondValue);

  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return representedAsUtc - wholeSecondValue.getTime();
}

function createDateInBusinessTimeZone(parts: BusinessDateTimeParts): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );

  const initialOffset = getBusinessTimeZoneOffset(new Date(utcGuess));

  let result = new Date(utcGuess - initialOffset);

  const finalOffset = getBusinessTimeZoneOffset(result);

  if (finalOffset !== initialOffset) {
    result = new Date(utcGuess - finalOffset);
  }

  return result;
}

function getNextCalendarDay(
  parts: BusinessDateTimeParts,
): Pick<BusinessDateTimeParts, 'year' | 'month' | 'day'> {
  const nextCalendarDay = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1),
  );

  return {
    year: nextCalendarDay.getUTCFullYear(),

    month: nextCalendarDay.getUTCMonth() + 1,

    day: nextCalendarDay.getUTCDate(),
  };
}

function isAfterExpressCutoff(approvedAt: Date): boolean {
  const parts = getBusinessDateTimeParts(approvedAt);

  if (parts.hour > EXPRESS_CUTOFF_HOUR) {
    return true;
  }

  if (parts.hour < EXPRESS_CUTOFF_HOUR) {
    return false;
  }

  return parts.minute > 0 || parts.second > 0 || parts.millisecond > 0;
}

function calculateExpressSchedule(approvedAt: Date): InitialDeliverySchedule {
  if (!isAfterExpressCutoff(approvedAt)) {
    const deliveryWindowStart = cloneDate(approvedAt);

    const deliveryWindowEnd = new Date(
      approvedAt.getTime() + EXPRESS_DURATION_HOURS * HOUR_IN_MILLISECONDS,
    );

    return {
      serviceLevelHours: EXPRESS_DURATION_HOURS,

      scheduleStatus: 'SCHEDULED',

      deliveryWindowStart,

      deliveryWindowEnd,

      deliveryDueAt: cloneDate(deliveryWindowEnd),
    };
  }

  const approvedBusinessParts = getBusinessDateTimeParts(approvedAt);

  const nextCalendarDay = getNextCalendarDay(approvedBusinessParts);

  const deliveryWindowStart = createDateInBusinessTimeZone({
    ...nextCalendarDay,

    hour: EXPRESS_NEXT_DAY_START_HOUR,

    minute: 0,

    second: 0,

    millisecond: 0,
  });

  const deliveryWindowEnd = new Date(
    deliveryWindowStart.getTime() +
      EXPRESS_DURATION_HOURS * HOUR_IN_MILLISECONDS,
  );

  return {
    serviceLevelHours: EXPRESS_DURATION_HOURS,

    scheduleStatus: 'SCHEDULED',

    deliveryWindowStart,

    deliveryWindowEnd,

    deliveryDueAt: cloneDate(deliveryWindowEnd),
  };
}

export function calculateInitialDeliverySchedule(
  deliveryMethod: DitoDeliveryMethod,

  approvedAt: Date,
): InitialDeliverySchedule {
  assertValidDate(approvedAt);

  if (deliveryMethod === 'EXPRESS') {
    return calculateExpressSchedule(approvedAt);
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
