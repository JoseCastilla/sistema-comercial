import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { database } from "./database";

/** Toda acción sensible deja rastro (SPEC-052 BR-014). */
export async function audit(input: {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  targetKind: string;
  targetId?: string | null;
  detail?: Prisma.InputJsonValue;
}) {
  await database.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetKind: input.targetKind,
      targetId: input.targetId ?? null,
      detail: input.detail ?? undefined,
    },
  });
}
