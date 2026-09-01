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
      message:
        "No pudimos procesar el archivo en este momento. Vuelve a intentarlo; si sigue igual, avisa a soporte.",
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
    `${summary.matchedServices ?? 0} línea(s) encontradas en la base de ${summary.totalRows ?? 0} consultadas`,
    `${summary.discardedCases ?? 0} caso(s) cerrados porque ya eran Movistar`,
    `${summary.waitingCases ?? 0} pasaron a espera: están portando a Movistar`,
    `${summary.scheduledServices ?? 0} agendadas hasta cumplir los 30 días desde su última portación`,
  ];

  if ((summary.revalidationCases ?? 0) > 0) {
    parts.push(
      `${summary.revalidationCases} portan sin fecha visible, se revisan con el próximo reporte`,
    );
  }

  if ((summary.plantLineServices ?? 0) > 0) {
    parts.push(
      `${summary.plantLineServices} línea(s) que nunca han portado (planta)`,
    );
  }

  // Un archivo ya conocido no crea un lote nuevo, pero sí vuelve a cruzarse
  // contra los casos abiertos de hoy (BR-020).
  const prefix = summary.reused ? "Reporte ya conocido, cruzado de nuevo: " : "";

  return { type: "success", message: `${prefix}${parts.join(" · ")}.` };
}
