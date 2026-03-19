import fs from 'fs';
import path from 'path';
import globals from 'globals';
import { defineConfig, type Plugin, type UserConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import reactCompiler from 'babel-plugin-react-compiler';
import compressionPlugin from 'vite-plugin-compression';

const compression = compressionPlugin as unknown as (options: Record<string, unknown>) => Plugin;

function createJsToTsResolvePlugin(): Plugin {
  const srcDir = path.resolve(process.cwd(), 'src');

  return {
    name: 'spaceautobattler:resolve-relative-js-to-ts',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer) return null;
      if (!source) return null;

      if (!(source.startsWith('./') || source.startsWith('../'))) return null;
      if (!source.endsWith('.js')) return null;
      if (source.includes('?') || source.includes('#')) return null;

      const importerPath = importer.split('?')[0];
      if (!importerPath) return null;
      if (!importerPath.startsWith(srcDir)) return null;
      if (importerPath.includes(`${path.sep}node_modules${path.sep}`)) return null;

      const absJsPath = path.resolve(path.dirname(importerPath), source);
      const absTsxPath = absJsPath.replace(/\.js$/, '.tsx');
      if (fs.existsSync(absTsxPath)) return absTsxPath;

      const absTsPath = absJsPath.replace(/\.js$/, '.ts');
      if (fs.existsSync(absTsPath)) return absTsPath;

      return null;
    },
  };
}

function createGlslRawPlugin(): Plugin {
  return {
    name: 'spaceautobattler:glsl-as-string',
    enforce: 'pre',
    load(id) {
      const filePath = id.split('?')[0];
      if (!filePath) return null;
      if (!filePath.endsWith('.glsl')) return null;

      const source = fs.readFileSync(filePath, 'utf8');
      return `export default ${JSON.stringify(source)};`;
    },
  };
}

function createManualChunks(id: string): string | undefined {
  if (!id.includes(`${path.sep}node_modules${path.sep}`)) return undefined;

  if (id.includes(`${path.sep}@dimforge${path.sep}rapier3d-compat${path.sep}`)) return 'rapier';
  if (id.includes(`${path.sep}three${path.sep}`)) return 'three';
  if (id.includes(`${path.sep}postprocessing${path.sep}`)) return 'postprocessing';

  return 'vendors';
}

function createOutputConfig(isProd: boolean): UserConfig['build'] {
  return {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: !isProd,
    rollupOptions: {
      input: {
        index: path.resolve(process.cwd(), 'index.html'),
        spaceautobattler: path.resolve(process.cwd(), 'spaceautobattler.html'),
      },
      output: {
        entryFileNames: isProd ? '[name].[hash].js' : '[name].js',
        chunkFileNames: isProd ? '[name].[hash].js' : '[name].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? '';
          const ext = path.extname(name).toLowerCase();

          if (ext === '.css') {
            return isProd ? 'styles/[name].[hash][extname]' : 'styles/[name][extname]';
          }

          if (ext === '.wasm') {
            return isProd ? 'wasm/[name].[hash][extname]' : 'wasm/[name][extname]';
          }

          if (ext === '.glb' || ext === '.gltf' || ext === '.bin') {
            return isProd ? 'models/[name].[hash][extname]' : 'models/[name][extname]';
          }

          if (
            ext === '.png' ||
            ext === '.jpg' ||
            ext === '.jpeg' ||
            ext === '.webp' ||
            ext === '.gif' ||
            ext === '.svg'
          ) {
            return isProd
              ? 'assets/images/[name].[hash][extname]'
              : 'assets/images/[name][extname]';
          }

          return isProd ? 'assets/[name].[hash][extname]' : 'assets/[name][extname]';
        },
        manualChunks: createManualChunks,
      },
    },
  };
}

const sharedIgnorePatterns = [
  'node_modules/**',
  'dist/**',
  'coverage/**',
  '.cache/**',
  'test-output/**',
  'playwright-report/**',
  'tmp/**',
  '.vite-hooks/**',
  'scripts/**',
  'test/**',
  'src/types/**/*.d.ts',
];

const fmtConfig = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  sortPackageJson: false,
  ignorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    '.cache',
    '.serena',
    '.vscode',
    'test-output',
    'playwright-report',
    'tmp',
    '.vite-hooks',
    '*.code-workspace',
    '*.min.js',
    '*.bundle.js',
    'temp-lint-main.json',
  ],
};

