import { z } from "zod";

export const resolveDitoAgentIdentitySchema = z.object({
  batchId: z.uuid(),
  identityId: z.uuid(),
  userId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const confirmDitoImportBatchSchema = z.object({
  batchId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const deleteDitoImportBatchSchema = z.object({
  batchId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const markDitoAgentIdentitySharedSchema = z.object({
  batchId: z.uuid(),
  identityId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const assignSharedDitoImportRowsSchema = z.object({
  batchId: z.uuid(),
  assignments: z
    .array(
      z.object({
        rowId: z.uuid(),
        userId: z.uuid(),
        expectedUpdatedAt: z.iso.datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(100),
});

const resolvableDitoImportConflictFieldSchema = z.enum([
  "commercialOperation",
  "carrier",
  "fixedCharge",
  "holderFullNameRaw",
  "holderDocumentType",
  "holderDocumentNumber",
  "serviceNumber",
  "deliveryMethod",
  "deliveryMethodRaw",
  "deliveryAddress",
  "deliveryReference",
  "deliveryLatitude",
  "deliveryLongitude",
  "department",
  "province",
  "district",
]);

export const resolveDitoImportConflictSchema = z.object({
  batchId: z.uuid(),
  rowId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  resolutions: z
    .array(
      z.object({
        field: resolvableDitoImportConflictFieldSchema,
        decision: z.enum(["KEEP_CURRENT", "USE_INCOMING"]),
      }),
    )
    .min(1)
    .max(20)
    .superRefine((items, context) => {
      const fields = new Set<string>();

      items.forEach((item, index) => {
        if (fields.has(item.field)) {
          context.addIssue({
            code: "custom",
            message: "Cada campo solo puede resolverse una vez.",
            path: [index, "field"],
          });
        }
        fields.add(item.field);
      });
    }),
});

export type ResolveDitoAgentIdentityInput = z.infer<
  typeof resolveDitoAgentIdentitySchema
>;
export type ConfirmDitoImportBatchInput = z.infer<
  typeof confirmDitoImportBatchSchema
>;
export type DeleteDitoImportBatchInput = z.infer<
  typeof deleteDitoImportBatchSchema
>;
export type MarkDitoAgentIdentitySharedInput = z.infer<
  typeof markDitoAgentIdentitySharedSchema
>;
export type AssignSharedDitoImportRowsInput = z.infer<
  typeof assignSharedDitoImportRowsSchema
>;
export type ResolveDitoImportConflictInput = z.infer<
  typeof resolveDitoImportConflictSchema
>;
