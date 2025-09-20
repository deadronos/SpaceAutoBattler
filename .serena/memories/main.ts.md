# main.ts (entrypoints & bootstrap)

Last-Reviewed: 2025-09-21

Authoritative mapping:
- Entry: `src/main.tsx` (React mount and renderer bootstrap) — previous `src/main.ts` references may be historical.
- Responsibilities: Attach renderer, create `GameState` via `createGameState`, attach the renderer's asset pool, and start the main loop which calls `updateGame(state, dt)` and `renderer.render()`.

Notes:
- If your local copy uses `src/main.ts`, check `src/main.tsx` for the React-specific mount.
- For headless tests, call `createGameState({ seed })` and avoid creating renderer side-effects.
