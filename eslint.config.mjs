import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTypescript),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_"
        }
      ],
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off"
    },
    settings: {
      next: {
        rootDir: ["apps/api/", "apps/web/"]
      }
    }
  },
  globalIgnores([
    "**/.next/**",
    "**/build/**",
    "**/coverage/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "**/node_modules/**",
    "**/out/**",
    "**/src/generated/**",
    "tmp/**"
  ])
]);
