export type DitoOrderStatus =
  'OPEN' | 'SENT' | 'CLOSED' | 'CANCELLED' | 'UNKNOWN';

export type DitoSentSubstatus =
  | 'NO_STATUS'
  | 'ASSIGNED'
  | 'SCHEDULED'
  | 'NOT_DELIVERED'
  | 'REJECTED'
  | 'DELIVERED'
  | 'UNKNOWN';

export type DitoDeliveryStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'NOT_DELIVERED'
  | 'RESCHEDULED'
  | 'CANCELLED';

export interface NormalizeDitoOrderStateInput {
  statusRaw: unknown;
  sentSubstatusRaw?: unknown;
  occurredAt: Date;
  currentNoStatusDetectedAt?: Date | null;
}

export interface NormalizedDitoOrderState {
  status: DitoOrderStatus;
  statusRaw: string | null;

  sentSubstatus: DitoSentSubstatus | null;

  sentSubstatusRaw: string | null;

  deliveryStatus: DitoDeliveryStatus;

  noStatusDetectedAt: Date | null;

  requiresRecovery: boolean;

  requiresReentryReview: boolean;

  activationConfirmed: boolean;

  isTerminal: boolean;
}

const MAIN_STATUS_MAP: Readonly<Record<string, DitoOrderStatus>> = {
  ABIERTO: 'OPEN',

  OPEN: 'OPEN',

  ENVIADO: 'SENT',

  SENT: 'SENT',

  CERRADO: 'CLOSED',

  CLOSED: 'CLOSED',

  CANCELADO: 'CANCELLED',

  CANCELLED: 'CANCELLED',
};

const SENT_SUBSTATUS_MAP: Readonly<Record<string, DitoSentSubstatus>> = {
  SIN_ESTADO: 'NO_STATUS',

  NO_STATUS: 'NO_STATUS',

  ASIGNADO: 'ASSIGNED',

  ASSIGNED: 'ASSIGNED',

  AGENDADO: 'SCHEDULED',

  SCHEDULED: 'SCHEDULED',

  NO_ENTREGADO: 'NOT_DELIVERED',

  NOT_DELIVERED: 'NOT_DELIVERED',

  RECHAZADO: 'REJECTED',

  REJECTED: 'REJECTED',

  ENTREGADO: 'DELIVERED',

  DELIVERED: 'DELIVERED',
};

function asRawText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  return text || null;
}
function normalizeKey(value: unknown): string {
  const raw = asRawText(value);

  if (!raw) {
    return '';
  }

  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function parseMainStatus(value: unknown): DitoOrderStatus {
  const key = normalizeKey(value);

  return MAIN_STATUS_MAP[key] ?? 'UNKNOWN';
}

function parseSentSubstatus(value: unknown): DitoSentSubstatus | null {
  const key = normalizeKey(value);

  if (!key) {
    return null;
  }

  return SENT_SUBSTATUS_MAP[key] ?? 'UNKNOWN';
}

function deriveDeliveryStatus(
  status: DitoOrderStatus,
  sentSubstatus: DitoSentSubstatus | null,
): DitoDeliveryStatus {
  if (status === 'CLOSED') {
    return 'DELIVERED';
  }

  if (status === 'CANCELLED') {
    return 'CANCELLED';
  }

  if (status !== 'SENT') {
    return 'PENDING';
  }

  switch (sentSubstatus) {
    case 'ASSIGNED':
    case 'SCHEDULED':
      return 'IN_TRANSIT';

    case 'NOT_DELIVERED':
      return 'NOT_DELIVERED';

    case 'REJECTED':
      return 'CANCELLED';

    case 'DELIVERED':
      return 'DELIVERED';

    case 'NO_STATUS':
    case 'UNKNOWN':
    case null:
      return 'PENDING';
  }
}

export function normalizeDitoOrderState(
  input: NormalizeDitoOrderStateInput,
): NormalizedDitoOrderState {
  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new RangeError('La fecha del estado DITO es inválida');
  }

  const statusRaw = asRawText(input.statusRaw);

  const explicitSubstatusRaw = asRawText(input.sentSubstatusRaw);

  let status = parseMainStatus(input.statusRaw);

  const substatusFromMain = parseSentSubstatus(input.statusRaw);

  let sentSubstatus = parseSentSubstatus(input.sentSubstatusRaw);

  let resolvedSubstatusRaw = explicitSubstatusRaw;

  /*
   * Algunos orígenes pueden enviar
   * únicamente "AGENDADO",
   * "NO ENTREGADO" o "ENTREGADO"
   * sin declarar el estado ENVIADO.
   */
  if (status === 'UNKNOWN' && substatusFromMain) {
    status = 'SENT';

    sentSubstatus = substatusFromMain;

    resolvedSubstatusRaw = statusRaw;
  }

  /*
   * ENVIADO sin subestado visible
   * equivale operativamente a
   * SIN_ESTADO.
   */
  if (status === 'SENT' && sentSubstatus === null) {
    sentSubstatus = 'NO_STATUS';
  }

  /*
   * Los subestados solo pertenecen
   * al estado principal ENVIADO.
   */
  if (status !== 'SENT') {
    sentSubstatus = null;

    resolvedSubstatusRaw = null;
  }

  const isNoStatus = status === 'SENT' && sentSubstatus === 'NO_STATUS';

  const noStatusDetectedAt = isNoStatus
    ? (input.currentNoStatusDetectedAt ?? input.occurredAt)
    : null;

  return {
    status,
    statusRaw,

    sentSubstatus,

    sentSubstatusRaw: resolvedSubstatusRaw,

    deliveryStatus: deriveDeliveryStatus(status, sentSubstatus),

    noStatusDetectedAt,

    requiresRecovery: status === 'SENT' && sentSubstatus === 'NOT_DELIVERED',

    requiresReentryReview:
      (status === 'SENT' && sentSubstatus === 'REJECTED') ||
      status === 'CANCELLED',

    activationConfirmed: status === 'CLOSED',

    isTerminal: status === 'CLOSED' || status === 'CANCELLED',
  };
}

export function isNoStatusIncident(
  state: Pick<
    NormalizedDitoOrderState,
    'status' | 'sentSubstatus' | 'noStatusDetectedAt'
  >,
  now: Date,
  thresholdMinutes = 10,
): boolean {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError('La fecha de evaluación es inválida');
  }

  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes < 0) {
    throw new RangeError('El umbral debe ser un número positivo');
  }

  if (
    state.status !== 'SENT' ||
    state.sentSubstatus !== 'NO_STATUS' ||
    !state.noStatusDetectedAt
  ) {
    return false;
  }

  const elapsedMilliseconds =
    now.getTime() - state.noStatusDetectedAt.getTime();

  return elapsedMilliseconds >= thresholdMinutes * 60 * 1000;
}
