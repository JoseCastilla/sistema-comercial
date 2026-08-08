import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import {
  DitoImportInternalAuthService,
  signDitoImportRequest,
} from './dito-import-internal-auth.service';

const secret = 'test-dito-import-secret-with-enough-entropy';
const timestamp = '1786021200';
const authorization = {
  organizationId: 'organization-1',
  actorUserId: 'admin-1',
  timestamp,
  resourceFingerprint: 'a'.repeat(64),
};

describe('DitoImportInternalAuthService', () => {
  const originalSecret = process.env.DITO_IMPORT_INTERNAL_SECRET;
  let findMembership: jest.Mock<Promise<{ userId: string } | null>, [unknown]>;
  let service: DitoImportInternalAuthService;

  beforeAll(() => {
    process.env.DITO_IMPORT_INTERNAL_SECRET = secret;
    jest.spyOn(Date, 'now').mockReturnValue(Number(timestamp) * 1000);
  });

  afterAll(() => {
    jest.restoreAllMocks();

    if (originalSecret === undefined) {
      delete process.env.DITO_IMPORT_INTERNAL_SECRET;
    } else {
      process.env.DITO_IMPORT_INTERNAL_SECRET = originalSecret;
    }
  });

  beforeEach(() => {
    findMembership = jest
      .fn<Promise<{ userId: string } | null>, [unknown]>()
      .mockResolvedValue({ userId: 'admin-1' });
    service = new DitoImportInternalAuthService({
      getClient: () => ({
        organizationMember: { findFirst: findMembership },
      }),
    } as unknown as DatabaseService);
  });

  it('accepts a current signed request from an active organization admin', async () => {
    await expect(
      service.authorize({
        ...authorization,
        signature: signDitoImportRequest(authorization, secret),
      }),
    ).resolves.toBeUndefined();

    expect(findMembership).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization-1',
        userId: 'admin-1',
        role: 'ADMIN',
        organization: { status: 'ACTIVE' },
        user: { status: 'ACTIVE' },
      },
      select: { userId: true },
    });
  });

  it('rejects expired requests before querying membership', async () => {
    const expired = { ...authorization, timestamp: '1786020000' };

    await expect(
      service.authorize({
        ...expired,
        signature: signDitoImportRequest(expired, secret),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findMembership).not.toHaveBeenCalled();
  });

  it('rejects a signature generated for a different resource', async () => {
    await expect(
      service.authorize({
        ...authorization,
        signature: signDitoImportRequest(
          { ...authorization, resourceFingerprint: 'b'.repeat(64) },
          secret,
        ),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findMembership).not.toHaveBeenCalled();
  });

  it('rejects a signed request when the actor is not an active admin', async () => {
    findMembership.mockResolvedValue(null);

    await expect(
      service.authorize({
        ...authorization,
        signature: signDitoImportRequest(authorization, secret),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
