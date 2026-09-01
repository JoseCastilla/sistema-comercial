"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";

import {
  getRecoveryApiBaseUrl,
  readRecoveryApiError,
  signRecoveryInternalRequest,
} from "./recovery-internal-request";

import type { RecoveryAdminActionState } from "./recovery-action.types";

const maximumFileBytes = 30 * 1024 * 1024;

interface CrossSummary {
  kind: "FULL" | "QUICK";
  reused: boolean;
  totalRows: number;
  matchedServices: number;
  discardedServices: number;
  discardedCases: number;
  waitingCases: number;
  revalidationCases: number;
  scheduledServices: number;
  plantLineServices: number;
}

export async function applyPortabilityAction(
  previousState: RecoveryAdminActionState,
  formData: FormData,
): Promise<RecoveryAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const file = formData.get("file");
  const quickColumn = formData.get("quickColumn");

  if (!(file instanceof File) || file.size === 0) {
    return {
      type: "error",
      message: "Selecciona el reporte de portabilidad.",
    };
  }

  if (file.size > maximumFileBytes) {
    return { type: "error", message: "El reporte no puede superar 30 MB." };
  }

  const report = await file.arrayBuffer();
  const resourceFingerprint = createHash("sha256")
    .update(new DataView(report))
    .digest("hex");
  const { timestamp, signature } = signRecoveryInternalRequest({
    organizationId: membership.organization.id,
    actorUserId: session.user.id,
    resourceFingerprint,
  });

  const outbound = new FormData();
  outbound.set("file", new Blob([report]), file.name);

  if (typeof quickColumn === "string" && quickColumn.trim().length > 0) {
    outbound.set("quickColumn", quickColumn.trim());
  }

  let response: Response;

  try {
    response = await fetch(
      `${getRecoveryApiBaseUrl()}/internal/recovery-base/portability`,
      {
        method: "POST",
        headers: {
          "x-recovery-organization-id": membership.organization.id,
          "x-recovery-actor-user-id": session.user.id,
          "x-recovery-timestamp": timestamp,
          "x-recovery-signature": signature,
        },
        body: outbound,
        cache: "no-store",
      },
    );
  } catch {
    return {
      type: "error",
      message: "No se pudo contactar a la API local de importación.",
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return {
      type: "error",
      message:
        readRecoveryApiError(payload) ??
        "No se pudo aplicar el reporte de portabilidad.",
    };
  }

  revalidatePath("/admin/recovery-base");
  revalidatePath("/recovery/triage");

  const summary = (payload ?? {}) as Partial<CrossSummary>;

  const parts = [
    `${summary.matchedServices ?? 0} línea(s) cruzadas de ${summary.totalRows ?? 0} consultadas`,
    `${summary.discardedCases ?? 0} caso(s) descartados por ya estar en Movistar`,
    `${summary.waitingCases ?? 0} en espera por portación en curso`,
    `${summary.scheduledServices ?? 0} agendadas por los 30 días`,
  ];

  if ((summary.revalidationCases ?? 0) > 0) {
    parts.push(
      `${summary.revalidationCases} sin fecha visible, se revalidan mañana`,
    );
  }

  if ((summary.plantLineServices ?? 0) > 0) {
    parts.push(`${summary.plantLineServices} línea(s) de planta`);
  }

  // Un archivo ya conocido no crea un lote nuevo, pero sí vuelve a cruzarse
  // contra los casos abiertos de hoy (BR-020).
  const prefix = summary.reused ? "Reporte ya conocido, cruzado de nuevo: " : "";

  return { type: "success", message: `${prefix}${parts.join(" · ")}.` };
}
