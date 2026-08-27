import path from "node:path";

import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",

  outputFileTracingRoot: path.join(currentDirectory, "../.."),

  experimental: {
    // Las importaciones suben el libro completo por una acción de servidor.
    // El límite por defecto es 1 MB y la base nacional pesa varios megas; el
    // tope real lo imponen las acciones (25 MB recupero, 10 MB DITO).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
