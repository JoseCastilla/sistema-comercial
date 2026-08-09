import { z } from "zod";

import { ditoOrderAssignmentReasonSchema } from "./commercial-team-rules.js";

export const ditoOrderOrphanClaimSchema = z
  .object({
    orderId: z.uuid(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    teamId: z.uuid(),
    agentUserId: z.uuid(),
    reason: ditoOrderAssignmentReasonSchema,
    observation: z.string().trim().max(500).optional(),
  })
  .superRefine((input, context) => {
    if (input.reason === "OTHER" && !input.observation) {
      context.addIssue({
        code: "custom",
        message: "Explica el motivo de la asignación.",
        path: ["observation"],
      });
    }
  });

export type DitoOrderOrphanClaimInput = z.infer<
  typeof ditoOrderOrphanClaimSchema
>;
