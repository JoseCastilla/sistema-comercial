import { z } from "zod";

export const ditoOrderCancellationReviewDecisions = [
  "APPROVE",
  "REJECT",
] as const;

const reviewObservationSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}, z.string().max(2000, "La observación no puede superar 2000 caracteres").nullable());

export const ditoOrderCancellationReviewSchema = z
  .object({
    requestId: z.string().uuid("La solicitud no es válida"),
    decision: z.enum(ditoOrderCancellationReviewDecisions),
    observation: reviewObservationSchema,
  })
  .superRefine((value, context) => {
    if (
      value.decision === "REJECT" &&
      (value.observation === null || value.observation.length < 10)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observation"],
        message: "Explica el rechazo con al menos 10 caracteres",
      });
    }
  });

export type DitoOrderCancellationReviewInput = z.infer<
  typeof ditoOrderCancellationReviewSchema
>;
