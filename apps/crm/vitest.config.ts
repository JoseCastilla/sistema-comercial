import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@repo/ui": path.resolve(import.meta.dirname, "../../packages/ui/src"),
    },
  },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
