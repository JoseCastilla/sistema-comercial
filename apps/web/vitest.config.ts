import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Se resuelve al fuente del paquete: `exports` apunta a .ts/.tsx sin
      // compilar y Vite necesita transformarlos, no tratarlos como externos.
      "@repo/ui": path.resolve(import.meta.dirname, "../../packages/ui/src"),
    },
  },
  // No hace falta @vitejs/plugin-react: su Fast Refresh es irrelevante en
  // pruebas y el runtime automatico lo resuelve esbuild aca abajo.
  // El tsconfig de Next usa "jsx": "preserve" porque el transform lo hace el
  // propio Next; fuera de su pipeline hay que pedir el runtime automatico o
  // esbuild cae al clasico y exige React en el ambito.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
