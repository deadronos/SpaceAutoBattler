## CI Instructions

Last-Reviewed: 2025-09-07

- Pre-commit checks: run `npm run typecheck && npm test`.
- Build steps used in CI: `npm run build && npm run build-standalone`.
- Linting: `eslint` configured via `eslint.config.ts` (run `npx eslint .`).
- Test coverage: Vitest is used; configure CI to run `npm test` and upload results.
