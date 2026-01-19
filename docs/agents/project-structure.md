# Project structure & boundaries

## Repository layout

- Source code: `src/` (TypeScript).
- Tests: `test/` (`*.spec.ts`) using Vitest.
- E2E tests: `test/playwright/` using Playwright.
- Generated output: `dist/` (do not edit by hand).

## Hard boundaries

- Never modify generated artifacts in `dist/` unless explicitly asked.
- Use shared types from `src/types/index.ts` (avoid ad-hoc duplicates).
- Runtime state must be represented in `GameState` from `src/types/index.ts`.

## Helpful references

- Structure overview: `spec/src-structure.md`
- Breaking changes and migrations: `PR_NOTES/`
