import fs from 'fs';
import path from 'path';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { defineConfig, type Plugin, type UserConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import reactCompiler from 'babel-plugin-react-compiler';

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

          // Self-hosted glTF decoders must keep stable, unhashed filenames because the
          // loaders fetch them by fixed name from the derived `decoders/` directory.
          if (/^(draco_|basis_transcoder)/.test(name)) return `decoders/${name}`;

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

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

function createPrecompressPlugin(): Plugin {
  const compressibleFilePattern = /\.(js|mjs|css|html|svg|wasm|glb|gltf|bin)$/i;
  const sizeThreshold = 10 * 1024;

  async function collectFiles(dir: string): Promise<string[]> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectFiles(entryPath);
        return Promise.resolve(entry.isFile() ? [entryPath] : []);
      }),
    );

    return nested.flat();
  }

  return {
    name: 'spaceautobattler:precompress-assets',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const distDir = path.resolve(projectRoot, 'dist');
      if (!fs.existsSync(distDir)) return;

      const files = await collectFiles(distDir);
      await Promise.all(
        files
          .filter((file) => compressibleFilePattern.test(file))
          .map(async (file) => {
            const source = await fs.promises.readFile(file);
            if (source.byteLength < sizeThreshold) return;

            const [gzipped, brotlied] = await Promise.all([
              gzipAsync(source),
              brotliCompressAsync(source, {
                params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
              }),
            ]);

            await Promise.all([
              fs.promises.writeFile(`${file}.gz`, gzipped),
              fs.promises.writeFile(`${file}.br`, brotlied),
            ]);
          }),
      );
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
  // Not linted yet: enabling these surfaces ~35 type errors and ~100 warnings to clean up first.
  // The `scripts/**` and `test/**` overrides below take effect once they are removed from here.
  'scripts/**',
  'test/**',
  'src/types/**/*.d.ts',
];

const fmtConfig: UserConfig['fmt'] = {
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

const lintConfig: UserConfig['lint'] = {
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
      files: ['src/renderer/**', 'src/worker/**'],
      env: { browser: true, worker: true },
    },
    {
      files: ['scripts/**'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['test/**/*.{ts,tsx,js,jsx}'],
      env: { node: true, vitest: true },
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

const stagedConfig: UserConfig['staged'] = {
  'src/**/*.{ts,tsx,js,jsx,css}': ['vp fmt', 'vp lint --fix'],
  'test/**/*.{ts,tsx,js,jsx}': ['vp fmt'],
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['vp fmt'],
  '**/*.json': ['vp fmt'],
  '**/*.md': ['vp fmt'],
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

// SharedArrayBuffer requires the page to be cross-origin isolated. Send COOP/COEP on
// both the dev server and the preview server so `crossOriginIsolated === true` locally.
// GitHub Pages cannot set custom headers, so production stays on the transfer-buffer
// fallback; see docs/compression.md.
const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  fmt: fmtConfig,
  lint: lintConfig,
  staged: stagedConfig,
  base: './',
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin', '**/*.wasm', '**/*.glsl', '**/*.ktx2'],
  plugins: [
    createJsToTsResolvePlugin(),
    createGlslRawPlugin(),
    react(),
    babel({
      include: /\.(?:ts|tsx)$/,
      plugins: [
        [reactCompiler, { compilationMode: 'annotation', sources: shouldApplyReactCompiler }],
      ],
    }),
    createPrecompressPlugin(),
  ],
  resolve: {
    alias: {
      three: path.resolve(projectRoot, 'node_modules', 'three'),
    },
  },
  define: {
    __VITEST_DEBUG_BENCH__: JSON.stringify(vitestDebugBench),
    'process.env.VITEST_DEBUG_BENCH': JSON.stringify(vitestDebugBench),
    ...(isDevelopmentBuild ? { 'import.meta.env.DEV': 'true' } : {}),
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
  server: {
    port: 8080,
    strictPort: true,
    headers: crossOriginHeaders,
  },
  preview: {
    port: 8080,
    strictPort: true,
    headers: crossOriginHeaders,
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
