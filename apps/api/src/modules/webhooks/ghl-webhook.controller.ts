import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import type { WebhookIngestionResponse } from '@repo/contracts';

import { GhlWebhookService } from './ghl-webhook.service';

@Controller('webhooks')
export class GhlWebhookController {
  constructor(private readonly webhookService: GhlWebhookService) {}

  @Post('ghl')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(
    @Body() body: unknown,

    @Headers('x-webhook-secret')
    webhookSecret: string | undefined,
  ): Promise<WebhookIngestionResponse> {
    return this.webhookService.ingest(body, webhookSecret);
  }
}
