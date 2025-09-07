## Style Conventions

Last-Reviewed: 2025-09-07

Repository style conventions summary:

- TypeScript strict mode and no `any` allowed.
- 2-space indentation.
- Prefer descriptive names and small functions.
- Put runtime state into `GameState` and avoid module-level mutable state.
- Tests: use Vitest in `test/vitest/` and shared test utilities in `test/vitest/setupTests.ts`.