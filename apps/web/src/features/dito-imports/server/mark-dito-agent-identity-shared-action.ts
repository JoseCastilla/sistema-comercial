"use server";

import { revalidatePath } from "next/cache";

import { markDitoAgentIdentitySharedSchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { DitoImportAdminActionState } from "./dito-import-action.types";

export async function markDitoAgentIdentitySharedAction(
  previousState: DitoImportAdminActionState,
  formData: FormData,
): Promise<DitoImportAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const parsed = markDitoAgentIdentitySharedSchema.safeParse({
    batchId: formData.get("batchId"),
    identityId: formData.get("identityId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return { type: "error", message: "La cuenta DITO no es válida." };
  }

  const updated = await database.ditoAgentIdentity.updateMany({
    where: {
      id: parsed.data.identityId,
      organizationId: membership.organization.id,
      userId: null,
      isActive: true,
      isSharedAccount: false,
      updatedAt: new Date(parsed.data.expectedUpdatedAt),
      importRows: {
        some: {
          batchId: parsed.data.batchId,
          batch: { status: { in: ["PREVIEW", "READY", "FAILED"] } },
        },
      },
    },
    data: {
      isSharedAccount: true,
      resolvedByUserId: session.user.id,
      resolvedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    return {
      type: "conflict",
      message: "La cuenta cambió mientras la revisabas. Recarga la página.",
    };
  }

  revalidatePath("/admin/dito-imports");

  return {
    type: "success",
    message: "Cuenta compartida registrada. Asigna sus ventas por orden.",
  };
}
