import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import type {
  HealthMetadata,
  LivenessHealthResponse,
  ReadinessHealthResponse,
} from './health.types';

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  getLiveness(): LivenessHealthResponse {
    return {
      status: 'ok',
      ...this.getMetadata(),
    };
  }

  async getReadiness(): Promise<ReadinessHealthResponse> {
    const metadata = this.getMetadata();

    try {
      const latencyMs = await this.databaseService.ping();

      return {
        status: 'ok',
        ...metadata,

        checks: {
          database: {
            status: 'up',
            latencyMs,
          },
        },
      };
    } catch {
      return {
        status: 'error',
        ...metadata,

        checks: {
          database: {
            status: 'down',
            latencyMs: null,
          },
        },
      };
    }
  }

  private getMetadata(): HealthMetadata {
    return {
      service: 'sistema-comercial-api',
      version: process.env.APP_VERSION ?? '0.1.0',
      businessTimezone: process.env.BUSINESS_TIMEZONE ?? 'America/Lima',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
