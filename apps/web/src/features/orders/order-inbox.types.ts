export type OrderSlaState =
  | "OVERDUE"
  | "DUE_SOON"
  | "ON_TIME"
  | "PENDING_SHIFT"
  | "NO_DEADLINE"
  | "CLOSED";

export type OrderStatusValue =
  "OPEN" | "SENT" | "CLOSED" | "CANCELLED" | "UNKNOWN";

export type OrderSentSubstatusValue =
  | "NO_STATUS"
  | "ASSIGNED"
  | "SCHEDULED"
  | "NOT_DELIVERED"
  | "REJECTED"
  | "DELIVERED"
  | "UNKNOWN"
  | null;

export interface OrderInboxAccess {
  userId: string;

  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

export interface OrderInboxItem {
  id: string;
  orderCode: string;
  operation: string;

  holderName: string;
  documentNumber: string;
  serviceNumber: string;

  deliveryMethod: string;
  deliveryMethodLabel: string;

  department: string;
  province: string;
  district: string;
  locationLabel: string;

  agentName: string;

  matchStatus: string;
  deliveryStatus: string;

  status: OrderStatusValue;
  statusLabel: string;

  sentSubstatus: OrderSentSubstatusValue;
  sentSubstatusLabel: string | null;

  statusAgeLabel: string;
  noStatusIncident: boolean;

  deliveryObservation: string | null;

  registeredAtLabel: string;
  approvedAtLabel: string;
  deliveryWindowLabel: string;
  deliveryDueAtLabel: string | null;

  slaState: OrderSlaState;
  slaLabel: string;

  canUpdate: boolean;
}

export interface OrderInboxData {
  generatedAt: string;

  items: OrderInboxItem[];

  totals: {
    visible: number;
    incidents: number;
    notDelivered: number;
    delivered: number;
    overdue: number;
  };
}
