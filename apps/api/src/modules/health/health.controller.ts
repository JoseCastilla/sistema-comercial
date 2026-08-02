import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service';
import type {
  LivenessHealthResponse,
  ReadinessHealthResponse,
} from './health.types';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Alias de readiness para mantener compatibilidad.
   */
  @Get()
  async getHealth(): Promise<ReadinessHealthResponse> {
    return this.resolveReadiness();
  }

  /**
   * Confirma únicamente que el proceso está vivo.
   */
  @Get('live')
  getLiveness(): LivenessHealthResponse {
    return this.healthService.getLiveness();
  }

  /**
   * Confirma que la API y PostgreSQL están disponibles.
   */
  @Get('ready')
  async getReadiness(): Promise<ReadinessHealthResponse> {
    return this.resolveReadiness();
  }

  private async resolveReadiness(): Promise<ReadinessHealthResponse> {
    const response = await this.healthService.getReadiness();

    if (response.status === 'error') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
