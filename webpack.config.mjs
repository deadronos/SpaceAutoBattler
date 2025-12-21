import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import webpack from 'webpack';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { defineReactCompilerLoaderOption, reactCompilerLoader } from 'react-compiler-webpack';
import CompressionPlugin from 'compression-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Capture env flag once to avoid referencing `process` inline in the config object
const VITEST_DEBUG_BENCH = typeof process !== 'undefined' && Boolean(process.env && process.env.VITEST_DEBUG_BENCH);

export default (env = {}, argv) => {
  const isProd = argv.mode === 'production';
  const shouldAnalyze = env.ANALYZE === 'true' || env.ANALYZE === true;

  // Build a list of paths to exclude from reactCompiler transforms. This
  // can be overridden via REACT_COMPILER_EXCLUDE env var (comma-separated,
  // relative to repo root). Defaults to renderer and ship components.
  const defaultExcludes = [
    path.resolve(__dirname, 'src', 'renderer'),
    path.resolve(__dirname, 'src', 'components', 'ship')
  ];
  const envExcludes = (process.env.REACT_COMPILER_EXCLUDE || '').split(',').map(s => s.trim()).filter(Boolean);
  const excludedPaths = envExcludes.length > 0 ? envExcludes.map(p => path.resolve(__dirname, p)) : defaultExcludes;

  // Build a list of paths to explicitly include for reactCompiler transforms. This
  // can be useful for targeting specific files or directories. If present, only
  // these paths will be considered for transformation by the reactCompiler.
  const envIncludes = (process.env.REACT_COMPILER_INCLUDE || '').split(',').map(s => s.trim()).filter(Boolean);
  const includePaths = envIncludes.length > 0 ? envIncludes.map(p => path.resolve(__dirname, p)) : null;

  // Helpers used for rules
  const excludedMatcher = (p) => excludedPaths.some(ep => p.startsWith(ep));
  const includedMatcher = (p) => includePaths ? includePaths.some(ip => p.startsWith(ip)) : false;

  return {
    mode: isProd ? 'production' : 'development',
    entry: {
      main: path.resolve(__dirname, 'src', 'main.tsx')
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? '[name].[contenthash].js' : '[name].js',
      clean: true,
      publicPath: './'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      // Prefer ESM 'module' entry points so examples/jsm and main imports resolve to the same build
      mainFields: ['module', 'browser', 'main'],
      alias: {
        // force all imports of 'three' to the same package entry (resolve to node_modules/three)
        three: path.resolve(__dirname, 'node_modules', 'three')
      }
    },
    module: {
      rules: [
        // Rule A: avoid running reactCompilerLoader on explicitly excluded files
        {
          test: /\.tsx?$/,
          include: excludedPaths,
          use: [
            { loader: 'ts-loader', options: { transpileOnly: true } }
          ],
          exclude: /node_modules/
        },
        // Rule B: apply reactCompilerLoader for the rest of the codebase
        {
          test: /\.tsx?$/,
          // If explicit REACT_COMPILER_INCLUDE is provided, only transform those paths
          ...(includePaths ? { include: includePaths } : { exclude: [ ...excludedPaths, /node_modules/ ] }),
           use: [
             { loader: 'ts-loader', options: { transpileOnly: true } },
             { loader: reactCompilerLoader, options: defineReactCompilerLoaderOption({
               // minimal options; keep the transform conservative while we test
               reactRuntime: 'automatic',
               // preserve JSX primitives and object identity where possible
               preservePrimitives: true
             }) }
           ]
        },
        {
          test: /\.css$/i,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        }
        ,
        {
          test: /\.(glsl|vs|fs)$/i,
          type: 'asset/source'
        },
        {
          test: /\.(glb|gltf)$/i,
          type: 'asset/resource',
          // Include a separator before the contenthash for readability and
          // consistency with other emitted assets.
          generator: {
            filename: 'models/[name].[contenthash][ext]'
          }
        },
        // Emit common image types as resources so textures referenced by
        // external .gltf files or other imports are emitted and URL-resolved.
        {
          test: /\.(png|jpe?g|webp|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name].[contenthash][ext]'
          }
        },
        // Emit .bin sidecar files (used by some .gltf) so they end up next
        // to other model assets and can be loaded at runtime.
        {
          test: /\.bin$/i,
          type: 'asset/resource',
          generator: {
            filename: 'models/[name].[contenthash][ext]'
          }
        },
        // Emit any imported .wasm files as resources so they end up in dist/wasm/
        {
          test: /\.wasm$/,
          type: 'asset/resource',
          // Add contenthash to wasm files for cache-busting consistency.
          generator: {
            filename: 'wasm/[name].[contenthash][ext]'
          }
        }
      ]
    },
    plugins: [
  // extract CSS imported from TS into separate hashed file
  new MiniCssExtractPlugin({ filename: isProd ? 'styles/[name].[contenthash].css' : 'styles/[name].css' }),
  new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'src', 'ui.html'),
        filename: 'spaceautobattler.html',
        inject: 'body'
      }),
  // Copy optional static assets when present.
  ...createCopyPlugins(),
  // optional analyzer
  ...(shouldAnalyze ? [new BundleAnalyzerPlugin()] : []),
      // Define compile-time environment flags so browser bundles don't reference `process` at runtime
      new webpack.DefinePlugin({
        __VITEST_DEBUG_BENCH__: JSON.stringify(VITEST_DEBUG_BENCH),
        'process.env.VITEST_DEBUG_BENCH': JSON.stringify(VITEST_DEBUG_BENCH)
      }),
      // Replace internal .js import specifiers with .ts but only when the importer is in our src/ tree.
      // This prevents rewriting third-party package imports (for example three) which might import
      // './something.js' internally but do not ship .ts sources.
      new webpack.NormalModuleReplacementPlugin(/\.js$/, (resource) => {
        try {
          const req = resource.request || '';
          const issuerDir = resource.context || '';
          const srcDir = path.resolve(__dirname, 'src');
          // Only rewrite relative imports (./ or ../) when the importing module lives under src/
          // and the request does NOT reference node_modules (avoid rewriting package internals)
          if (
            (req.startsWith('./') || req.startsWith('../')) &&
            req.endsWith('.js') &&
            issuerDir.startsWith(srcDir) &&
            !req.includes('node_modules')
          ) {
            const tsxCandidate = path.resolve(issuerDir, req.replace(/\.js$/, '.tsx'));
            if (fs.existsSync(tsxCandidate)) {
              resource.request = req.replace(/\.js$/, '.tsx');
            } else {
              resource.request = req.replace(/\.js$/, '.ts');
            }
          }
        } catch {
          // swallow; keep original request if anything goes wrong
        }
      }),
      new ForkTsCheckerWebpackPlugin({
        async: false,
        typescript: {
          configFile: path.resolve(__dirname, 'tsconfig.json')
        }
      }),
      // Add gzip and brotli compression for production builds
      ...(isProd ? [
        new CompressionPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.(js|css|html|svg|wasm)$/,
          threshold: 10240, // Only compress files larger than 10KB
          minRatio: 0.8, // Only compress if compression ratio is better than 80%
          deleteOriginalAssets: false
        }),
        new CompressionPlugin({
          filename: '[path][base].br',
          algorithm: 'brotliCompress',
          test: /\.(js|css|html|svg|wasm)$/,
          threshold: 10240,
          minRatio: 0.8,
          deleteOriginalAssets: false
        })
      ] : [])
    ],
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          rapier: {
            test: /[\\/]node_modules[\\/]@dimforge[\\/]rapier3d-compat[\\/]/,
            name: 'rapier',
            chunks: 'all',
            priority: 40
          },
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'three',
            chunks: 'all',
            priority: 30
          },
          postprocessing: {
            test: /[\\/]node_modules[\\/]postprocessing[\\/]/,
            name: 'postprocessing',
            chunks: 'all',
            priority: 20
          },
          vendors: {
            test: (module) => {
              const resource = module && module.resource;
              if (typeof resource !== 'string') return false;
              if (!resource.includes(`${path.sep}node_modules${path.sep}`)) return false;
              return !resource.includes(`${path.sep}@dimforge${path.sep}rapier3d-compat${path.sep}`);
            },
            name: 'vendors',
            chunks: 'all',
            priority: -10
          }
        }
      }
    },
    // Enable async WebAssembly so dynamic WASM imports (used by Rapier builds)
    // are supported and properly emitted by webpack 5.
    experiments: {
      asyncWebAssembly: true
    },
    devtool: isProd ? false : 'source-map',
    devServer: {
      static: path.resolve(__dirname, 'dist'),
      compress: true,
      port: 8080,
      open: false
    }
};
};

function createCopyPlugins() {
  const patterns = [];
  const legacyAssets = path.resolve(__dirname, 'src', 'config', 'assets');
  if (fs.existsSync(legacyAssets)) {
    patterns.push({ from: legacyAssets, to: path.posix.join('src', 'config', 'assets') });
  }

  const staticAssets = path.resolve(__dirname, 'src', 'assets', 'static');
  if (fs.existsSync(staticAssets)) {
    patterns.push({ from: staticAssets, to: path.posix.join('assets') });
  }

  if (patterns.length === 0) {
    return [];
  }

  return [new CopyWebpackPlugin({ patterns })];
}
