# Post-Deployment Verification Checklist

This checklist should be completed after deploying a new version to GitHub Pages to verify compression is working correctly.

## Automated Verification

Run the verification script:

```bash
node scripts/verify-compression.mjs
```

Expected output should show `content-encoding: br` or `content-encoding: gzip` headers.

## Manual Browser Verification

### Step 1: Open DevTools

1. Navigate to the deployed site (e.g., `https://deadronos.github.io/SpaceAutoBattler/`)
2. Open Chrome/Firefox DevTools (F12)
3. Go to the Network tab
4. Reload the page (Ctrl+R or Cmd+R)

### Step 2: Check JavaScript Bundles

Look for the main JavaScript bundles (usually the largest files):

- `main.[hash].js`
- `vendors.[hash].js`
- `rapier.[hash].js`
- `three.[hash].js`

For each bundle, click on it and check:

**Response Headers:**

- `content-encoding: br` (preferred) or `content-encoding: gzip`
- `content-type: application/javascript`

**Size Comparison:**

- **Size column** (transferred): Should be ~1.5-2.0 MiB for all bundles combined
- **Content column** (uncompressed): Should be ~6.2 MiB for all bundles combined

### Step 3: Verify Compression Ratios

Compare the Size (transferred) to Content (uncompressed) for each bundle:

Expected compression ratios:

- Brotli: ~80% reduction
- Gzip: ~70% reduction

Example for main bundle:

- Uncompressed: 248 KiB
- Brotli: ~58 KiB (77% reduction)
- Gzip: ~75 KiB (70% reduction)

### Step 4: Check CSS Files

Verify CSS files are also compressed:

- Look for `styles/main.[hash].css`
- Should show `content-encoding: br` or `gzip`
- Expected size: ~3.8 KiB (brotli) or ~4.5 KiB (gzip) vs 22 KiB uncompressed

## Troubleshooting

### Issue: No `content-encoding` header

**Possible causes:**

1. GitHub Pages CDN hasn't picked up the compressed files yet (wait 5-10 minutes)
2. Browser sent `Accept-Encoding: identity` (forces uncompressed)
3. File size below compression threshold (10KB)

**Solution:**

- Wait a few minutes and try again
- Use an incognito/private browsing window
- Check that .gz and .br files are in the deployment artifact

### Issue: Compression ratio is poor

**Possible causes:**

1. Files are already compressed (e.g., images, already minified JS)
2. Compression configuration issue

**Solution:**

- Check build output for warnings
- Verify compression settings in `vite.config.ts`
- Some files naturally don't compress well

### Issue: 404 errors for bundles

**Possible causes:**

1. Build failed to generate files
2. Deployment didn't include all files

**Solution:**

- Check GitHub Actions workflow logs
- Verify `dist/` folder contains all files after build
- Re-run deployment

## Expected Metrics

After successful compression:

| Metric                 | Before  | After (Brotli) | Improvement    |
| ---------------------- | ------- | -------------- | -------------- |
| Total JS Bundle        | 6.2 MiB | 1.5 MiB        | 76% smaller    |
| Initial Load Time (3G) | ~34s    | ~10s           | 3.4x faster    |
| Initial Load Time (4G) | ~12s    | ~3.5s          | 3.4x faster    |
| Bandwidth per User     | 6.2 MiB | 1.5 MiB        | ~4.7 MiB saved |

## Sign-off

- [ ] Automated verification script passes
- [ ] Manual browser verification completed
- [ ] `content-encoding` headers present on JS bundles
- [ ] Compression ratios match expected values (~70-80%)
- [ ] CSS files are compressed
- [ ] No 404 errors or missing files
- [ ] Page loads successfully and application functions correctly

**Verified by:** ******\_\_\_******  
**Date:** ******\_\_\_******  
**Version deployed:** ******\_\_\_******
