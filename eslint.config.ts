import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM so typescript-eslint can infer the project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  // Ensure parserOptions has a resolved tsconfigRootDir for the TypeScript parser
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      parserOptions: {
        // Point to the workspace tsconfig; this resolved dir avoids a typescript-eslint bug
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"]
      }
    }
  },
  // Tolerate a few pragmatic patterns across the codebase to avoid flooding lint
  // with legacy/intentional patterns. These are conservative relaxations that
  // keep most rules strict while allowing underscore-prefixed unused args,
  // warning on `any` instead of error, and permitting require-style imports
  // where necessary (workers, dynamic requires).
  {
    files: ["**/*.{ts,mts,cts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off"
    }
  }
  ,
  { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
  { files: ["**/*.jsonc"], plugins: { json }, language: "json/jsonc", extends: ["json/recommended"] },
  { files: ["**/*.json5"], plugins: { json }, language: "json/json5", extends: ["json/recommended"] },
  { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
  { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
]);
