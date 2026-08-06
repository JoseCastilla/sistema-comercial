/**
 * Roles disponibles dentro de una organizaciÃƒÂ³n.
 *
 * AGENT representa al asesor comercial.
 * En la interfaz podrÃƒÂ¡ mostrarse como "Asesor".
 */
export type OrganizationRole = "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";

/**
 * Operador del cual proviene el cliente.
 */
export type Carrier = "BITEL" | "CLARO" | "ENTEL" | "MOVISTAR" | "OTHER";

/**
 * OperaciÃƒÂ³n comercial solicitada.
 */
export type CommercialOperation = "NEW_LINE" | "PORT_PREPAID" | "PORT_POSTPAID";

/**
 * Estado principal de cada caso comercial.
 */
export type ManagementStatus =
  | "QUALIFIED"
  | "FOLLOW_UP"
  | "ORDER_ENTERED"
  | "CHIP_DELIVERED"
  | "SALE_CONFIRMED"
  | "LOST";

/**
 * Estado tÃƒÂ©cnico de activaciÃƒÂ³n.
 */
export type ActivationStatus = "PENDING" | "INCIDENT" | "ACTIVATED";

/**
 * Motivo de seguimiento.
 */
export type FollowUpReason =
  "SCHEDULED" | "ACTIVE_DEBT" | "LESS_THAN_30_DAYS" | "MEETING_POINT";

/**
 * Motivo de pÃƒÂ©rdida.
 */
export type LostReason =
  | "CURRENT_MOVISTAR_CUSTOMER"
  | "OUT_OF_COVERAGE"
  | "ZERO_FIXED_CHARGE"
  | "FOREIGNER_ID"
  | "DEVICE_INSTALLMENTS"
  | "NO_LONGER_INTERESTED"
  | "PORTED_OTHER_AGENCY"
  | "PORTED_OTHER_OPERATOR"
  | "RUC_10";

/**
 * Origen comercial de la solicitud.
 *
 * CAMPAIGN:
 * Existe evidencia fuerte de Meta:
 * ctwa_clid o ad_id.
 *
 * DATABASE, REFERRAL y OTHER:
 * Clasificación manual u operativa.
 *
 * UNKNOWN:
 * Aún no se cuenta con una fuente confiable.
 */
export type LeadOrigin =
  "CAMPAIGN" | "DATABASE" | "REFERRAL" | "OTHER" | "UNKNOWN";

/**
 * Estado de procesamiento del webhook.
 */
export type WebhookProcessingStatus =
  "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED" | "IGNORED_DUPLICATE";

/**
 * Tipo de atribuciÃƒÂ³n.
 */
export type AttributionType = "FIRST" | "LAST";

/**
 * AtribuciÃƒÂ³n enviada actualmente por n8n.
 *
 * Se mantiene snake_case porque debe coincidir exactamente
 * con el contrato HTTP recibido por la API.
 */
export interface AttributionSnapshot {
  session_source: string;
  medium: string;
  url: string;
  ctwa_clid: string;
  ad_id: string;
  ad_name: string;
}

/**
 * InformaciÃƒÂ³n del contacto.
 *
 * Un contacto representa a una persona, no a una venta.
 */
export interface ContactSnapshot {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  primary_phone: string;
  secondary_phone: string;
  dni: string;
  customer_city: string;
  product: string;
  country: string;
  contact_type: string;
  tags: string;
}

/**
 * Asesor asignado en GHL.
 */
export interface OwnerSnapshot {
  external_id: string;
  name: string;
  email: string;
  phone: string;
}

/**
 * Fechas recibidas y calculadas en America/Lima.
 */
export interface SnapshotDates {
  created_at_utc: string;
  created_at_lima: string;
  lead_business_date: string;
  event_at_utc: string;
  event_at_lima: string;
  event_business_date: string;
  timezone: string;
}

/**
 * Campos comerciales comunes.
 *
 * Cada instancia corresponde a una sola lÃƒÂ­nea u operaciÃƒÂ³n.
 */
export interface CommercialCaseFields {
  carrier: string;
  commercial_operation: string;
  fixed_charge: number | "";

  /**
   * Opcional para mantener compatibilidad
   * con snapshots antiguos.
   */
  lead_origin?: LeadOrigin;

  management_status: string;
  follow_up_reason: string;
  lost_reason: string;
  activation_status: string;
  incident_reason: string;
  pipeline_stage: string;
  opportunity_status: string;
}

