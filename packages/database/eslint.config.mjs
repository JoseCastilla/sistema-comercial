import { config as baseConfig } from "@repo/eslint-config/base";
import globals from "globals";

export default [
  ...baseConfig,

  {
    files: ["scripts/**/*.mjs"],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
