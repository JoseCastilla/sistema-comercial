import { BadRequestException, Injectable } from '@nestjs/common';

import type { DitoIncomingOrderEnvelope } from '@repo/contracts';

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

interface ValidationSuccess {
  success: true;
  data: DitoIncomingOrderEnvelope;
}

interface ValidationFailure {
  success: false;

  error: {
    issues: ValidationIssue[];
  };
}

type ValidationResult = ValidationSuccess | ValidationFailure;

interface ValidationPackage {
  safeParseDitoIncomingOrderEnvelope(value: unknown): ValidationResult;
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
export class DitoWebhookValidationService {
  async parse(value: unknown): Promise<DitoIncomingOrderEnvelope> {
    const validationPackage = await loadValidationPackage();

    const result = validationPackage.safeParseDitoIncomingOrderEnvelope(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      message: 'Payload de orden DITO inválido',

      errors: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),

        message: issue.message,
      })),
    });
  }
}
