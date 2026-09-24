import { cva, type VariantProps } from "class-variance-authority";

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado de shadcn/ui sobre los tokens (SPEC-063 fase 5). El tono
 * dice cuánto urge o cuánto falta; ninguno depende solo del color: el texto
 * lo dice también («venció hace 10 min», «Gestionado»).
 */
export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-ui-subtle text-ui-muted",
        danger: "bg-ui-danger-soft text-ui-danger",
        warning: "bg-ui-warning-soft text-ui-warning",
        success: "bg-ui-success-soft text-ui-success",
        info: "bg-ui-info-soft text-ui-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ tone }), className)}
      data-slot="badge"
      {...props}
    />
  );
}
