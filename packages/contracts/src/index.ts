/**
 * Roles disponibles dentro de una organizaciÃ³n.
 *
 * AGENT representa al asesor comercial.
 * En la interfaz podrÃ¡ mostrarse como "Asesor".
 */
export type OrganizationRole =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'AGENT'
  | 'BACKOFFICE';

/**
 * Operador del cual proviene el cliente.
 */
export type Carrier =
  | 'BITEL'
  | 'CLARO'
  | 'ENTEL'
  | 'MOVISTAR'
  | 'OTHER';

/**
 * OperaciÃ³n comercial solicitada.
 */
export type CommercialOperation =
  | 'NEW_LINE'
  | 'PORT_PREPAID'
  | 'PORT_POSTPAID';

/**
 * Estado principal de cada caso comercial.
 */
export type ManagementStatus =
  | 'QUALIFIED'
  | 'FOLLOW_UP'
  | 'ORDER_ENTERED'
  | 'CHIP_DELIVERED'
  | 'SALE_CONFIRMED'
  | 'LOST';

/**
 * Estado tÃ©cnico de activaciÃ³n.
 */
export type ActivationStatus =
  | 'PENDING'
  | 'INCIDENT'
  | 'ACTIVATED';

/**
 * Motivo de seguimiento.
 */
export type FollowUpReason =
  | 'SCHEDULED'
  | 'ACTIVE_DEBT'
  | 'LESS_THAN_30_DAYS'
  | 'MEETING_POINT';

/**
 * Motivo de pÃ©rdida.
 */
export type LostReason =
  | 'CURRENT_MOVISTAR_CUSTOMER'
  | 'OUT_OF_COVERAGE'
  | 'ZERO_FIXED_CHARGE'
  | 'FOREIGNER_ID'
  | 'DEVICE_INSTALLMENTS'
  | 'NO_LONGER_INTERESTED'
  | 'PORTED_OTHER_AGENCY'
  | 'PORTED_OTHER_OPERATOR'
  | 'RUC_10';

/**
 * Estado de procesamiento del webhook.
 */
export type WebhookProcessingStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'IGNORED_DUPLICATE';

/**
 * Tipo de atribuciÃ³n.
 */
export type AttributionType =
  | 'FIRST'
  | 'LAST';

/**
 * AtribuciÃ³n enviada actualmente por n8n.
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
 * InformaciÃ³n del contacto.
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
 * Cada instancia corresponde a una sola lÃ­nea u operaciÃ³n.
 */
export interface CommercialCaseFields {
  carrier: string;
  commercial_operation: string;
  fixed_charge: number | '';
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
 * No contiene el estado de una venta especÃ­fica.
 */
export interface GhlContactSnapshotV2 {
  schema_version: '2.0';
  snapshot_type: 'contact';

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
 * - una portabilidad y una lÃ­nea nueva;
 * - varias lÃ­neas nuevas.
 */
export interface GhlCommercialCaseSnapshotV2 {
  schema_version: '2.0';
  snapshot_type: 'commercial_case';

  external: {
    contact_id: string;
    opportunity_id: string;
    location_id: string;
    location_name: string;
  };

  commercial_case: CommercialCaseFields & {
    /**
     * NÃºmero que serÃ¡ portado o identificador de la lÃ­nea.
     */
    service_number: string;

    /**
     * Permite agrupar varias operaciones contratadas juntas.
     */
    request_group_id: string;
  };

  owner: OwnerSnapshot;

  dates: SnapshotDates;
}

/**
 * Contrato temporal correspondiente al snapshot combinado
 * que actualmente produce n8n.
 *
 * @deprecated SerÃ¡ reemplazado por GhlContactSnapshotV2 y
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
 * Contratos aceptados durante la migraciÃ³n.
 */
export type GhlIncomingSnapshot =
  | GhlContactSnapshotV2
  | GhlCommercialCaseSnapshotV2
  | LegacyGhlContactCommercialSnapshotV1;

/**
 * Origen reconocido de un webhook comercial.
 */
export type WebhookSource =
  | 'GHL_N8N';

/**
 * Sobre canónico enviado desde n8n hacia la API.
 *
 * event_id es la llave de idempotencia.
 * snapshot contiene el estado normalizado recibido.
 */
export interface GhlWebhookEnvelopeV1 {
  envelope_version: '1.0';
  source: 'GHL_N8N';

  /**
   * Identificador único y estable del evento.
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
   * Fotografía normalizada del contacto o caso comercial.
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
  status:
    | 'RECEIVED'
    | 'IGNORED_DUPLICATE';
}
