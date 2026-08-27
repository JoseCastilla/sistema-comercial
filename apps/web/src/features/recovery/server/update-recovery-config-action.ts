"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { RecoveryAdminActionState } from "./recovery-action.types";

function parseListField(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];

  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length > 0),
    ),
  ];
}

/**
 * BR-010: los filtros de elegibilidad son configuración editable, versionada
 * por vigencia. Cada cambio crea una configuración nueva y desactiva la
 * anterior; los lotes ya confirmados conservan la referencia con la que se
 * evaluaron (AC-005).
 */
export async function updateRecoveryConfigAction(
  previousState: RecoveryAdminActionState,
  formData: FormData,
): Promise<RecoveryAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();

  const modalities = parseListField(formData.get("modalities"));
  const planNames = parseListField(formData.get("planNames"));
  const equipmentNames = parseListField(formData.get("equipmentNames"));
  const carrierNames = parseListField(formData.get("carrierNames"));

  if (
    modalities.length === 0 ||
    planNames.length === 0 ||
    equipmentNames.length === 0 ||
    carrierNames.length === 0
  ) {
    return {
      type: "error",
      message:
        "Cada lista debe tener al menos un valor: modalidades, planes, equipos y operadores.",
    };
  }

  await database.$transaction([
    database.recoveryEligibilityConfig.updateMany({
      where: { organizationId: membership.organization.id, isActive: true },
      data: { isActive: false },
    }),
    database.recoveryEligibilityConfig.create({
      data: {
        organizationId: membership.organization.id,
        modalities,
        planNames,
        equipmentNames,
        carrierNames,
        createdByUserId: session.user.id,
      },
    }),
  ]);

  revalidatePath("/admin/recovery-base");

  return {
    type: "success",
    message:
      "Filtros actualizados. Aplican a las próximas importaciones; los lotes confirmados no cambian.",
  };
}
