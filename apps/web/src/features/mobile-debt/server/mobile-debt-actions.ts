"use server";

import { revalidatePath } from "next/cache";

import { requireCommercialAccess } from "@/server/auth/access";

import {
  normalizeMobileDebtPhone,
  parseMobileDebtOperator,
} from "@repo/validation";

import {
  MobileDebtError,
  getMobileDebtOverview,
  lookupMobileDebt,
  saveRedDigitalCredentials,
} from "./mobile-debt-service";

import type {
  MobileDebtActionState,
  MobileDebtCredentialActionState,
} from "../mobile-debt.types";

export async function lookupMobileDebtAction(
  previousState: MobileDebtActionState,
  formData: FormData,
): Promise<MobileDebtActionState> {
  void previousState;
  const { session, membership } = await requireCommercialAccess();
  const readStats = () =>
    getMobileDebtOverview({
      organizationId: membership.organization.id,
      actorUserId: session.user.id,
    });
  const phone = normalizeMobileDebtPhone(formData.get("phone"));
  const operator = parseMobileDebtOperator(formData.get("operator"));
  if (!phone || !operator) {
    return {
      type: "error",
      message:
        "Selecciona un operador e ingresa un celular válido de 9 dígitos.",
      result: null,
      stats: await readStats(),
    };
  }

  try {
    const result = await lookupMobileDebt({
      organizationId: membership.organization.id,
      actorUserId: session.user.id,
      operator,
      phone,
    });
    return {
      type: "success",
      message: "Consulta completada y registrada en tu actividad.",
      result: {
        ...result,
        queriedAt: result.queriedAt.toISOString(),
      },
      stats: await readStats(),
    };
  } catch (error) {
    const message =
      error instanceof MobileDebtError
        ? error.code === "CONFIGURATION" || error.code === "CREDENTIAL_EXPIRED"
          ? "El servicio necesita actualización. Comunícate con un supervisor."
          : error.message
        : "No se pudo completar la consulta. Intenta nuevamente.";
    return {
      type: "error",
      message,
      result: null,
      stats: await readStats(),
    };
  }
}

export async function saveMobileDebtCredentialsAction(
  previousState: MobileDebtCredentialActionState,
  formData: FormData,
): Promise<MobileDebtCredentialActionState> {
  void previousState;
  const { session, membership } = await requireCommercialAccess();
  if (membership.role !== "ADMIN" && membership.role !== "SUPERVISOR") {
    return {
      type: "error",
      message: "No tienes permiso para modificar esta conexión.",
    };
  }

  const credentials = {
    jSessionId: readCredential(formData.get("jSessionId")),
    cidSb: readCredential(formData.get("cidSb")),
    captcha: readCredential(formData.get("captcha")),
    csrfToken: readCredential(formData.get("csrfToken")),
  };
  if (Object.values(credentials).some((value) => value === null)) {
    return {
      type: "error",
      message:
        "Completa los cuatro valores. No deben contener espacios ni separadores de cookie.",
    };
  }

  try {
    await saveRedDigitalCredentials({
      organizationId: membership.organization.id,
      actorUserId: session.user.id,
      credentials: credentials as Record<keyof typeof credentials, string>,
    });
    revalidatePath("/tools/debt");
    return {
      type: "success",
      message:
        "Credenciales guardadas de forma cifrada. Se validarán en la próxima consulta.",
    };
  } catch {
    return {
      type: "error",
      message:
        "No se pudo guardar la configuración segura. Revisa la clave de cifrado del servidor.",
    };
  }
}

function readCredential(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 8 &&
    normalized.length <= 1000 &&
    !/[\s;]/.test(normalized)
    ? normalized
    : null;
}
