# Code Structure

Top-level layout (important folders):
- `src/` - application source
  - `core/` - deterministic simulation logic and AI controllers (suitable for headless testing)
  - `renderer/` - Three.js rendering, effects, UI
  - `config/` - JSON/TS configuration for behavior, fleet, physics, renderer
  - `utils/` - helpers like RNG, spatial grid
  - `agent/` - automation/agent helpers
  - `types/` - shared TypeScript types
- `test/`
  - `vitest/` - unit and integration tests that run under `vitest` (happy-dom)
  - `playwright/` - E2E browser tests
- `scripts/` - build, validate and other dev scripts
- `.serena/` - created by onboarding (project config and memories)

Important files:
- `package.json` - npm scripts and dependencies
- `tsconfig.json` - TypeScript config
- `vitest.config.js` - vitest test configuration
- `README.md` - quick start and project notes

Testing locations
- Unit tests: `test/vitest/` (run via `npm test`)
- Playwright e2e: `test/playwright/` (run via `npm run test:e2e`)
