# AGENTS.md

Build, lint, and test (quick reference):

- Build: npm run build
- Build standalone: npm run build-standalone
- Type-check: npx tsc --noEmit
- Run all tests: npm test
- Run a single test file: npx vitest test/<path-to-spec>.spec.ts
- Run Playwright E2E: see playwright.config.js and use npx playwright test

Code style & agent rules (short):

- Edit TypeScript in /src only; do not edit generated /dist JS.
- Use ES module imports; import shared types from src/types/index.ts only.
- 2-space indent, semicolons, prefer const/let (no var).
- Always add explicit types for public APIs and config objects.
- Use seeded RNG (src/rng.ts) for deterministic simulation tests.
- Prefer small, test-backed commits; run npx tsc and npm test before committing.
- Handle errors explicitly (throw or return error values); avoid silent failures.
- Name functions/types clearly and keep event shapes stable (bullets, explosions, shieldHits, healthHits).

Cursor / Copilot rules:

- Follow rules in .github/copilot-instructions.md if present; respect Copilot suggestions but verify correctness.
- If .cursor/rules or .cursorrules exist, follow those linting/commit rules (check repository root).

Quick notes:

- No runtime dependencies; devDependencies allowed.
- For breaking type/config changes, create a decision record in /PR_NOTES/ and migrate with fallbacks.
- Owner: deadronos, main branch: main
