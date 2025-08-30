# Style and Conventions

- Language: TypeScript (ES2022 module target) and modern JS in `type: module` mode.
- Linting: ESLint (configs in `eslint.config.ts`), Prettier for formatting.
- Type-checking: `tsc --noEmit` via `npm run typecheck` (project uses `strict: true`).
- Testing: Vitest for logic tests (globals enabled), Playwright for E2E.
- Naming: Use clear descriptive names; types live in `src/types`.

Developer workflow
- Install deps: `npm install`
- Run formatters/linters via pre-commit hooks (Husky + lint-staged). Use `npx` to run tools if needed.

Notes
- Follow TypeScript strictness; avoid any/loose typing unless necessary and justified with comments.
- Prefer small, focused unit tests in `test/vitest/` for simulation logic.
