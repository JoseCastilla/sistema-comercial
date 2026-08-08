import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export interface DitoImportInternalAuthorization {
  organizationId: string;
  actorUserId: string;
  timestamp: string;
  signature: string;
  resourceFingerprint: string;
}

const maximumClockSkewSeconds = 5 * 60;
const localDevelopmentSecret =
  'local-only-dito-import-secret-change-before-production';

@Injectable()
export class DitoImportInternalAuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async authorize(input: DitoImportInternalAuthorization): Promise<void> {
    const timestamp = Number(input.timestamp);
    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isInteger(timestamp) ||
      Math.abs(now - timestamp) > maximumClockSkewSeconds
    ) {
      throw new UnauthorizedException('La solicitud interna expiró.');
    }

    const expected = signDitoImportRequest(
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        timestamp: input.timestamp,
        resourceFingerprint: input.resourceFingerprint,
      },
      getInternalSecret(),
    );

    if (!safeEqual(expected, input.signature)) {
      throw new UnauthorizedException('Firma interna inválida.');
    }

    const membership = await this.databaseService
      .getClient()
      .organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          role: 'ADMIN',
          organization: { status: 'ACTIVE' },
          user: { status: 'ACTIVE' },
        },
        select: { userId: true },
      });

    if (!membership) {
      throw new ForbiddenException(
        'El usuario no tiene acceso administrativo a la organización.',
      );
    }
  }
}

export function signDitoImportRequest(
  input: {
    organizationId: string;
    actorUserId: string;
    timestamp: string;
    resourceFingerprint: string;
  },
  secret: string,
): string {
  const payload = [
    input.timestamp,
    input.organizationId,
    input.actorUserId,
    input.resourceFingerprint,
  ].join('\n');

  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function getInternalSecret(): string {
  const configured = process.env.DITO_IMPORT_INTERNAL_SECRET?.trim();

  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return localDevelopmentSecret;

  throw new Error('DITO_IMPORT_INTERNAL_SECRET no está configurado.');
}

function safeEqual(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
