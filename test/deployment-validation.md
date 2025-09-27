# Deployment Validation Guide

This document provides steps to validate that the GitHub Pages deployment is working correctly.

## Pre-deployment Checklist

Before creating a release tag, verify locally:

```bash
# Run the complete deployment build process
npm run build:deploy

# Verify both files exist
ls -la dist/index.html dist/spaceautobattler.html

# Optional: Test locally with static server
npm run serve
```

## GitHub Pages Configuration

Ensure your GitHub repository has GitHub Pages configured:

1. Go to repository Settings > Pages
2. Source should be set to "GitHub Actions"
3. No custom domain or branch configuration needed (handled by workflow)

## Release Process

1. Create and push a tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. Monitor the deployment:
   - Check Actions tab for "Deploy to GitHub Pages" workflow
   - Verify all steps pass: typecheck → test → build → deploy

3. Test the deployed site:
   - Visit `https://[username].github.io/SpaceAutoBattler/`
   - Verify the game loads correctly
   - Check browser console for any 404 errors on assets

## Troubleshooting

### Common Issues

- **404 on assets**: Check if paths are correctly relative (they should be with `publicPath: './'`)
- **Build failures**: Review the Actions logs for typecheck or test failures
- **Deploy failures**: Ensure GitHub Pages is enabled and set to "GitHub Actions"

### Rollback Process

If a deployment fails or has issues:

1. The previous deployment remains live until the new one succeeds
2. Delete the problematic tag if needed: `git tag -d v1.0.0 && git push origin :refs/tags/v1.0.0`
3. Fix issues and create a new tag

## File Structure Verification

The deployed `dist/` folder should contain:
- `index.html` (copied from `spaceautobattler.html`)
- `spaceautobattler.html` (original webpack output)
- Asset folders: `assets/`, `models/`, `styles/`, `workers/`
- JavaScript bundles with content hashes