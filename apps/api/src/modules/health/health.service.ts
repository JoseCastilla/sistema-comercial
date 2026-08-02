import { Injectable } from '@nestjs/common';

import type { HealthResponse } from './health.types';

@Injectable()
export class HealthService {
  getStatus(): HealthResponse {
    return {
      status: 'ok',
      service: 'sistema-comercial-api',
      version: process.env.APP_VERSION ?? '0.1.0',
      businessTimezone: process.env.BUSINESS_TIMEZONE ?? 'America/Lima',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
