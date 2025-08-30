# CI Instructions

Recommended CI steps (suggested for GitHub Actions):
1. Install dependencies: `npm ci`
2. Type-check: `npm run typecheck` (fail fast if types are broken)
3. Lint & format check: `npx eslint . --ext .ts,.js && npx prettier --check "**/*.{ts,js,json,md}"`
4. Run unit tests: `npm test` (vitest)
5. Run Playwright tests selectively (optional): `npm run test:e2e` (consider running only in nightly or PR with `e2e` label)
6. Build artifact: `npm run build-standalone` (if producing deployable artifacts)

Caching
- Cache `node_modules` and the npm cache for faster builds.

Platform notes
- Build/CI runners are typically linux; some commands using `http-server` are cross-platform. Adjust path handling in scripts if using Windows-specific commands locally.

Acceptance criteria for PRs
- Type-check passes
- Unit tests pass
- Lint and Prettier checks pass
- PR includes at least one unit test for new behavior
