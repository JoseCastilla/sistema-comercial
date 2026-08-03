import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { DitoWebhookController } from './dito-webhook.controller';
import { DitoWebhookService } from './dito-webhook.service';
import { DitoWebhookValidationService } from './dito-webhook-validation.service';
import { DitoOrdersRepository } from './dito-orders.repository';

import { GhlWebhookController } from './ghl-webhook.controller';
import { GhlWebhookService } from './ghl-webhook.service';
import { WebhookEventsRepository } from './webhook-events.repository';
import { WebhookValidationService } from './webhook-validation.service';

@Module({
  imports: [DatabaseModule],

  controllers: [GhlWebhookController, DitoWebhookController],

  providers: [
    GhlWebhookService,
    WebhookEventsRepository,
    WebhookValidationService,

    DitoWebhookService,
    DitoOrdersRepository,
    DitoWebhookValidationService,
  ],

  exports: [GhlWebhookService, DitoWebhookService],
})
export class WebhooksModule {}
