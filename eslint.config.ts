import * as js from '@eslint/js';
import * as globals from 'globals';
import * as tsPlugin from '@typescript-eslint/eslint-plugin';
// Import the parser object so flat config languageOptions.parser is a parser
// implementation (ESLint expects an object with parse()/parseForESLint()).
import parser from '@typescript-eslint/parser';
// @ts-ignore - import internal flat recommended helper from the plugin (safe at runtime)
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import css from '@eslint/css';
import { defineConfig } from 'eslint/config';
import * as path from 'path';
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
      // Provide the actual parser implementation object. Using the imported
      // parser avoids ESLint complaining that languageOptions.parser is not
      // a parser with parse()/parseForESLint().
      parser: parser as any,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
    },
    plugins: { '@typescript-eslint': tsPlugin as unknown as any },
    rules: {
      // Turn off the core ESLint rule in favor of the TypeScript-aware one
      'no-unused-vars': 'off',
      // Turn off core no-redeclare and use the TS-aware version that understands
      // declaration merging (interfaces + values with the same name)
      'no-redeclare': 'off',
      // basic safe defaults; project can opt-in to stricter rules later
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-redeclare': ['error', { ignoreDeclarationMerge: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Ensure parserOptions has a resolved tsconfigRootDir for the TypeScript parser
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      // Use the actual parser implementation object for ESLint flat config
      parser: parser as any,
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
      '@typescript-eslint/no-redeclare': ['error', { ignoreDeclarationMerge: true }],
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
  // ----- START worker / renderer / browser-like globals override -----
  // Files that are executed in a worker or renderer/browser context (Three.js,
  // postMessage-driven workers, WebWorker-like files). These files commonly
  // reference `self`, `postMessage`, or `window`. Declaring these as readonly
  // reduces false positive `no-undef` reports without changing runtime behavior.
  {
    files: [
      // renderer and worker code
      'src/renderer/**',
      'src/**/workers/**',
      'src/**/worker*.ts',
      'src/**/worker*.js',
      'src/**/svgRasterWorker*.ts',
      'src/**/svgRasterWorker*.js',
      'src/simWorker.ts',
      'src/simWorker.js',
    ],
    languageOptions: {
      // browser/worker globals — spread the known browser globals and add
      // a few worker-specific names used in the repo.
      globals: {
        ...globals.browser,
        self: 'readonly',
        postMessage: 'readonly',
        structuredClone: 'readonly',
        window: 'readonly',
        // sometimes loader/bundler glue uses require or webpack public path
        require: 'readonly',
        __webpack_public_path__: 'readonly',
        process: 'readonly',
      },
    },
  },
  // ----- END worker / renderer / browser-like globals override -----

  // ----- START node / bundler / build-time globals override -----
  // Files that are executed at build-time or run in Node (scripts, env helpers,
  // bundler glue that uses `require` or `process` or __webpack_public_path__).
  // Make these Node-ish to avoid `no-undef` reports for legitimate usage.
  {
    files: [
      'scripts/**',
      'tools/**',
      'src/utils/env.ts',
      'src/utils/env.js',
      'src/**/build-*.ts',
      'src/**/build-*.js',
      'src/**/bundler-*.ts',
      'src/**/bundler-*.js',
      // include specific files that previously triggered no-undef
      'src/utils/**',
    ],
    languageOptions: {
      // Node/bundler helpers: reuse the node globals and add webpack-specific
      // glue as readonly.
      globals: {
        ...globals.node,
        __webpack_public_path__: 'readonly',
      },
    },
    // Some build-time / util files legitimately use CommonJS require or dynamic
    // imports; allow the use of require-style imports safely.
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // ----- END node / bundler / build-time globals override -----

  // Some core files legitimately reference build-time globals (process/require)
  // when they gate behavior or read env vars during startup. Add a conservative
  // override for core to avoid spurious no-undef errors while keeping checks
  // strict elsewhere.
  {
    files: ['src/core/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        require: 'readonly',
        __webpack_public_path__: 'readonly',
      },
    },
  },

  // ----- START test files override -----
  // Tests often use globals provided by the test runner (describe, test, expect,
  // beforeEach, vi, etc.) and intentionally use flexible `any` or leave
  // variables unused in fixtures. Relax a few rules for files under `test/`
  // to reduce noise while keeping most checks active.
  {
    files: ['test/**', 'test/vitest/**'],
  plugins: { '@typescript-eslint': tsPlugin as unknown as any },
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Node-like globals used in some tests
        process: 'readonly',
        __dirname: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      // Do not fail the commit for unused test fixtures; emit warnings instead.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Tests commonly use looser typing; allow any in tests to avoid churn.
      '@typescript-eslint/no-explicit-any': 'off',
      // Tests sometimes redeclare globals via file-level comments; allow it here.
      '@typescript-eslint/no-redeclare': 'off',
      // Some tests intentionally use case declarations or empty blocks for fixtures.
      'no-case-declarations': 'off',
      'no-empty': 'off',
    },
  },
  // ----- END test files override -----
  // Core files contain many pragmatic patterns (try/catch wrappers, declaration
  // reuse, small empty-catch fallbacks). Provide a conservative rule relaxation
  // so lint focuses on real issues rather than idiomatic defensive guards.
  {
    files: ['src/core/**'],
    rules: {
      '@typescript-eslint/no-redeclare': 'off',
      // Allow empty catch blocks which are used as deliberate fallbacks in
      // environments where feature detection is required.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Some try/catch wrappers only add logging or recoverability in
      // edge cases; disable this rule in core where we intentionally log
      // and rethrow for better observability.
      'no-useless-catch': 'off',
    },
  },
  // simWorker sets the runtime webpack public path; allow assignment to this
  // global specifically for the worker bootstrap file.
  {
    files: ['src/simWorker.ts', 'src/simWorker.js'],
    languageOptions: {
      globals: {
        __webpack_public_path__: 'writable',
      },
    },
  },
  // Many config files use TypeScript declaration merging (exporting an
  // interface/type and a value with the same name). ESLint's core
  // `no-redeclare` and the TS-aware rule can be noisy for this pattern, so
  // allow declaration merging specifically in the `src/config` folder.
  {
    // Target only files that are clearly configuration definitions. Many of
    // these use a value + type with similar names for backward compatibility
    // (e.g. `interface Foo` + `const Foo = DefaultFoo`). Narrowing the glob
    // reduces the exposed surface for turning this rule off.
    files: ['src/config/**/*Config.{ts,js}'],
    rules: {
      // Keep the core rule off (not TS-aware) and disable the TS redeclare
      // check for these specific config files where declaration merging is
      // intentional and documented.
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'off',
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
