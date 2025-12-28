# Server Compression Configuration

## Overview

The SpaceAutoBattler deployment uses pre-compressed assets with both gzip and brotli compression to significantly reduce bundle delivery sizes. This is implemented via webpack plugins that generate compressed versions of assets during the production build.

## Implementation

### Webpack Configuration

The compression is configured in `webpack.config.mjs` using the `compression-webpack-plugin`:

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

The compressed files are uploaded to GitHub Pages as part of the deployment artifact. GitHub Pages' CDN automatically:

1. Detects the Accept-Encoding headers from client requests
2. Serves the appropriate compressed version (brotli preferred, gzip fallback)
3. Falls back to uncompressed files for clients that don't support compression

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

# Serve locally with compression support (requires http-server with compression)
npx http-server dist -g -b -c-1
```

## Maintenance

### Updating Compression Configuration

The compression configuration is in `webpack.config.mjs`. Key settings:

```javascript
new CompressionPlugin({
  filename: '[path][base].gz', // Output filename pattern
  algorithm: 'gzip', // or 'brotliCompress'
  test: /\.(js|css|html|svg|wasm)$/, // File types to compress
  threshold: 10240, // 10KB minimum file size
  minRatio: 0.8, // 80% compression ratio minimum
  deleteOriginalAssets: false, // Keep uncompressed files
});
```

### Troubleshooting

**Compressed files not generated?**

- Check that `isProd` is true (production mode)
- Verify files meet the size threshold (>10KB)
- Ensure compression ratio meets minimum (better than 80%)

**Compressed files not served?**

- GitHub Pages automatically handles this
- Client must send `Accept-Encoding: gzip, br` header
- Check DevTools Network tab for `content-encoding` response header

**Bundle size still too large?**

- Consider code splitting for larger features
- Review and optimize dependencies
- Use dynamic imports for infrequently used modules

## References

- [compression-webpack-plugin Documentation](https://webpack.js.org/plugins/compression-webpack-plugin/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Brotli Compression Specification](https://tools.ietf.org/html/rfc7932)
