export interface DniPersonData {
  dni: string;
  verificationDigit: string | null;
  givenNames: string | null;
  paternalSurname: string | null;
  maternalSurname: string | null;
  sex: string | null;
  birthDateRaw: string | null;
  birthDepartment: string | null;
  birthProvince: string | null;
  birthDistrict: string | null;
  educationLevel: string | null;
  maritalStatus: string | null;
  heightCm: number | null;
  registrationDateRaw: string | null;
  issueDateRaw: string | null;
  expiryDateRaw: string | null;
  fatherName: string | null;
  motherName: string | null;
  restriction: string | null;
  addressDescription: string | null;
  addressDepartment: string | null;
  addressProvince: string | null;
  addressDistrict: string | null;
  reniecUbigeo: string | null;
  ineiUbigeo: string | null;
  sunatUbigeo: string | null;
  postalCode: string | null;
}

export type DniLookupApiParseResult =
  | { ok: true; person: DniPersonData; credits: string | null }
  | { ok: false; reason: "NOT_FOUND" | "INVALID_RESPONSE" };

export interface DniCreditIndicator {
  balance: number | null;
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
}

/**
 * Acepta el formato operativo de ocho digitos y el formato visual
 * `12345678-9` usado por la hoja anterior. Nunca completa ceros: en una
 * consulta manual eso podria cambiar la identidad indicada por el asesor.
 */
export function normalizeDniLookupInput(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const match = String(value)
    .trim()
    .match(/^(\d{8})(?:\s*-\s*[0-9a-z]+)?$/i);

  return match?.[1] ?? null;
}

/** Convierte el contrato externo, no confiable, a la ficha interna estable. */
export function parseDniLookupApiResponse(
  value: unknown,
  requestedDni: string,
): DniLookupApiParseResult {
  if (!isRecord(value)) return { ok: false, reason: "INVALID_RESPONSE" };

  const message = readString(value.message)?.toLocaleLowerCase("es-PE");
  if (message !== "found data") return { ok: false, reason: "NOT_FOUND" };

  if (!isRecord(value.result)) {
    return { ok: false, reason: "INVALID_RESPONSE" };
  }

  const result = value.result;
  const responseDni = normalizeDniLookupInput(readString(result.nuDni) ?? "");
  if (!responseDni || responseDni !== requestedDni) {
    return { ok: false, reason: "INVALID_RESPONSE" };
  }

  const location = isRecord(result.ubicacion) ? result.ubicacion : {};

  return {
    ok: true,
    credits: readString(value.credits),
    person: {
      dni: responseDni,
      verificationDigit: readString(result.digitoVerificacion),
      givenNames: readString(result.preNombres),
      paternalSurname: readString(result.apePaterno),
      maternalSurname: readString(result.apeMaterno),
      sex: readString(result.sexo),
      birthDateRaw: readString(result.feNacimiento),
      birthDepartment: readString(result.departamento),
      birthProvince: readString(result.provincia),
      birthDistrict: readString(result.distrito),
      educationLevel: readString(result.gradoInstruccion),
      maritalStatus: readString(result.estadoCivil),
      heightCm: readHeight(result.estatura),
      registrationDateRaw: readString(result.feInscripcion),
      issueDateRaw: readString(result.feEmision),
      expiryDateRaw: readString(result.feCaducidad),
      fatherName: readString(result.nomPadre),
      motherName: readString(result.nomMadre),
      restriction: readString(result.deRestriccion),
      addressDescription: readString(result.desDireccion),
      addressDepartment: readString(result.depaDireccion),
      addressProvince: readString(result.provDireccion),
      addressDistrict: readString(result.distDireccion),
      reniecUbigeo: readString(location.ubigeo_reniec),
      ineiUbigeo: readString(location.ubigeo_inei),
      sunatUbigeo: readString(location.ubigeo_sunat),
      postalCode: readString(location.codigo_postal),
    },
  };
}

export function calculateAgeFromPeruvianDate(
  value: string | null,
  now = new Date(),
): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const birth = new Date(Date.UTC(year, month - 1, day));

  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day ||
    birth > now
  ) {
    return null;
  }

  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }

  return age;
}

/**
 * Semáforo operativo del saldo. Menos de 100 siempre es crítico; entre 100 y
 * 199 anticipa la recarga y desde 200 se considera suficiente.
 */
export function resolveDniCreditIndicator(
  value: string | number | null,
): DniCreditIndicator {
  const match = String(value ?? "").match(/\d+/);
  const balance = match ? Number(match[0]) : null;

  if (balance === null || !Number.isSafeInteger(balance)) {
    return { balance: null, tone: "neutral", label: "Saldo no disponible" };
  }

  if (balance < 100) {
    return { balance, tone: "danger", label: "Recarga necesaria" };
  }

  if (balance < 200) {
    return { balance, tone: "warning", label: "Planificar recarga" };
  }

  return { balance, tone: "success", label: "Saldo suficiente" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function readHeight(value: unknown): number | null {
  const text = readString(value);
  if (!text) return null;
  const height = Number.parseInt(text.replace(/[^\d]/g, ""), 10);
  return Number.isInteger(height) && height >= 50 && height <= 250
    ? height
    : null;
}
