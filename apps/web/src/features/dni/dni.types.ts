export interface DniPersonView {
  dni: string;
  verificationDigit: string | null;
  fullName: string;
  givenNames: string | null;
  paternalSurname: string | null;
  maternalSurname: string | null;
  sex: string | null;
  birthDateRaw: string | null;
  age: number | null;
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
  fetchedAt: string;
  source: "API" | "CACHE";
}

export interface DniLookupScopeStats {
  today: number;
  month: number;
  uniqueDnisThisMonth: number;
  /** Consultas nuevas al proveedor este mes: las que gastan crédito. */
  apiThisMonth: number;
  /** Lecturas de la ficha guardada este mes: no gastan crédito. */
  cacheThisMonth: number;
}

/**
 * SPEC-045 PL-10: la actividad propia siempre; la de la organización solo
 * para administración (`null` para el resto).
 */
export interface DniLookupStats extends DniLookupScopeStats {
  organization: DniLookupScopeStats | null;
}

export interface DniCreditStatus {
  balance: number | null;
  tone: "success" | "warning" | "danger" | "neutral";
  label: string;
  reportedAt: string | null;
}

export interface DniLookupActionState {
  type: "idle" | "success" | "error";
  message: string;
  person: DniPersonView | null;
  stats: DniLookupStats;
  creditStatus: DniCreditStatus | null;
}
