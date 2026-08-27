export type RecoveryRecordClassification = "ELIGIBLE" | "EXCLUDED" | "INVALID";

export type RecoveryRecordIssueCode =
  | "MISSING_DOCUMENT"
  | "MISSING_SERVICE_NUMBER"
  | "INVALID_REGISTERED_AT"
  | "UNKNOWN_CARRIER"
  | "MODALITY_NOT_ALLOWED"
  | "PLAN_NOT_ALLOWED"
  | "EQUIPMENT_NOT_ALLOWED";

export interface RecoveryEligibilityConfigInput {
  modalities: string[];
  planNames: string[];
  equipmentNames: string[];
  carrierNames: string[];
}

/**
 * Configuración inicial de SPEC-030 (BR-011): postpago, planes Máximo de
 * S/39.9 a S/79.9 y solo Simcard.
 *
 * El catálogo de cedentes contiene los valores **tal como los emite la base**,
 * porque es contra ellos que se valida cada fila (BR-015). La fuente nombra a
 * tres operadores y usa el código `27` para Guinea Mobile S.A.C.; agregar
 * además el alias `GUINEA` duplicaría al mismo operador con una entrada que
 * la base nunca emite.
 */
export const defaultRecoveryEligibilityConfig: RecoveryEligibilityConfigInput =
  {
    modalities: ["POST"],
    planNames: [
      "Abierto Movistar Libre Plan Movistar Maximo S/39.9",
      "Abierto Movistar Libre Plan Movistar Maximo S/49.9",
      "Abierto Movistar Libre Plan Movistar Maximo S/59.9",
      "Abierto Movistar Libre Plan Movistar Maximo S/79.9",
    ],
    equipmentNames: ["Simcard"],
    carrierNames: ["CLARO", "ENTEL", "BITEL", "27"],
  };

function digitsOf(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value).trim();

  if (text.endsWith(".0")) {
    text = text.slice(0, -2);
  }

  return text.replace(/\D+/g, "");
}

/**
 * Normaliza el documento a la llave de identidad del caso (BR-006), con la
 * misma regla del consolidado actual: solo dígitos, relleno a ocho ceros.
 */
export function normalizeRecoveryDocumentNumber(
  value: unknown,
): string | null {
  const digits = digitsOf(value);

  if (digits.length === 0 || digits.length > 15) {
    return null;
  }

  return digits.padStart(8, "0");
}

/**
 * Normaliza un teléfono peruano a nueve dígitos (BR-007): retira el prefijo
 * `51` y los artefactos numéricos de la exportación.
 */
export function normalizeRecoveryPhoneNumber(value: unknown): string | null {
  let digits = digitsOf(value);

  if (digits.length === 11 && digits.startsWith("51")) {
    digits = digits.slice(-9);
  }

  if (digits.length < 6 || digits.length > 15) {
    return null;
  }

  return digits;
}

export function normalizeRecoveryComparableText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export interface RecoveryEligibilityRowInput {
  documentNumber: string | null;
  serviceNumber: string | null;
  registeredAt: Date | null;
  modalityRaw: string | null;
  planRaw: string | null;
  equipmentRaw: string | null;
  carrierRaw: string | null;
}

export interface RecoveryEligibilityResult {
  classification: RecoveryRecordClassification;
  issueCodes: RecoveryRecordIssueCode[];
}

/**
 * Evalúa una fila contra la configuración vigente (BR-010 a BR-015). La
 * invalidez estructural manda sobre la exclusión por filtros: una fila sin
 * identidad nunca genera caso aunque su plan sea elegible.
 */
export function evaluateRecoveryEligibility(
  row: RecoveryEligibilityRowInput,
  config: RecoveryEligibilityConfigInput,
): RecoveryEligibilityResult {
  const invalid: RecoveryRecordIssueCode[] = [];

  if (!row.documentNumber) {
    invalid.push("MISSING_DOCUMENT");
  }

  if (!row.serviceNumber) {
    invalid.push("MISSING_SERVICE_NUMBER");
  }

  if (!row.registeredAt || Number.isNaN(row.registeredAt.getTime())) {
    invalid.push("INVALID_REGISTERED_AT");
  }

  const carrierCatalog = config.carrierNames.map(
    normalizeRecoveryComparableText,
  );

  if (
    !row.carrierRaw ||
    !carrierCatalog.includes(normalizeRecoveryComparableText(row.carrierRaw))
  ) {
    invalid.push("UNKNOWN_CARRIER");
  }

  if (invalid.length > 0) {
    return { classification: "INVALID", issueCodes: invalid };
  }

  const excluded: RecoveryRecordIssueCode[] = [];

  const modalityCatalog = config.modalities.map(
    normalizeRecoveryComparableText,
  );

  if (
    !modalityCatalog.includes(normalizeRecoveryComparableText(row.modalityRaw))
  ) {
    excluded.push("MODALITY_NOT_ALLOWED");
  }

  const planCatalog = config.planNames.map(normalizeRecoveryComparableText);

  if (!planCatalog.includes(normalizeRecoveryComparableText(row.planRaw))) {
    excluded.push("PLAN_NOT_ALLOWED");
  }

  const equipmentCatalog = config.equipmentNames.map(
    normalizeRecoveryComparableText,
  );

  if (
    !equipmentCatalog.includes(
      normalizeRecoveryComparableText(row.equipmentRaw),
    )
  ) {
    excluded.push("EQUIPMENT_NOT_ALLOWED");
  }

  if (excluded.length > 0) {
    return { classification: "EXCLUDED", issueCodes: excluded };
  }

  return { classification: "ELIGIBLE", issueCodes: [] };
}

