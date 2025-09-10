import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
// @ts-ignore - import internal flat recommended helper from the plugin (safe at runtime)
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import css from '@eslint/css';
import { defineConfig } from 'eslint/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM so typescript-eslint can infer the project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
  },
  // Provide TypeScript parser and a small set of conservative rules for files
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
    },
    plugins: { '@typescript-eslint': tsPlugin as any },
    rules: {
      // Turn off the core ESLint rule in favor of the TypeScript-aware one
      'no-unused-vars': 'off',
      // basic safe defaults; project can opt-in to stricter rules later
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Ensure parserOptions has a resolved tsconfigRootDir for the TypeScript parser
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Point to the workspace tsconfig; this resolved dir avoids a typescript-eslint bug
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
    },
  },
  // Tolerate a few pragmatic patterns across the codebase to avoid flooding lint
  // with legacy/intentional patterns. These are conservative relaxations that
  // keep most rules strict while allowing underscore-prefixed unused args,
  // warning on `any` instead of error, and permitting require-style imports
  // where necessary (workers, dynamic requires).
  {
    files: ['**/*.{ts,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use GameState.rng.next() for determinism' },
      ],
    },
  },
  // Worker and bundler-specific files often rely on globals like `process`, `require`,
  // or `__webpack_public_path__`. Declare those as readonly for matching files to
  // avoid flooding the lint report with false positives (we don't change runtime
  // semantics here, only inform ESLint about available globals).
  {
    files: [
      'src/simWorker.ts',
      'src/**/svgRasterWorker*.ts',
      'src/**/worker*.ts',
      'src/utils/env.ts',
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        require: 'readonly',
        __webpack_public_path__: 'readonly',
        self: 'readonly',
      },
    },
  },
  { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: ['json/recommended'] },
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.json5'],
    plugins: { json },
    language: 'json/json5',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
  },
  { files: ['**/*.css'], plugins: { css }, language: 'css/css', extends: ['css/recommended'] },
]);
