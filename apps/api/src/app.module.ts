import { Module } from '@nestjs/common';

import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { RecoveryBaseModule } from './modules/recovery-base/recovery-base.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [DatabaseModule, HealthModule, RecoveryBaseModule, WebhooksModule],
})
export class AppModule {}
