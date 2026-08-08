import { createHash } from 'node:crypto';

import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { DitoImportInternalAuthService } from './dito-import-internal-auth.service';
import { DitoImportPreviewService } from './dito-import-preview.service';

interface UploadedWorkbook {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Controller('internal/dito-import')
export class DitoImportController {
  constructor(
    private readonly internalAuth: DitoImportInternalAuthService,
    private readonly previewService: DitoImportPreviewService,
  ) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    }),
  )
  async createPreview(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Headers('x-dito-organization-id') organizationId?: string,
    @Headers('x-dito-actor-user-id') actorUserId?: string,
    @Headers('x-dito-timestamp') timestamp?: string,
    @Headers('x-dito-signature') signature?: string,
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
}
