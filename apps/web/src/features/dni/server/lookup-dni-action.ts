"use server";

import { requireCommercialAccess } from "@/server/auth/access";

import {
  calculateAgeFromPeruvianDate,
  normalizeDniLookupInput,
} from "@repo/validation";

import {
  DniLookupError,
  getDniLookupOverview,
  lookupDni,
} from "./dni-lookup-service";

import type { DniLookupActionState, DniPersonView } from "../dni.types";

export async function lookupDniAction(
  previousState: DniLookupActionState,
  formData: FormData,
): Promise<DniLookupActionState> {
  void previousState;
  const { session, membership } = await requireCommercialAccess();
  const canViewCredits = membership.role === "ADMIN";
  const readOverview = () =>
    getDniLookupOverview({
      organizationId: membership.organization.id,
      actorUserId: session.user.id,
      canViewCredits,
    });
  const dni = normalizeDniLookupInput(formData.get("dni"));

  if (!dni) {
    const overview = await readOverview();
    return {
      type: "error",
      message: "Ingresa un DNI válido de 8 dígitos.",
      person: null,
      ...overview,
    };
  }

  try {
    const result = await lookupDni({
      organizationId: membership.organization.id,
      actorUserId: session.user.id,
      dni,
    });
    const overview = await readOverview();

    return {
      type: "success",
      message:
        result.source === "CACHE"
          ? canViewCredits
            ? "Datos recuperados del historial. Esta consulta no consumió créditos."
            : "Datos recuperados del historial de consultas."
          : canViewCredits
            ? "Datos encontrados y guardados. Las próximas consultas no consumirán créditos."
            : "Datos encontrados y guardados en el historial.",
      person: toPersonView(result.snapshot, result.source),
      ...overview,
    };
  } catch (error) {
    const overview = await readOverview();
    if (error instanceof DniLookupError) {
      return {
        type: "error",
        message:
          error.code === "CONFIGURATION"
            ? "El servicio de consulta aún no está configurado. Contacta al administrador."
            : error.message,
        person: null,
        ...overview,
      };
    }

    return {
      type: "error",
      message: "No se pudo completar la consulta. Intenta nuevamente.",
      person: null,
      ...overview,
    };
  }
}

function toPersonView(
  snapshot: {
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
    fetchedAt: Date;
  },
  source: "API" | "CACHE",
): DniPersonView {
  const fullName = [
    snapshot.givenNames,
    snapshot.paternalSurname,
    snapshot.maternalSurname,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    dni: snapshot.dni,
    verificationDigit: snapshot.verificationDigit,
    fullName: fullName || "Nombre no disponible",
    givenNames: snapshot.givenNames,
    paternalSurname: snapshot.paternalSurname,
    maternalSurname: snapshot.maternalSurname,
    sex: snapshot.sex,
    birthDateRaw: snapshot.birthDateRaw,
    age: calculateAgeFromPeruvianDate(snapshot.birthDateRaw),
    birthDepartment: snapshot.birthDepartment,
    birthProvince: snapshot.birthProvince,
    birthDistrict: snapshot.birthDistrict,
    educationLevel: snapshot.educationLevel,
    maritalStatus: snapshot.maritalStatus,
    heightCm: snapshot.heightCm,
    registrationDateRaw: snapshot.registrationDateRaw,
    issueDateRaw: snapshot.issueDateRaw,
    expiryDateRaw: snapshot.expiryDateRaw,
    fatherName: snapshot.fatherName,
    motherName: snapshot.motherName,
    restriction: snapshot.restriction,
    addressDescription: snapshot.addressDescription,
    addressDepartment: snapshot.addressDepartment,
    addressProvince: snapshot.addressProvince,
    addressDistrict: snapshot.addressDistrict,
    reniecUbigeo: snapshot.reniecUbigeo,
    ineiUbigeo: snapshot.ineiUbigeo,
    sunatUbigeo: snapshot.sunatUbigeo,
    postalCode: snapshot.postalCode,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    source,
  };
}
