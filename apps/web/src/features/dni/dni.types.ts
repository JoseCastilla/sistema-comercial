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

export interface DniLookupStats {
  today: number;
  month: number;
  uniqueDnisThisMonth: number;
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
