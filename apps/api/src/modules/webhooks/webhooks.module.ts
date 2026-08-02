import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { GhlWebhookController } from './ghl-webhook.controller';
import { GhlWebhookService } from './ghl-webhook.service';
import { WebhookEventsRepository } from './webhook-events.repository';
import { WebhookValidationService } from './webhook-validation.service';

@Module({
  imports: [DatabaseModule],

  controllers: [GhlWebhookController],

  providers: [
    GhlWebhookService,
    WebhookEventsRepository,
    WebhookValidationService,
  ],

  exports: [GhlWebhookService],
})
export class WebhooksModule {}
