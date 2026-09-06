import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { timingSafeEqual } from 'node:crypto';

import { GhlWebhookService } from './ghl-webhook.service';

import type { WebhookRetrySummary } from './ghl-webhook.service';

/**
 * SPEC-046 BR-003: los eventos de webhook que fallaron al proyectarse se
 * reintentan desde el worker, no desde un render ni a mano. La ruta es
 * interna: exige el secreto compartido con el worker y no expone nada más
 * que el resumen del reintento.
 */
@Controller('internal/maintenance')
export class MaintenanceController {
  constructor(private readonly webhookService: GhlWebhookService) {}

  @Post('webhooks-retry')
  @HttpCode(HttpStatus.OK)
  async retryWebhooks(
    @Headers('x-maintenance-secret')
    secret: string | undefined,
  ): Promise<WebhookRetrySummary> {
    this.assertSecret(secret);

    return this.webhookService.retryFailed();
  }

  private assertSecret(provided: string | undefined): void {
    const expected = process.env.MAINTENANCE_INTERNAL_SECRET?.trim();

    if (!expected) {
      throw new ServiceUnavailableException(
        'MAINTENANCE_INTERNAL_SECRET no está configurado',
      );
    }

    const providedBuffer = Buffer.from(provided ?? '', 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Mantenimiento no autorizado');
    }
  }
}
