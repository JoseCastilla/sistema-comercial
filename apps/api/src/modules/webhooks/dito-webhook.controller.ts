import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import type { DitoOrderIngestionResponse } from '@repo/contracts';

import { DitoWebhookService } from './dito-webhook.service';

@Controller('webhooks')
export class DitoWebhookController {
  constructor(private readonly ditoWebhookService: DitoWebhookService) {}

  @Post('dito')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(
    @Body() body: unknown,

    @Headers('x-webhook-secret')
    webhookSecret: string | undefined,
  ): Promise<DitoOrderIngestionResponse> {
    return this.ditoWebhookService.ingest(body, webhookSecret);
  }
}
