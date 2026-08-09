"use server";

import { revalidatePath } from "next/cache";

import { resolveDitoAgentIdentitySchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { DitoImportAdminActionState } from "./dito-import-action.types";

export async function resolveDitoAgentIdentityAction(
  previousState: DitoImportAdminActionState,
  formData: FormData,
): Promise<DitoImportAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const parsed = resolveDitoAgentIdentitySchema.safeParse({
    batchId: formData.get("batchId"),
    identityId: formData.get("identityId"),
    userId: formData.get("userId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });

  if (!parsed.success) {
    return { type: "error", message: "La vinculación no es válida." };
  }

  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  const target = await database.organizationMember.findFirst({
    where: {
      organizationId: membership.organization.id,
      userId: parsed.data.userId,
      role: "AGENT",
      user: {
        status: "ACTIVE",
        commercialTeamMemberships: {
          some: {
            memberRole: "AGENT",
            isPrimary: true,
            isActive: true,
            team: {
              organizationId: membership.organization.id,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      userId: true,
      user: {
        select: {
          name: true,
          commercialTeamMemberships: {
            where: {
              memberRole: "AGENT",
              isPrimary: true,
              isActive: true,
              team: {
                organizationId: membership.organization.id,
                status: "ACTIVE",
              },
            },
            take: 2,
            select: { teamId: true },
          },
        },
      },
    },
  });

  if (!target || target.user.commercialTeamMemberships.length !== 1) {
    return {
      type: "error",
      message: "El asesor debe tener un único equipo principal activo.",
    };
  }

  const updated = await database.ditoAgentIdentity.updateMany({
    where: {
      id: parsed.data.identityId,
      organizationId: membership.organization.id,
      isActive: true,
      isSharedAccount: false,
      userId: null,
      updatedAt: expectedUpdatedAt,
      importRows: {
        some: {
          batchId: parsed.data.batchId,
          batch: { status: { in: ["PREVIEW", "READY", "FAILED"] } },
        },
      },
    },
    data: {
      userId: target.userId,
      resolvedByUserId: session.user.id,
      resolvedAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    return {
      type: "conflict",
      message: "La identidad cambió mientras la revisabas. Recarga la página.",
    };
  }

  revalidatePath("/admin/dito-imports");

  return {
    type: "success",
    message: `Identidad vinculada con ${target.user.name}.`,
  };
}
