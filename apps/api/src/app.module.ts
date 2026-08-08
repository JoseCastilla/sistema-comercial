import { Module } from '@nestjs/common';

import { DatabaseModule } from './modules/database/database.module';
import { DitoImportModule } from './modules/dito-import/dito-import.module';
import { HealthModule } from './modules/health/health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [DatabaseModule, DitoImportModule, HealthModule, WebhooksModule],
})
export class AppModule {}
