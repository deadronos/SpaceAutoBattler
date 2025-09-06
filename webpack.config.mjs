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
      main: path.resolve(__dirname, 'src', 'main.ts')
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? 'workers/[name].[contenthash].js' : 'workers/[name].js',
      clean: true,
      publicPath: './'
    },
    resolve: {
      extensions: ['.ts', '.js'],
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
          test: /\.ts$/,
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
  // Copy only static assets used at runtime by workers or fetchers (SVGs, images)
  // Preserve both a short `/assets/` path and the original `/src/config/assets/` path
  // because some runtime code (workers) fetch the original path directly.
  new CopyWebpackPlugin({ patterns: [
    { from: path.resolve(__dirname, 'src', 'config', 'assets'), to: path.posix.join('src', 'config', 'assets') }
  ] }),
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
            resource.request = req.replace(/\.js$/, '.ts');
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
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: -10
          }
        }
      }
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
