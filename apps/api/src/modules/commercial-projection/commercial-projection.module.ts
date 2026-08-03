import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { GhlCommercialProjectionRepository } from './ghl-commercial-projection.repository';

import { GhlCommercialProjectionService } from './ghl-commercial-projection.service';

@Module({
  imports: [DatabaseModule],

  providers: [
    GhlCommercialProjectionRepository,
    GhlCommercialProjectionService,
  ],

  exports: [GhlCommercialProjectionService],
})
export class CommercialProjectionModule {}
