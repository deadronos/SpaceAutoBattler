# Tooling & Scripts

SpaceAutoBattler uses **pnpm** and **Vite Plus (`vp`)** for builds, bundling, linting, formatting, and unit tests.

## Core Commands

| Task           | Command                             | Notes                                                                                    |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| Dev server     | `pnpm run dev` (`vp dev`)           | Serves on port `8080` with COOP/COEP headers                                             |
| Build (prod)   | `pnpm run build` (`vp build`)       | Runs `prebuild` (`check-no-sync-reads`) first; emits `.br`/`.gz`                         |
| Build (deploy) | `pnpm run build:deploy`             | `typecheck` + `test` + `build` + copies `dist/spaceautobattler.html` → `dist/index.html` |
| Typecheck      | `pnpm run typecheck`                | `tsc -p tsconfig.json --noEmit`                                                          |
| Lint / Format  | `pnpm run lint` / `pnpm run format` | `oxlint` / `oxfmt` via `vp`                                                              |
| Full VP check  | `vp check`                          | Runs formatting, lint, and checks as in CI                                               |
| Unit tests     | `pnpm test` (`vp test`)             | Runs Vitest via `vite-plus`                                                              |
| E2E tests      | `pnpm run test:e2e`                 | Playwright (`pnpm run test:playwright` uses `playwright.config.cjs`)                     |

## Specialized Checks

- **Dev boot smoke**: `pnpm run smoke:dev` (`scripts/smoke-dev.mjs`)
- **AI frame budget**: `pnpm run perf:ai-budget` (also part of `pnpm run test:ci`)
- **Asset compression check**: `pnpm run assets:compress:check` (compress with `pnpm run assets:compress`)
- **Release version sync**: `pnpm run version:check` (`scripts/check-version.mjs`)

## CI Gates

- `.github/workflows/unit-tests.yml` runs `vp install --frozen-lockfile`, `vp run typecheck`, `vp check`, `vp test`, a non-Playwright test-file discovery floor (`>= 198` files), and `vp build` (verifying `.br`/`.gz` output).
- `.github/workflows/deploy-pages.yml` enforces `scripts/check-version.mjs` on `v*` tag pushes before running typecheck, `vp check`, `vp test`, and `vp build`.
