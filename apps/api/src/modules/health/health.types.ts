export interface HealthResponse {
  status: 'ok';
  service: 'sistema-comercial-api';
  version: string;
  businessTimezone: string;
  timestamp: string;
  uptimeSeconds: number;
}
