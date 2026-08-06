import { z } from "zod";

export const ditoOrderAssignmentRetrySchema = z.object({
  orderId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export type DitoOrderAssignmentRetryInput = z.infer<
  typeof ditoOrderAssignmentRetrySchema
>;
