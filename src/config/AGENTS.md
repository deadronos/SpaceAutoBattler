# Agents Guide: src/config

- Purpose: Centralises tweakable data like projectile stats and renderer defaults.
- Structure: Export plain typed objects/functions; avoid side effects so configs stay serialisable.
- Types: Declare explicit interfaces in `src/types/index.ts` when sharing shapes across modules.
- Process: When updating balances, document rationale in commit messages and adjust relevant tests or fixtures.
- Verification: Run `npx tsc --noEmit` plus targeted Vitest specs touching the updated config.
