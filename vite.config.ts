import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import reactCompiler from 'babel-plugin-react-compiler';
import compression from 'vite-plugin-compression';

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

          if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.gif' || ext === '.svg') {
            return isProd ? 'assets/images/[name].[hash][extname]' : 'assets/images/[name][extname]';
          }

          return isProd ? 'assets/[name].[hash][extname]' : 'assets/[name][extname]';
        },
        manualChunks: createManualChunks,
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const projectRoot = process.cwd();
  const srcDir = path.resolve(projectRoot, 'src');

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
      return includedPaths.some((p) => cleanId.startsWith(p));
    }

    return !excludedPaths.some((p) => cleanId.startsWith(p));
  };

  const vitestDebugBench = Boolean(process.env.VITEST_DEBUG_BENCH);

  return {
    base: './',
    assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin', '**/*.wasm'],
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
          entryFileNames: isProd ? 'workers/[name].[hash].js' : 'workers/[name].js',
          chunkFileNames: isProd ? 'workers/[name].[hash].js' : 'workers/[name].js',
        },
      },
    },
    build: createOutputConfig(isProd),
  };
});
