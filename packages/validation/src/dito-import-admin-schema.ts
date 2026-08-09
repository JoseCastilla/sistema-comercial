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

export type ResolveDitoAgentIdentityInput = z.infer<
  typeof resolveDitoAgentIdentitySchema
>;
export type ConfirmDitoImportBatchInput = z.infer<
  typeof confirmDitoImportBatchSchema
>;
export type MarkDitoAgentIdentitySharedInput = z.infer<
  typeof markDitoAgentIdentitySharedSchema
>;
export type AssignSharedDitoImportRowsInput = z.infer<
  typeof assignSharedDitoImportRowsSchema
>;
