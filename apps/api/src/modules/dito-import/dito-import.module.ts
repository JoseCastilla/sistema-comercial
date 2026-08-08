import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { DitoImportController } from './dito-import.controller';
import { DitoImportInternalAuthService } from './dito-import-internal-auth.service';
import { DitoImportPreviewService } from './dito-import-preview.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DitoImportController],
  providers: [DitoImportInternalAuthService, DitoImportPreviewService],
  exports: [DitoImportPreviewService],
})
export class DitoImportModule {}
