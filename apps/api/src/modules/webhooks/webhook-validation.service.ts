import { BadRequestException, Injectable } from '@nestjs/common';

import type { GhlWebhookEnvelopeV1 } from '@repo/contracts';

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

interface ValidationSuccess {
  success: true;
  data: GhlWebhookEnvelopeV1;
}

interface ValidationFailure {
  success: false;

  error: {
    issues: ValidationIssue[];
  };
}

type ValidationResult = ValidationSuccess | ValidationFailure;

interface ValidationPackage {
  safeParseGhlWebhookEnvelope(value: unknown): ValidationResult;
}

const validationPackageName = '@repo/validation';

let validationPackagePromise: Promise<ValidationPackage> | undefined;

async function loadValidationPackage(): Promise<ValidationPackage> {
  validationPackagePromise ??= import(
    validationPackageName
  ) as Promise<ValidationPackage>;

  return validationPackagePromise;
}

@Injectable()
export class WebhookValidationService {
  async parse(value: unknown): Promise<GhlWebhookEnvelopeV1> {
    const validationPackage = await loadValidationPackage();

    const result = validationPackage.safeParseGhlWebhookEnvelope(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      message: 'Payload de webhook inválido',

      errors: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),

        message: issue.message,
      })),
    });
  }
}
