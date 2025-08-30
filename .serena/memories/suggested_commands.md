# Suggested Commands

This file lists the commands developers should know for working with SpaceAutoBattler (Windows environment).

Prerequisites
- Node.js (>=18), npm
- Git

Common commands
- Install dependencies: npm install
- Start dev server: npm run serve (opens http-server on port 8080)
- Serve production build: npm run serve:dist
- Build (development bundle): npm run build
- Build standalone: npm run build-standalone
- Run unit tests: npm test
- Run e2e/playwright tests: npm run test:e2e
- Type-check TypeScript: npm run typecheck
- Hash assets: npm run hash-assets
- Validate config: npm run validate-config

Task finish checklist
- Run formatting and linting (project uses Prettier and ESLint):
  - Pre-commit hooks via Husky and lint-staged may run automatically.
- Run type-check: npm run typecheck
- Run tests: npm test
- If building: npm run build or npm run build-standalone

Notes
- Vitest is configured to run logic/unit tests under test/vitest with environment `happy-dom`.
- Playwright configuration is in `playwright.config.cjs` and e2e tests live under `test/playwright/`.
- Use `http-server` (npm script `serve`) to preview the app on port 8080.
