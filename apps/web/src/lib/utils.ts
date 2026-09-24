import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases de Tailwind resolviendo conflictos: la última gana. Es la
 * utilidad de shadcn/ui (SPEC-063 fase 5): los componentes de
 * `components/ui` aceptan `className` y lo combinan con la suya.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
