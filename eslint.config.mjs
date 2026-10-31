import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextTs,
  globalIgnores([
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    ".tool-state/**",
    ".migration-private/**",
    "android-app/**",
    "outputs/**",
    "work/**",
  ]),
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    rules: {
      // Retain the existing application's dynamic data model during migration.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "valid-typeof": "error"
    },
  },
]);

export default eslintConfig;
