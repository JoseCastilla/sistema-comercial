import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { RecoveryBaseController } from './recovery-base.controller';
import { RecoveryBaseConfirmationService } from './recovery-base-confirmation.service';
import { RecoveryBaseInternalAuthService } from './recovery-base-internal-auth.service';
import { RecoveryBasePreviewService } from './recovery-base-preview.service';
import { RecoveryPortabilityService } from './recovery-portability.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RecoveryBaseController],
  providers: [
    RecoveryBaseInternalAuthService,
    RecoveryBasePreviewService,
    RecoveryBaseConfirmationService,
    RecoveryPortabilityService,
  ],
})
export class RecoveryBaseModule {}
