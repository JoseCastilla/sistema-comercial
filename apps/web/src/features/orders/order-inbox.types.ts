import type { OrderPeriod } from "@repo/validation";

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

export type OrderFilter =
  "ACTIVE" | "INCIDENTS" | "RECOVERY" | "DELIVERED" | "FINAL" | "ALL";

export interface OrderInboxAccess {
  userId: string;

  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

export interface OrderInboxTeamOption {
  id: string;
  name: string;
}

export interface OrderAssignmentTeamOption extends OrderInboxTeamOption {
  agents: Array<{
    id: string;
    name: string;
  }>;
}

export interface OrderInboxItem {
  id: string;
  orderCode: string;
  operation: string;
  commercialOperation: string;
  carrier: string;
  fixedCharge: string | null;

  holderName: string;
  documentNumber: string;
  serviceNumber: string;
  salesCode: string | null;
  billingCycleDay: number | null;
  paymentDueDay: number | null;

  deliveryMethod: string;
  deliveryMethodLabel: string;
  deliveryContactPhone: string;
  deliveryTimeRange: string | null;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  deliveryLatitude: string | null;
  deliveryLongitude: string | null;

  department: string;
  province: string;
  district: string;
  locationLabel: string;

  agentName: string;
  submitterEmail: string | null;

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
  canCorrect: boolean;
  canResolveAssignment: boolean;
  canClaimAssignment: boolean;
  parseStatus: string;
  updatedAt: string;
}

export interface OrderInboxData {
  generatedAt: string;

  period: OrderPeriod;
  periodLabel: string;
  from: string | null;
  to: string | null;
  filter: OrderFilter;
  search: string;
  teamFilter: string;
  teamAllLabel: string;
  teamOptions: OrderInboxTeamOption[];
  assignmentTeams: OrderAssignmentTeamOption[];
  showTeamFilter: boolean;
  filteredTotal: number;

  items: OrderInboxItem[];

  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };

  pendingBeforeMonth: number;

  totals: {
    visible: number;
    incidents: number;
    notDelivered: number;
    delivered: number;
    overdue: number;
  };
}