/**
 * Snapshot independiente del contacto.
 *
 * No contiene el estado de una venta especÃƒÂ­fica.
 */
export interface GhlContactSnapshotV2 {
  schema_version: "2.0";
  snapshot_type: "contact";

  external: {
    contact_id: string;
    location_id: string;
    location_name: string;
  };

  contact: ContactSnapshot;

  owner: OwnerSnapshot;

  attribution: {
    first: AttributionSnapshot;
    last: AttributionSnapshot;
  };

  dates: SnapshotDates;
}

/**
 * Snapshot de un caso comercial independiente.
 *
 * Un mismo contacto puede tener varios casos:
 * - dos portabilidades;
 * - una portabilidad y una lÃƒÂ­nea nueva;
 * - varias lÃƒÂ­neas nuevas.
 */
export interface GhlCommercialCaseSnapshotV2 {
  schema_version: "2.0";
  snapshot_type: "commercial_case";

  external: {
    contact_id: string;
    opportunity_id: string;
    location_id: string;
    location_name: string;
  };

  commercial_case: CommercialCaseFields & {
    /**
     * NÃƒÂºmero que serÃƒÂ¡ portado o identificador de la lÃƒÂ­nea.
     */
    service_number: string;

    /**
     * Permite agrupar varias operaciones contratadas juntas.
     */
    request_group_id: string;
  };

  owner: OwnerSnapshot;

  attribution?: {
    first: AttributionSnapshot;
    last: AttributionSnapshot;
  };

  dates: SnapshotDates;
}

/**
 * Contrato temporal correspondiente al snapshot combinado
 * que actualmente produce n8n.
 *
 * @deprecated SerÃƒÂ¡ reemplazado por GhlContactSnapshotV2 y
 * GhlCommercialCaseSnapshotV2 cuando GHL entregue opportunity_id.
 */
export interface LegacyGhlContactCommercialSnapshotV1 {
  schema_version: string;

  external: {
    contact_id: string;
    opportunity_id: string;
    location_id: string;
    location_name: string;
  };

  contact: ContactSnapshot;

  commercial: CommercialCaseFields;

  owner: OwnerSnapshot;

  attribution: {
    first: AttributionSnapshot;
    last: AttributionSnapshot;
  };

  dates: SnapshotDates;
}

/**
 * Contratos aceptados durante la migraciÃƒÂ³n.
 */
export type GhlIncomingSnapshot =
  | GhlContactSnapshotV2
  | GhlCommercialCaseSnapshotV2
  | LegacyGhlContactCommercialSnapshotV1;

/**
 * Origen reconocido de un webhook comercial.
 */
export type WebhookSource = "GHL_N8N";

/**
 * Sobre canÃ³nico enviado desde n8n hacia la API.
 *
 * event_id es la llave de idempotencia.
 * snapshot contiene el estado normalizado recibido.
 */
export interface GhlWebhookEnvelopeV1 {
  envelope_version: "1.0";
  source: "GHL_N8N";

  /**
   * Identificador Ãºnico y estable del evento.
   */
  event_id: string;

  /**
   * Tipo de evento procedente del sistema externo.
   *
   * Ejemplos:
   * - contact.created
   * - contact.updated
   * - opportunity.updated
   */
  event_type: string;

  /**
   * Instante real del evento en formato ISO 8601.
   */
  occurred_at: string;

  /**
   * FotografÃ­a normalizada del contacto o caso comercial.
   */
  snapshot: GhlIncomingSnapshot;
}

/**
 * Respuesta devuelta por la API al recibir el webhook.
 */
export interface WebhookIngestionResponse {
  accepted: true;
  duplicate: boolean;
  event_id: string;
  webhook_event_id: string;
  status: "RECEIVED" | "IGNORED_DUPLICATE";
}

/**
 * Producto identificado por la integración heredada de DITO.
 */
export type DitoProductType = "MOBILE" | "FIXED" | "UNKNOWN";

/**
 * Operación comercial identificada desde el resumen de DITO.
 */
export type DitoCommercialOperation =
  "NEW_LINE" | "PORT_PREPAID" | "PORT_POSTPAID" | "UNKNOWN";

/**
 * Operador cedente identificado desde el resumen de DITO.
 */
