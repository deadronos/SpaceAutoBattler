# Server Compression Configuration

## Overview

SpaceAutoBattler can generate pre-compressed assets with both gzip and brotli compression to reduce bundle delivery sizes. This is implemented via Vite build plugins that emit `.gz` and `.br` files alongside the original assets during a production build.

## Implementation

### Vite Configuration

The compression is configured in `vite.config.ts` using `vite-plugin-compression`:

- **Gzip compression**: Generates `.gz` files alongside original assets
- **Brotli compression**: Generates `.br` files alongside original assets
- **Threshold**: Only files larger than 10KB are compressed
- **Compression ratio**: Only compress if achieving better than 80% of original size
- **File types**: JavaScript (`.js`), CSS (`.css`), HTML (`.html`), SVG (`.svg`), and WebAssembly (`.wasm`) files

### Build Process

During production builds (`npm run build`), the compression plugins automatically:

1. Process all eligible files in the output directory
2. Generate compressed versions with `.gz` and `.br` extensions
3. Keep the original uncompressed files
4. Include all files in the deployment artifact

### Deployment

Whether clients actually receive the pre-compressed files depends on your hosting/CDN configuration. Many hosts compress responses automatically, but serving pre-compressed `*.br` / `*.gz` assets often requires explicit configuration.

## Compression Results

### Measured Compression Ratios (v0.1.0)

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
3. Select a JavaScript file (e.g., `main.[hash].js`)
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

The compression configuration is in `vite.config.ts`. Key settings:

```javascript
compression({
  algorithm: 'gzip',
  ext: '.gz',
  threshold: 10 * 1024,
  deleteOriginFile: false,
  filter: /\.(js|mjs|css|html|svg|wasm)$/i,
});
```

### Troubleshooting

**Compressed files not generated?**

- Check that `isProd` is true (production mode)
- Verify files meet the size threshold (>10KB)
- Ensure compression ratio meets minimum (better than 80%)

**Compressed files not served?**

- Client must send `Accept-Encoding: gzip, br` header
- Your server/CDN must be configured to serve pre-compressed `*.br` / `*.gz` (or compress dynamically)
- Check DevTools Network tab for `content-encoding` response header

**Bundle size still too large?**

- Consider code splitting for larger features
- Review and optimize dependencies
- Use dynamic imports for infrequently used modules

## References

- [vite-plugin-compression](https://github.com/vbenjs/vite-plugin-compression)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Brotli Compression Specification](https://tools.ietf.org/html/rfc7932)
