export type HealthStatus = 'ok' | 'error';

export type DependencyHealthStatus = 'up' | 'down';

export interface HealthMetadata {
  service: 'sistema-comercial-api';
  version: string;
  businessTimezone: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface LivenessHealthResponse extends HealthMetadata {
  status: 'ok';
}

export interface ReadinessHealthResponse extends HealthMetadata {
  status: HealthStatus;

  checks: {
    database: {
      status: DependencyHealthStatus;
      latencyMs: number | null;
    };
  };
}

/**
 * Alias conservado para compatibilidad con el endpoint
 * original GET /api/v1/health.
 */
export type HealthResponse = ReadinessHealthResponse;
