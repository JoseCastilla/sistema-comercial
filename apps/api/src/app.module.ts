import { Module } from '@nestjs/common';

import { DatabaseModule } from './modules/database/database.module';
import { DitoImportModule } from './modules/dito-import/dito-import.module';
import { HealthModule } from './modules/health/health.module';
import { RecoveryBaseModule } from './modules/recovery-base/recovery-base.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    DatabaseModule,
    DitoImportModule,
    HealthModule,
    RecoveryBaseModule,
    WebhooksModule,
  ],
})
export class AppModule {}
