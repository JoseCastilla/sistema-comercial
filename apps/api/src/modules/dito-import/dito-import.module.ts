import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { DitoImportController } from './dito-import.controller';
import { DitoImportConfirmationService } from './dito-import-confirmation.service';
import { DitoImportInternalAuthService } from './dito-import-internal-auth.service';
import { DitoImportPreviewService } from './dito-import-preview.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DitoImportController],
  providers: [
    DitoImportInternalAuthService,
    DitoImportPreviewService,
    DitoImportConfirmationService,
  ],
  exports: [DitoImportPreviewService],
})
export class DitoImportModule {}
