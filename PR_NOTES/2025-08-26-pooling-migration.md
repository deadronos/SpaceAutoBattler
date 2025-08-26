# Pooling Migration — 2025-08-26

Summary

- Moved pooling helper functions and types out of `src/entities.ts` into a focused module `src/pools/assetPool.ts` and public entry `src/pools/index.ts`.
- Goal: separate entity definitions from pooling utilities, centralize pool behavior, and make pooling easier to test and maintain.

What changed

- New module: `src/pools/assetPool.ts` — implements `acquireTexture`, `releaseTexture`, `acquireSprite`, `releaseSprite`, `acquireEffect`, `releaseEffect`, `makePooled`, `createPooledFactory`, and `ensureAssetPool`.
- Public re-exports: `src/pools/index.ts` (consumers should import from this path).
- Removed pooling function implementations from `src/entities.ts` and updated internal call sites to import from `src/pools`.
- Added unit tests under `test/vitest/` to validate pooling behavior and overflow strategies.

Migration notes for integrators

- Preferred imports (new):

  ```ts
  import { acquireSprite, releaseSprite } from './src/pools';
  import { acquireTexture, releaseTexture } from './src/pools';
  ```

- Legacy imports (old):

  ```ts
  // Previously
  import { acquireSprite } from './src/entities';
  ```

- Compatibility: a temporary re-export shim was briefly present in `src/entities.ts` during migration to avoid breakages; it has been removed and pooling helpers are now exported only from `src/pools`.

Testing & verification

- Ran `npx tsc --noEmit` and the full Vitest suite locally; all checks passed.

Follow-ups

- Remove any external consumers that still import pooling helpers from `src/entities` and update them to `src/pools`.
- Consider a small deprecation note in the public README if this repository is consumed as a library.
- Optionally, add a short lint rule or codemod to help update external codebases.

Author: migration automation

