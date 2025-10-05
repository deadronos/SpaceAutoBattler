# src/types/index.ts

Path: src/types/index.ts
Last-Reviewed: 2025-10-05

Purpose: Central re-export barrel for the project's TypeScript type modules. Use these canonical types across the repo to avoid local duplication.

Key points:
- `src/types/index.ts` re-exports types from more focused files. Notably, `GameState` is re-exported from `./simulation.js` (authoritative definition in `src/types/simulation.ts`).
- Recommended import pattern: Prefer `import { GameState } from 'src/types';` (the barrel) in higher-level code, but consult `src/types/simulation.ts` when you need to inspect the canonical field list.

Verification:
- Confirmed the re-export exists and `GameState`'s authoritative declaration remains in `src/types/simulation.ts`.
