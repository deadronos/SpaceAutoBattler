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

Releases are driven by Git tags, so `package.json` `"version"` must be bumped **before**
tagging. The manual procedure is:

1. Bump `"version"` in `package.json` to the release version (no `v` prefix) — e.g. set
   `"version": "2.2.0"` for a `v2.2.0` tag.

2. Verify the version matches the tag you are about to create:

```bash
GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v2.2.0 npm run version:check
```

3. Create and push an annotated tag:

```bash
git tag -a v2.2.0 -m "Release v2.2.0"
git push origin v2.2.0
```

> Any `v*` tag is treated as a release tag and must equal `v` + `package.json` `"version"`.
> For a prerelease (e.g. `v2.3.0-rc.1`), put the same string in `package.json`
> (`"2.3.0-rc.1"`) — the guard has no prerelease exemption.

4. Monitor the deployment:
   - Check Actions tab for "Deploy to GitHub Pages" workflow
   - Verify all steps pass: version check → typecheck → test → build → deploy

5. Test the deployed site:
   - Visit `https://[username].github.io/SpaceAutoBattler/`
   - Verify the game loads correctly
   - Check browser console for any 404 errors on assets

## Version invariant

`package.json` `"version"` must equal the release tag: a tag `vX.Y.Z` requires
`"version": "X.Y.Z"`. The `version:check` guard (`scripts/check-version.mjs`) enforces this
in the "Deploy to GitHub Pages" workflow, but **only for tag refs** (`if:
github.ref_type == 'tag'`); it is a no-op on `workflow_dispatch` and branch refs. Run it
locally with `npm run version:check <tag>` (or by setting `GITHUB_REF_TYPE` /
`GITHUB_REF_NAME`).

> **Historical caveat:** the `v2.2.0` tag predates this guard, so its tree still has
> `"version": "0.1.0"`. Re-running that tag's deploy through the tag-triggered path will
> fail the version check; this is expected and benign. `v2.2.0` is intentionally **not**
> force-updated, because it is a published, annotated release. All tags created after the
> version-sync change are covered by the guard.

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
- `spaceautobattler.html` (application entry point)
- Asset folders: `assets/`, `models/`, `styles/`, `workers/`
- JavaScript bundles with content hashes
