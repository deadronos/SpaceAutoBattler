# Agents Guide: src

- Purpose: All application runtime code and assets for Space Auto Battler live here.
- Language: TypeScript only; keep formatting at two-space indentation with semicolons.
- Types: Share cross-module contracts via `src/types/index.ts` and respect the canonical `GameState` shape.
- Determinism: Use helpers like `src/utils/rng.ts` instead of ad-hoc globals; avoid side effects outside React state.
- Quality: Run `npx tsc --noEmit` and `npm test` before committing and document breaking changes in `PR_NOTES/`.
