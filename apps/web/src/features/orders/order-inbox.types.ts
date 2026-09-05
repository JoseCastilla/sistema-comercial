import type {
  OrderActionFilter,
  OrderDueFilter,
  OrderPeriod,
} from "@repo/validation";

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
  | "ACTIVE"
  | "ESCALATIONS"
  | "LOGISTICS"
  | "INCIDENTS"
  | "RECOVERY"
  | "AWAITING_ACTIVATION"
  | "DELIVERED"
  | "FINAL"
  | "ALL";

export interface OrderInboxAccess {
  userId: string;

  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

export interface OrderInboxTeamOption {
  id: string;
  name: string;
}

/** Asesor elegible como filtro: los mismos que se pueden asignar (SPEC-041). */
export interface OrderAdvisorOption {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
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

  assignmentStatusLabel: string;
  deliveryStatus: string;

  status: OrderStatusValue;
  statusLabel: string;

  sentSubstatus: OrderSentSubstatusValue;
  sentSubstatusLabel: string | null;

  statusAgeLabel: string;
  noStatusIncident: boolean;

  deliveryObservation: string | null;
  agrDelivery: {
    status: string;
    actionKind:
      | "RESCHEDULE"
      | "CONTACT"
      | "REENTER"
      | "MEETING_POINT"
      | "VERIFY_TENURE"
      | "WAIT_PORTABILITY";
    actionLabel: string;
    actionShortLabel: string;
    reason: string | null;
    result: string | null;
    nextAction: string | null;
    commitmentDate: string | null;
  } | null;

  registeredAtLabel: string;
  approvedAtLabel: string;
  deliveryWindowLabel: string;

  slaState: OrderSlaState;
  slaLabel: string;
  slaDetail: string | null;

  canUpdate: boolean;
  canClose: boolean;
  canCancelDirectly: boolean;
  canRequestCancellation: boolean;
  canReviewCancellation: boolean;
  canEscalate: boolean;
  canReviewEscalation: boolean;
  incidentEscalation: {
    id: string;
    status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
    category: string;
    priority: string;
    templateType: string;
    description: string;
    requestedAction: string;
    createdByName: string;
    createdAtLabel: string;
    acknowledgement: string | null;
    acknowledgedByName: string | null;
    acknowledgedAtLabel: string | null;
    resolution: string | null;
    tdpTemplate: string | null;
    tdpEscalatedByName: string | null;
    tdpEscalatedAtLabel: string | null;
    resolvedByName: string | null;
    resolvedAtLabel: string | null;
  } | null;
  pendingCancellationRequest: {
    id: string;
    reason: string;
    requestedByName: string;
    requestedAtLabel: string;
  } | null;
  closedByName: string | null;
  closedAtLabel: string | null;
  canCorrect: boolean;
  canSendToRecovery: boolean;
  recoveryCase: {
    id: string;
    status: string;
    priority: string | null;
    entryReason: string | null;
    assignedToName: string | null;
    /** Abierto (en gestión) o ya resuelto; el pedido enseña ambos (NAV-02). */
    isOpen: boolean;
    resolvedAtLabel: string | null;
  } | null;
  canResolveAssignment: boolean;
  canClaimAssignment: boolean;
  parseStatus: string;
  updatedAt: string;
}

export interface OrderInboxData {
  generatedAt: string;
  role: OrderInboxAccess["role"];

  period: OrderPeriod;
  periodLabel: string;
  from: string | null;
  to: string | null;
  rangeMaxDate: string;
  filter: OrderFilter;
  search: string;
  teamFilter: string;
  teamAllLabel: string;
  teamOptions: OrderInboxTeamOption[];
  /** `ALL` o el `agentUserId` elegido, ya validado contra el alcance. */
  advisorFilter: string;
  advisorOptions: OrderAdvisorOption[];
  /** Solo en `LOGISTICS`; en cualquier otra vista es `null`. */
  actionFilter: OrderActionFilter | null;
  dueFilter: OrderDueFilter | null;
  /** Ruta de Rendimiento desde la que se llegó, para volver con filtros. */
  returnTo?: string | null;
  assignmentTeams: OrderAssignmentTeamOption[];
  showTeamFilter: boolean;
  showAdvisorColumn: boolean;
  filteredTotal: number;

  items: OrderInboxItem[];

  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };

  pendingBeforeMonth: number;

  logisticsSummary: {
    total: number;
    reschedule: number;
    contact: number;
    review: number;
    lastFetchedAtLabel: string | null;
  };

  totals: {
    visible: number;
    incidents: number;
    escalations: number;
    logistics: number;
    notDelivered: number;
    recovery: number;
    delivered: number;
    overdue: number;
  };
}
