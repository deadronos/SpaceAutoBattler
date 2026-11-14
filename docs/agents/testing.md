# Testing & Verification

## Unit Tests (Vitest via `vite-plus`)

- Run the full unit suite: `pnpm test` (or `vp test`)
- Run a single spec: `pnpm exec vitest run test/vitest/<name>.spec.ts` (or `vp test test/vitest/<name>.spec.ts`)
- Note: Most unit specs live under `test/vitest/`, with component/helper specs in `test/components/`, `test/config/`, `test/game/`, `test/progression/`, `test/renderer/`, and `test/utils/`.

Notes:

- Keep tests deterministic (seeded RNG where relevant).
- Prefer lightweight mocks using Vitest’s built-in mocking (`vi.spyOn`, `vi.fn`) and Testing Library rather than deep module-mocking trees.

## E2E & Smoke Tests

- Run Playwright E2E suite: `pnpm run test:e2e`
- Alternate config entrypoint: `pnpm run test:playwright` (uses `playwright.config.cjs`)
- Single ship-hull spec: `pnpm run test:playwright:ship`
- Dev server boot smoke test: `pnpm run smoke:dev`
- AI frame budget check: `pnpm run perf:ai-budget` (included in `pnpm run test:ci`)
- Playwright authoring reference: [playwright.dev/docs/codegen](https://playwright.dev/docs/codegen)

## Local Verification Baseline

When making meaningful changes, the default local gate is:

1. `pnpm run typecheck`
2. `vp check` (or `pnpm run lint` + `pnpm run format` if editing style)
3. `pnpm test`