export type DitoCarrier =
  "BITEL" | "CLARO" | "ENTEL" | "MOVISTAR" | "OTHER" | "UNKNOWN";

/**
 * Nivel o modalidad de entrega informada por DITO.
 *
 * Los turnos regulares se asignarán posteriormente
 * dentro del Sistema Comercial.
 */
export type DitoDeliveryMethod =
  "EXPRESS" | "REGULAR_24H" | "REGULAR_48H" | "REGULAR_72H" | "UNKNOWN";

/**
 * Tipo de documento del titular.
 */
export type DitoDocumentType =
  "DNI" | "FOREIGNER_ID" | "RUC_10" | "OTHER" | "UNKNOWN";

/**
 * Orden estructurada por n8n a partir del resumen textual
 * enviado por la extensión heredada de DITO.
 *
 * Esta versión no contiene información de GHL.
 * La asociación con leads u oportunidades se realizará
 * posteriormente desde la bandeja del Sistema Comercial.
 */
export interface DitoLegacyOrderEnvelopeV1 {
  schema_version: "1.0";
  source: "DITO_EXTENSION_LEGACY";

  /**
   * Identificador idempotente del evento.
   *
   * Ejemplo:
   * dito:1941912820
   */
  event_id: string;

  /**
   * Momento ISO en que la extensión capturó la orden.
   */
  captured_at: string;

  product_type: DitoProductType;

  order: {
    /**
     * Código tal como fue exportado por la extensión.
     *
     * Ejemplo:
     * 1941912820A
     */
    code_raw: string;

    /**
     * Parte numérica normalizada.
     *
     * Ejemplo:
     * 1941912820
     */
    code_normalized: string;

    /**
     * Sufijo agregado por la extensión.
     *
     * Ejemplo:
     * A
     */
    code_suffix: string;

    /**
     * Texto original de la operación.
     *
     * Ejemplo:
     * PORTA ENTEL PRE 39.9
     */
    operation_raw: string;

    commercial_operation: DitoCommercialOperation;

    carrier: DitoCarrier;

    /**
     * Cargo fijo individual del servicio.
     */
    fixed_charge: number | null;

    /**
     * Campos que serán capturados en una versión posterior
     * de la extensión.
     */
    sales_code: string | null;
    billing_cycle_day: number | null;
    payment_due_day: number | null;
  };

  holder: {
    full_name: string;
    document_type: DitoDocumentType;
    document_number: string;

    /**
     * Número de la línea registrada o número de contacto
     * recibido desde la extensión heredada.
     */
    service_number: string;
  };

  delivery: {
    method: DitoDeliveryMethod;
    department: string;
    province: string;
    district: string;
    contact_phone?: string | null;
    time_range?: string | null;
    address?: string | null;
    reference?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };

  agent: {
    /**
     * Nombre recibido literalmente desde la extensión.
     *
     * Posteriormente será normalizado y asociado
     * con un usuario interno.
     */
    name_raw: string;
  };

  /**
   * Resumen completo original para auditoría.
   */
  raw_summary: string;

  /**
   * Metadatos adicionales que no forman parte
   * del contrato principal.
   */
  additional_details: Record<string, unknown>;
}

/**
 * Envelope emitido por la extensión DITO con identidad del remitente.
 *
 * El correo corporativo identifica al asesor dentro de la organización.
 * installation_id permite detectar una instalación reutilizada con otra
 * identidad. agent.name_raw continúa siendo evidencia literal de DITO.
 */
export interface DitoExtensionOrderEnvelopeV2
  extends Omit<DitoLegacyOrderEnvelopeV1, "schema_version" | "source"> {
  schema_version: "2.0";
  source: "DITO_EXTENSION";

  submitted_by: {
    installation_id: string;
    email: string;
  };
}

export type DitoIncomingOrderEnvelope =
  | DitoLegacyOrderEnvelopeV1
  | DitoExtensionOrderEnvelopeV2;

/**
 * Respuesta de la API al recibir una orden DITO.
 */
export interface DitoOrderIngestionResponse {
  accepted: true;
  duplicate: boolean;

  event_id: string;
  dito_order_id: string;

  status: "RECEIVED" | "IGNORED_DUPLICATE";
}

export interface DitoOrderIngestionResponse {
  accepted: true;
  duplicate: boolean;

  event_id: string;
  dito_order_id: string;

  status: "RECEIVED" | "IGNORED_DUPLICATE";
}
