import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Capture env flag once to avoid referencing `process` inline in the config object
const VITEST_DEBUG_BENCH = typeof process !== 'undefined' && Boolean(process.env && process.env.VITEST_DEBUG_BENCH);

export default (env = {}, argv) => {
  const isProd = argv.mode === 'production';
  const shouldAnalyze = env.ANALYZE === 'true' || env.ANALYZE === true;
  return {
    mode: isProd ? 'production' : 'development',
    entry: {
      main: path.resolve(__dirname, 'src', 'main.tsx')
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? 'workers/[name].[contenthash].js' : 'workers/[name].js',
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
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
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
      })
    ],
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Instead of extracting Rapier into its own shared chunk, prefer
          // bundling Rapier into the same chunk that imports it (for example
          // the sim worker chunk). This avoids cross-chunk initialization
          // ordering issues where Rapier's runtime may not be fully ready
          // when a different chunk tries to use it.
          rapierInImporterChunk: {
            test: /[\\/]node_modules[\\/]@dimforge[\\/]rapier3d-compat[\\/]/,
            // Use the importing chunk's name when available so rapier ends up
            // in the same emitted file as the importer (worker).
            name(module, chunks, cacheGroupKey) {
              try {
                if (Array.isArray(chunks) && chunks.length > 0) {
                  // Prefer the first chunk's name if present
                  const first = chunks.find((c) => typeof c.name === 'string' && c.name.length > 0);
                  if (first && typeof first.name === 'string') return first.name;
                }
              } catch (_e) {
                /* ignore and fall back */
              }
              // Fallback name: keep rapier as a dedicated chunk if necessary
              return cacheGroupKey;
            },
            chunks: 'all',
            priority: 60,
            enforce: true,
            reuseExistingChunk: true
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
            test: /[\\/]node_modules[\\/]/,
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
