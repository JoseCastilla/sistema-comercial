"use server";

import { redirect } from "next/navigation";

import { deleteDitoImportBatchSchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { DitoImportAdminActionState } from "./dito-import-action.types";

export async function deleteDitoImportAction(
  previousState: DitoImportAdminActionState,
  formData: FormData,
): Promise<DitoImportAdminActionState> {
  void previousState;

  const { membership } = await requireAdminAccess();
  const parsed = deleteDitoImportBatchSchema.safeParse({
    batchId: formData.get("batchId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return {
      type: "error",
      message: "Esta página está desactualizada. Recárgala y vuelve a intentarlo.",
    };
  }

  const deleted = await database.ditoImportBatch.deleteMany({
    where: {
      id: parsed.data.batchId,
      organizationId: membership.organization.id,
      updatedAt: new Date(parsed.data.expectedUpdatedAt),
      confirmedAt: null,
      status: { in: ["PREVIEW", "READY", "FAILED"] },
    },
  });

  if (deleted.count !== 1) {
    return {
      type: "conflict",
      message:
        "La carga cambió, está procesándose o ya fue confirmada. Recarga la página.",
    };
  }

  redirect("/admin/dito-imports");
}
