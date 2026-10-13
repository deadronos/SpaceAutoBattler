# Server Compression Configuration

## Overview

SpaceAutoBattler can generate pre-compressed assets with both gzip and brotli compression to reduce bundle delivery sizes. This is implemented via a local, dependency-free Vite build plugin that emits `.gz` and `.br` files alongside the original assets during a production build.

## Implementation

### Vite Configuration

The compression is configured in `vite.config.ts` using a local `node:zlib` plugin (`spaceautobattler:precompress-assets`), which emits both formats in a single `closeBundle` pass:

- **Gzip compression**: Generates `.gz` files alongside original assets
- **Brotli compression**: Generates `.br` files alongside original assets
- **Threshold**: Only files of at least 10KB are compressed
- **File types**: JavaScript (`.js`, `.mjs`), CSS (`.css`), HTML (`.html`), SVG (`.svg`), WebAssembly (`.wasm`), and pre-binary assets (`.glb`, `.gltf`, `.bin`) — GLB/GLTF/BIN models are compressed as well
- **Originals**: Kept in place (compressed files are written alongside them)

The plugin walks the `dist` output directory recursively, so nested chunks and assets are compressed too. It replaces the previous two `vite-plugin-compression` instances: those shared a module-level `mtimeCache`, which caused the brotli instance to skip files the gzip instance had already processed, so no `.br` assets were emitted.

### Build Process

During production builds (`npm run build`), the compression plugin automatically:

1. Process all eligible files in the output directory
2. Generate compressed versions with `.gz` and `.br` extensions
3. Keep the original uncompressed files
4. Include all files in the deployment artifact

### Deployment

Whether clients actually receive the pre-compressed files depends on your hosting/CDN configuration. Many hosts compress responses automatically, but serving pre-compressed `*.br` / `*.gz` assets often requires explicit configuration.

### SharedArrayBuffer (Cross-Origin Isolation)

The simulation worker can use a `SharedArrayBuffer` (SAB) transport when the page is cross-origin isolated. The bridge selects the SAB path only when `crossOriginIsolated === true`; otherwise it falls back to the transfer-buffer path, which is always available.

Browsers only expose `SharedArrayBuffer` when the hosting layer sends both:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These headers are set in `vite.config.ts` for both `server` (dev) and `preview`, and in `scripts/e2e-static-server.mjs` for every response, so local dev, preview, and E2E runs are cross-origin isolated.

**Known limitation:** GitHub Pages cannot set custom response headers, so the GitHub Pages deployment is **not** cross-origin isolated and production keeps using the transfer-buffer fallback. If production SAB is required, host on a platform that lets you configure COOP/COEP (or set them at the CDN edge) and re-check `crossOriginIsolated === true` plus `window.__SAB.getWorkerStatus().usingShared === true` (with `?sim_worker=1`) on the deployed page.

## Compression Results

### Measured Compression Ratios (v0.1.0) — historical

> **Historical snapshot.** These figures were captured for the v0.1.0 build and
> the bundle layout has changed since (see
> [`performance-report.md`](./performance-report.md) for the current chunk sizes).
> Treat the ratios as illustrative of the plugin's behavior rather than current
> numbers.

**Main Bundle:**

- Uncompressed: 248 KiB
- Gzip: 75 KiB (70.0% reduction)
- Brotli: 58 KiB (80.0% reduction)

**Vendors Bundle:**

- Uncompressed: 3.1 MiB
- Gzip: 964 KiB (70.0% reduction)
- Brotli: 637 KiB (80.0% reduction)

**Rapier Physics Bundle:**

- Uncompressed: 2.2 MiB
- Gzip: 811 KiB (70.0% reduction)
- Brotli: 601 KiB (80.0% reduction)

**Three.js Bundle:**

- Uncompressed: 762 KiB
- Gzip: 194 KiB (80.0% reduction)
- Brotli: 156 KiB (80.0% reduction)

**CSS Styles:**

- Uncompressed: 22 KiB
- Gzip: 4.5 KiB (80.0% reduction)
- Brotli: 3.8 KiB (83.0% reduction)

### Total Bundle Sizes

- **Uncompressed**: 6.2 MiB
- **With Gzip**: 2.0 MiB (70.0% reduction)
- **With Brotli**: 1.5 MiB (80.0% reduction)

## Performance Impact

### Network Transfer

The compression reduces the total JavaScript bundle size from **6.2 MiB to 1.5 MiB** with brotli (or 2.0 MiB with gzip), resulting in:

- **Faster initial page loads**: Especially beneficial for users on slower connections
- **Reduced bandwidth costs**: Lower data transfer for both users and hosting
- **Improved Time to Interactive (TTI)**: Less data to download before application starts

### Browser Support

- **Brotli**: Supported by all modern browsers (Chrome 50+, Firefox 44+, Edge 15+, Safari 11+)
- **Gzip**: Universal support across all browsers
- **Fallback**: Uncompressed files served to very old browsers (extremely rare)

## Verification

### Verify Compression in Production

To verify compression is working in production:

1. Open DevTools Network tab
2. Navigate to the deployed site
3. Select a JavaScript file (e.g., `spaceautobattler.[hash].js`)
4. Check the Response Headers for `content-encoding: br` or `content-encoding: gzip`
5. Compare the "Size" column (transferred) with "Content" column (uncompressed)

### Local Testing

To test compression locally:

```bash
# Build with compression
npm run build

# Check for compressed files
ls -lh dist/*.js.gz
ls -lh dist/*.js.br

# Serve locally
npm run preview
```

## Maintenance

### Updating Compression Configuration

The compression configuration is in `vite.config.ts`. Key settings live in `createPrecompressPlugin()`:

```javascript
const compressibleFilePattern = /\.(js|mjs|css|html|svg|wasm|glb|gltf|bin)$/i;
const sizeThreshold = 10 * 1024;
```

To add a file type, extend `compressibleFilePattern`. To change the minimum size, update `sizeThreshold`.

### CI Verification

The Unit Tests workflow (`.github/workflows/unit-tests.yml`) runs a production build and asserts that both formats are emitted:

```bash
vp build
BR_COUNT=$(find dist -name '*.br' | wc -l | xargs)
GZ_COUNT=$(find dist -name '*.gz' | wc -l | xargs)
test "$BR_COUNT" -gt 0
test "$GZ_COUNT" -gt 0
```

If either count is zero the job fails, catching regressions such as the shared `mtimeCache` bug that previously produced no `.br` files.

### Troubleshooting

**Compressed files not generated?**

- Check that the build ran in production mode
- Verify files meet the size threshold (>=10KB)
- Ensure the file extension matches `compressibleFilePattern`

**Compressed files not served?**

- Client must send `Accept-Encoding: gzip, br` header
- Your server/CDN must be configured to serve pre-compressed `*.br` / `*.gz` (or compress dynamically)
- Check DevTools Network tab for `content-encoding` response header

**Bundle size still too large?**

- Consider code splitting for larger features
- Review and optimize dependencies
- Use dynamic imports for infrequently used modules

## References

- [Node.js zlib documentation](https://nodejs.org/api/zlib.html)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Brotli Compression Specification](https://tools.ietf.org/html/rfc7932)
