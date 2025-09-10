This project uses webpack to build the application and emit worker bundles.

Key points

- HTML output: `dist/spaceautobattler.html` (generated from `index.html` via HtmlWebpackPlugin)
- Main bundle: `dist/main.[hash].js` (or `main.js` in dev)
- Workers: emitted to `dist/workers/` as `simWorker.[hash].js` (or `simWorker.js` in dev)

How to import the worker in TypeScript (recommended Webpack 5 pattern)

Use the native URL-based import which is the recommended modern approach with Webpack 5:

```ts
// Create a worker from a module file where Webpack will emit the worker as a separate chunk
const simWorker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });

// Use simWorker.postMessage / onmessage as usual
```

Why this pattern?

- It uses the browser-native Worker construction and lets Webpack emit the worker as a chunk (configured through `output.chunkFilename`).
- No third-party loader is needed (no `worker-loader` required).
- Works well with TypeScript when `ts-loader` compiles worker sources.

Notes

- Filenames include contenthash in production to support long-term caching. The emitted worker files will be placed under the `workers/` chunk folder per `webpack.config.js`.
- If TypeScript complains about importing worker modules, keep `src/types/worker.d.ts` which declares `.worker`/worker module shapes.
