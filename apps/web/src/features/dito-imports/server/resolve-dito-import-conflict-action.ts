"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@repo/database";
import { resolveDitoImportConflictSchema } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { DitoImportAdminActionState } from "./dito-import-action.types";

type Scalar = string | number | null;

interface StoredConflict {
  field: string;
  current: Scalar;
  incoming: Scalar;
}

export async function resolveDitoImportConflictAction(
  previousState: DitoImportAdminActionState,
  formData: FormData,
): Promise<DitoImportAdminActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const fields = formData
    .getAll("conflictField")
    .filter((value): value is string => typeof value === "string");
  const resolutions = fields.flatMap((field) => {
    const decision = formData.get(`decision:${field}`);

    return typeof decision === "string" ? [{ field, decision }] : [];
  });
  const parsed = resolveDitoImportConflictSchema.safeParse({
    batchId: formData.get("batchId"),
    rowId: formData.get("rowId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    resolutions,
  });

  if (!parsed.success) {
    return {
      type: "error",
      message: "Selecciona una decisión válida para cada campo.",
    };
  }

  const result = await database.$transaction(async (transaction) => {
    const row = await transaction.ditoImportRow.findFirst({
      where: {
        id: parsed.data.rowId,
        batchId: parsed.data.batchId,
        organizationId: membership.organization.id,
        classification: "CONFLICT",
        updatedAt: new Date(parsed.data.expectedUpdatedAt),
        batch: { status: { in: ["PREVIEW", "READY", "FAILED"] } },
      },
      select: {
        id: true,
        conflicts: true,
        issueCodes: true,
        proposedChanges: true,
        parsedData: true,
      },
    });

    if (!row) return { type: "STALE" as const };

    const conflicts = readConflicts(row.conflicts);
    const resolutionsByField = new Map<string, "KEEP_CURRENT" | "USE_INCOMING">(
      parsed.data.resolutions.map((resolution) => [
        resolution.field,
        resolution.decision,
      ]),
    );

    if (
      conflicts.length !== resolutionsByField.size ||
      conflicts.some((conflict) => !resolutionsByField.has(conflict.field))
    ) {
      return { type: "INVALID" as const };
    }

    const proposedChanges = readScalarRecord(row.proposedChanges);
    const parsedData = readJsonRecord(row.parsedData);
    const resolvedAt = new Date();
    const resolutionAudit = conflicts.map((conflict) => {
      const decision = resolutionsByField.get(conflict.field);

      if (!decision) {
        throw new Error("Resolución de conflicto incompleta.");
      }

      if (decision === "USE_INCOMING") {
        proposedChanges[conflict.field] = conflict.incoming;
        if (
          conflict.field === "commercialOperation" &&
          typeof parsedData.operationRaw === "string"
        ) {
          proposedChanges.operationRaw = parsedData.operationRaw;
        }
      } else {
        delete proposedChanges[conflict.field];
        if (conflict.field === "commercialOperation") {
          delete proposedChanges.operationRaw;
        }
      }

      return {
        ...conflict,
        decision,
        resolvedByUserId: session.user.id,
        resolvedAt: resolvedAt.toISOString(),
      };
    });
    const classification =
      Object.keys(proposedChanges).length > 0 ? "ENRICHMENT" : "UNCHANGED";
    const previousAudit = Array.isArray(parsedData.conflictResolutions)
      ? parsedData.conflictResolutions
      : [];

    const updated = await transaction.ditoImportRow.updateMany({
      where: {
        id: row.id,
        organizationId: membership.organization.id,
        classification: "CONFLICT",
        updatedAt: new Date(parsed.data.expectedUpdatedAt),
      },
      data: {
        classification,
        issueCodes: {
          set: row.issueCodes.filter(
            (issue) => issue !== "VALID_VALUE_CONFLICT",
          ),
        },
        conflicts: Prisma.DbNull,
        proposedChanges:
          Object.keys(proposedChanges).length > 0
            ? (proposedChanges as Prisma.InputJsonObject)
            : Prisma.DbNull,
        parsedData: {
          ...parsedData,
          conflictResolutions: [...previousAudit, ...resolutionAudit],
        } as Prisma.InputJsonObject,
      },
    });

    if (updated.count !== 1) return { type: "STALE" as const };

    const counts = await transaction.ditoImportRow.groupBy({
      by: ["classification"],
      where: { batchId: parsed.data.batchId },
      _count: { _all: true },
    });
    const count = (classificationValue: string) =>
      counts.find((entry) => entry.classification === classificationValue)
        ?._count._all ?? 0;
    const blockedRows = count("BLOCKED_IDENTITY");
    const conflictRows = count("CONFLICT");

    await transaction.ditoImportBatch.updateMany({
      where: {
        id: parsed.data.batchId,
        organizationId: membership.organization.id,
        status: { in: ["PREVIEW", "READY", "FAILED"] },
      },
      data: {
        newRows: count("NEW_ORDER"),
        enrichmentRows: count("ENRICHMENT"),
        unchangedRows: count("UNCHANGED"),
        blockedRows,
        conflictRows,
        status: blockedRows === 0 && conflictRows === 0 ? "READY" : "PREVIEW",
      },
    });

    return { type: "SUCCESS" as const };
  });

  if (result.type === "STALE") {
    return {
      type: "conflict",
      message: "El pedido cambió mientras lo revisabas. Recarga la página.",
    };
  }
  if (result.type === "INVALID") {
    return {
      type: "error",
      message: "Este conflicto requiere un flujo especializado.",
    };
  }

  revalidatePath("/admin/dito-imports");

  return { type: "success", message: "Conflicto resuelto y registrado." };
}

function readConflicts(value: Prisma.JsonValue | null): StoredConflict[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("field" in entry) ||
      typeof entry.field !== "string" ||
      !("current" in entry) ||
      !("incoming" in entry) ||
      !isScalar(entry.current) ||
      !isScalar(entry.incoming)
    ) {
      return [];
    }

    return [
      { field: entry.field, current: entry.current, incoming: entry.incoming },
    ];
  });
}

function readScalarRecord(
  value: Prisma.JsonValue | null,
): Record<string, Scalar> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Scalar] =>
      isScalar(entry[1]),
    ),
  );
}

function readJsonRecord(
  value: Prisma.JsonValue,
): Record<string, Prisma.JsonValue> {
  if (Array.isArray(value) || typeof value !== "object" || value === null) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, Prisma.JsonValue] => entry[1] !== undefined,
    ),
  );
}

function isScalar(value: unknown): value is Scalar {
  return (
    value === null || typeof value === "string" || typeof value === "number"
  );
}