const lintConfig = {
  plugins: ['oxc', 'typescript', 'unicorn', 'react'],
  categories: {
    correctness: 'warn',
  },
  env: {
    builtin: true,
  },
  ignorePatterns: sharedIgnorePatterns,
  options: {
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx,mts,cts}'],
      rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-redeclare': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['src/core/**/*.{ts,tsx,js,jsx}'],
      rules: {
        'no-restricted-properties': [
          'error',
          {
            object: 'Math',
            property: 'random',
            message: 'Use GameState.rng.next() for determinism',
          },
        ],
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-useless-catch': 'off',
        'no-redeclare': 'off',
      },
    },
    {
      files: [
        'src/renderer/**',
        'src/**/workers/**',
        'src/**/worker*.ts',
        'src/**/worker*.js',
        'src/**/svgRasterWorker*.ts',
        'src/**/svgRasterWorker*.js',
        'src/simWorker.ts',
        'src/simWorker.js',
      ],
      globals: {
        ...globals.browser,
        self: 'readonly',
        postMessage: 'readonly',
        structuredClone: 'readonly',
        require: 'readonly',
        __webpack_public_path__: 'readonly',
        process: 'readonly',
      },
    },
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
        'src/utils/**',
      ],
      globals: {
        ...globals.node,
        __webpack_public_path__: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['src/core/**'],
      globals: {
        ...globals.node,
        process: 'readonly',
        require: 'readonly',
        __webpack_public_path__: 'readonly',
      },
    },
    {
      files: ['src/simWorker.ts', 'src/simWorker.js'],
      globals: {
        __webpack_public_path__: 'writable',
      },
    },
    {
      files: ['src/config/**/*Config.{ts,tsx,js,jsx}'],
      rules: {
        'no-redeclare': 'off',
      },
    },
    {
      files: ['test/**/*.{ts,tsx,js,jsx}'],
      globals: {
        ...globals.node,
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-case-declarations': 'off',
        'no-empty': 'off',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-redeclare': 'off',
      },
    },
  ],
};

const stagedConfig = {
  '**/*.{ts,tsx,js,jsx,json,css,md}': ['vp fmt', 'vp lint --fix'],
};

const projectRoot = process.cwd();
const srcDir = path.resolve(projectRoot, 'src');
const isBuildCommand = process.argv.includes('build');
const isDevelopmentBuild = process.argv.some(
  (value, index, values) => value === '--mode' && values[index + 1] === 'development',
);
const isProdBuild = isBuildCommand && !isDevelopmentBuild;

const defaultExcluded = [
  path.resolve(srcDir, 'renderer'),
  path.resolve(srcDir, 'components', 'ship'),
];

const envExcludes = (process.env.REACT_COMPILER_EXCLUDE ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((relative) => path.resolve(projectRoot, relative));

const envIncludes = (process.env.REACT_COMPILER_INCLUDE ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((relative) => path.resolve(projectRoot, relative));

const excludedPaths = envExcludes.length > 0 ? envExcludes : defaultExcluded;
const includedPaths = envIncludes.length > 0 ? envIncludes : null;

const shouldApplyReactCompiler = (id: string): boolean => {
  const cleanId = id.split('?')[0];
  if (!cleanId) return false;
  if (!cleanId.startsWith(srcDir)) return false;
  if (!cleanId.endsWith('.ts') && !cleanId.endsWith('.tsx')) return false;

  if (includedPaths) {
    return includedPaths.some((includedPath) => cleanId.startsWith(includedPath));
  }

  return !excludedPaths.some((excludedPath) => cleanId.startsWith(excludedPath));
};

const vitestDebugBench = Boolean(process.env.VITEST_DEBUG_BENCH);

export default defineConfig({
  fmt: fmtConfig,
  lint: lintConfig,
  staged: stagedConfig,
  base: './',
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin', '**/*.wasm', '**/*.glsl'],
  plugins: [
    createJsToTsResolvePlugin(),
    createGlslRawPlugin(),
    react({
      babel: (id) => {
        if (!shouldApplyReactCompiler(id)) return {};

        return {
          plugins: [
            [
              reactCompiler,
              {
                reactRuntime: 'automatic',
                preservePrimitives: true,
              },
            ],
          ],
        };
      },
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10 * 1024,
      deleteOriginFile: false,
      filter: /\.(js|mjs|css|html|svg|wasm)$/i,
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10 * 1024,
      deleteOriginFile: false,
      filter: /\.(js|mjs|css|html|svg|wasm)$/i,
    }),
  ],
  resolve: {
    alias: {
      three: path.resolve(projectRoot, 'node_modules', 'three'),
    },
  },
  define: {
    __VITEST_DEBUG_BENCH__: JSON.stringify(vitestDebugBench),
    'process.env.VITEST_DEBUG_BENCH': JSON.stringify(vitestDebugBench),
  },
  test: {
    include: ['test/**/*.{spec,test}.{ts,tsx}'],
    exclude: ['test/playwright/**'],
    environment: 'happy-dom',
    setupFiles: path.resolve(projectRoot, 'test/vitest/setupTests.ts'),
    globals: true,
    watch: false,
    testTimeout: 20000,
    pool: 'threads',
    maxThreads: 24,
    threads: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
  server: {
    port: 8080,
    strictPort: true,
  },
  preview: {
    port: 8080,
    strictPort: true,
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: isProdBuild ? 'workers/[name].[hash].js' : 'workers/[name].js',
        chunkFileNames: isProdBuild ? 'workers/[name].[hash].js' : 'workers/[name].js',
      },
    },
  },
  build: createOutputConfig(isProdBuild),
});
