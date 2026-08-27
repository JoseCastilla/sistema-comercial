import { createHash } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { RecoveryBaseConfirmationService } from './recovery-base-confirmation.service';
import { RecoveryBaseInternalAuthService } from './recovery-base-internal-auth.service';
import { RecoveryBasePreviewService } from './recovery-base-preview.service';
import { RecoveryPortabilityService } from './recovery-portability.service';

interface UploadedWorkbook {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Controller('internal/recovery-base')
export class RecoveryBaseController {
  constructor(
    private readonly internalAuth: RecoveryBaseInternalAuthService,
    private readonly previewService: RecoveryBasePreviewService,
    private readonly confirmationService: RecoveryBaseConfirmationService,
    private readonly portabilityService: RecoveryPortabilityService,
  ) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 25 * 1024 * 1024 },
    }),
  )
  async createPreview(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Headers('x-recovery-organization-id') organizationId?: string,
    @Headers('x-recovery-actor-user-id') actorUserId?: string,
    @Headers('x-recovery-timestamp') timestamp?: string,
    @Headers('x-recovery-signature') signature?: string,
  ) {
    if (!file) throw new BadRequestException('Debes adjuntar un archivo XLSX.');

    if (!organizationId || !actorUserId || !timestamp || !signature) {
      throw new BadRequestException(
        'Faltan credenciales internas de la carga.',
      );
    }

    const resourceFingerprint = createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    await this.internalAuth.authorize({
      organizationId,
      actorUserId,
      timestamp,
      signature,
      resourceFingerprint,
    });

    return this.previewService.createPreview({
      organizationId,
      actorUserId,
      fileName: file.originalname,
      workbook: file.buffer,
    });
  }

  @Post(':batchId/confirm')
  async confirmBatch(
    @Param('batchId') batchId: string,
    @Body() body: { expectedUpdatedAt?: string },
    @Headers('x-recovery-organization-id') organizationId?: string,
    @Headers('x-recovery-actor-user-id') actorUserId?: string,
    @Headers('x-recovery-timestamp') timestamp?: string,
    @Headers('x-recovery-signature') signature?: string,
  ) {
    if (!organizationId || !actorUserId || !timestamp || !signature) {
      throw new BadRequestException(
        'Faltan credenciales internas de la confirmación.',
      );
    }

    const expectedUpdatedAt = body.expectedUpdatedAt
      ? new Date(body.expectedUpdatedAt)
      : null;

    if (!expectedUpdatedAt || Number.isNaN(expectedUpdatedAt.getTime())) {
      throw new BadRequestException('La versión del lote no es válida.');
    }

    const resourceFingerprint = createHash('sha256')
      .update(batchId)
      .digest('hex');

    await this.internalAuth.authorize({
      organizationId,
      actorUserId,
      timestamp,
      signature,
      resourceFingerprint,
    });

    return this.confirmationService.confirm({
      organizationId,
      actorUserId,
      batchId,
      expectedUpdatedAt,
    });
  }

  @Post('portability')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 30 * 1024 * 1024 },
    }),
  )
  async applyPortability(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Body() body: { quickColumn?: string },
    @Headers('x-recovery-organization-id') organizationId?: string,
    @Headers('x-recovery-actor-user-id') actorUserId?: string,
    @Headers('x-recovery-timestamp') timestamp?: string,
    @Headers('x-recovery-signature') signature?: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar el reporte de portabilidad.',
      );
    }

    if (!organizationId || !actorUserId || !timestamp || !signature) {
      throw new BadRequestException('Faltan credenciales internas del cruce.');
    }

    const resourceFingerprint = createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    await this.internalAuth.authorize({
      organizationId,
      actorUserId,
      timestamp,
      signature,
      resourceFingerprint,
    });

    return this.portabilityService.apply({
      organizationId,
      actorUserId,
      fileName: file.originalname,
      report: file.buffer,
      quickColumn: body?.quickColumn ?? null,
    });
  }
}