export interface RecoveryGroupableRecord {
  recordId: string;
  documentNumber: string;
  serviceNumber: string;
  contactPhone: string | null;
  holderName: string | null;
  registeredAt: Date;
  modalityRaw: string | null;
  planRaw: string | null;
  equipmentRaw: string | null;
  carrierRaw: string | null;
  requiresIdentityValidation: boolean;
}

export interface RecoveryClientServiceGroup {
  serviceNumber: string;
  modalityRaw: string | null;
  planRaw: string | null;
  equipmentRaw: string | null;
  carrierRaw: string | null;
  firstRegisteredAt: Date;
  lastRegisteredAt: Date;
  sightings: { registeredAt: Date }[];
}

export interface RecoveryClientGroup {
  documentNumber: string;
  holderName: string;
  requiresIdentityValidation: boolean;
  firstRegisteredAt: Date;
  lastRegisteredAt: Date;
  recordIds: string[];
  services: RecoveryClientServiceGroup[];
  contactPhones: string[];
}

/**
 * Agrupa las filas elegibles por cliente (BR-006/BR-007): un caso por
 * documento, con sus servicios a portar y sus teléfonos de contacto. Los
 * teléfonos iguales al número de servicio no se duplican como contacto.
 */
export function groupRecoveryRecordsByClient(
  records: RecoveryGroupableRecord[],
): RecoveryClientGroup[] {
  const groups = new Map<string, RecoveryClientGroup>();

  for (const record of records) {
    let group = groups.get(record.documentNumber);

    if (!group) {
      group = {
        documentNumber: record.documentNumber,
        holderName: record.holderName ?? "",
        requiresIdentityValidation: false,
        firstRegisteredAt: record.registeredAt,
        lastRegisteredAt: record.registeredAt,
        recordIds: [],
        services: [],
        contactPhones: [],
      };
      groups.set(record.documentNumber, group);
    }

    group.recordIds.push(record.recordId);

    if (!group.holderName && record.holderName) {
      group.holderName = record.holderName;
    }

    if (record.requiresIdentityValidation) {
      group.requiresIdentityValidation = true;
    }

    if (record.registeredAt < group.firstRegisteredAt) {
      group.firstRegisteredAt = record.registeredAt;
    }

    if (record.registeredAt > group.lastRegisteredAt) {
      group.lastRegisteredAt = record.registeredAt;
    }

    let service = group.services.find(
      (candidate) => candidate.serviceNumber === record.serviceNumber,
    );

    if (!service) {
      service = {
        serviceNumber: record.serviceNumber,
        modalityRaw: record.modalityRaw,
        planRaw: record.planRaw,
        equipmentRaw: record.equipmentRaw,
        carrierRaw: record.carrierRaw,
        firstRegisteredAt: record.registeredAt,
        lastRegisteredAt: record.registeredAt,
        sightings: [],
      };
      group.services.push(service);
    }

    if (record.registeredAt < service.firstRegisteredAt) {
      service.firstRegisteredAt = record.registeredAt;
    }

    if (record.registeredAt > service.lastRegisteredAt) {
      service.lastRegisteredAt = record.registeredAt;
      service.modalityRaw = record.modalityRaw;
      service.planRaw = record.planRaw;
      service.equipmentRaw = record.equipmentRaw;
      service.carrierRaw = record.carrierRaw;
    }

    const alreadySighted = service.sightings.some(
      (sighting) =>
        sighting.registeredAt.getTime() === record.registeredAt.getTime(),
    );

    if (!alreadySighted) {
      service.sightings.push({ registeredAt: record.registeredAt });
    }

    if (
      record.contactPhone &&
      record.contactPhone !== record.serviceNumber &&
      !group.contactPhones.includes(record.contactPhone)
    ) {
      group.contactPhones.push(record.contactPhone);
    }
  }

  for (const group of groups.values()) {
    group.contactPhones = group.contactPhones.filter(
      (phone) =>
        !group.services.some((service) => service.serviceNumber === phone),
    );
  }

  return [...groups.values()];
}
