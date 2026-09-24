import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Botón de shadcn/ui sobre los tokens del sistema (SPEC-063 fase 5).
 *
 * Una sola implementación para lo que hoy se escribe a mano en cada pantalla.
 * `asChild` lo aplica a un `<Link>`: la acción que navega se ve igual que la
 * que envía. Los fondos de color usan su token «sobre» (`on-strong`,
 * `on-accent`), no blanco fijo: en oscuro el blanco sobre acento no se lee.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-canvas disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-ui-strong text-ui-on-strong hover:opacity-90",
        accent: "bg-ui-accent text-ui-on-accent hover:opacity-90",
        outline:
          "border border-ui-border-strong bg-ui-surface text-ui-text hover:bg-ui-subtle",
        ghost: "text-ui-text hover:bg-ui-subtle",
        link: "text-ui-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-10 px-4",
        sm: "min-h-8 px-3 text-xs",
        inline: "p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot="button"
      {...props}
    />
  );
}
