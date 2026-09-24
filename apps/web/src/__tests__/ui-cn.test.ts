import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

/**
 * `cn` resuelve conflictos entre clases de Tailwind. El sistema tiene tamaños
 * y colores propios (`text-2xs`, `text-ui-muted`): tamaño y color no pueden
 * pisarse, y dos tamaños o dos colores sí.
 */
describe("cn", () => {
  it("conserva tamaño y color propios juntos", () => {
    expect(cn("text-2xs text-ui-muted")).toBe("text-2xs text-ui-muted");
    expect(cn("text-sm", "text-ui-accent")).toBe("text-sm text-ui-accent");
  });

  it("la clase que llega después gana en el mismo aspecto", () => {
    expect(cn("text-sm", "text-xs")).toBe("text-xs");
    expect(cn("bg-ui-strong", "bg-ui-accent")).toBe("bg-ui-accent");
    expect(cn("min-h-10 px-4", "p-0")).toBe("min-h-10 p-0");
  });

  it("ignora lo falso", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
