# Testing (Vitest + Playwright)

## Unit tests (Vitest)

- Run the full unit suite: `npm test`
- Run a single spec: `npx vitest test/<path>.spec.ts`

Notes:

- Keep tests deterministic (seeded RNG where relevant).
- Prefer lightweight mocks using Vitest’s built-in mocking.

## E2E tests (Playwright)

- Run E2E suite: `npm run test:e2e`
- Alternate config entrypoint: `npm run test:playwright` (uses `playwright.config.cjs`)

Reference:

- Playwright authoring reference: [playwright.dev/docs/codegen](https://playwright.dev/docs/codegen)

## Local verification baseline

When making meaningful changes, the default local gate is:

1. `npm run typecheck`
2. `npm test`
