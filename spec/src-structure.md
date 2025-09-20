# SpaceAutoBattler — Source code layout (current)

This document describes the current, practical layout of the repository's `src/` directory as of the working branch. It is intentionally concise and focused on where to find runtime code, UI, game logic, and types.

Top-level `src/` (high level):

```
src/
├─ App.tsx           # React entry component (app wrapper)
├─ main.tsx          # App bootstrap and renderer mounting
├─ ui.html           # Minimal static HTML used by the dev/build
├─ assets/           # Static assets used by the app (textures, svgs)
├─ components/       # React / R3F components (Ship, Projectile, HUD, Battlefield)
├─ game/             # Pure game logic: state, systems, ship definitions
├─ hooks/            # React hooks used by the UI and game loop
├─ styles/           # CSS / global styles
├─ types/            # Canonical TypeScript types (GameState, entities)
└─ utils/            # Utilities (seeded RNG, helpers)
```

Why this matters
- The repository keeps simulation and game state code in `src/game/` (pure logic). UI and rendering live in `src/components/` and `App.tsx`.
- All runtime types are exported from `src/types/index.ts` and are the canonical contract for stateful code.
- Deterministic systems (seeded RNG) and any physics-related helpers live in `src/utils/` to keep side-effects explicit.

Files of interest
- `src/main.tsx` — application bootstrap: mounts React, wires dev helpers and initial state.
- `src/App.tsx` — top-level React component that composes the UI and game renderer.
- `src/ui.html` — simple HTML template used by the production/dev builds.
- `src/game/state.ts` — central game state container and helpers used by systems.
- `src/game/systems.ts` — game systems (update loop, integration, collision handling, etc.).
- `src/game/ships.ts` — ship blueprints, stats and simple spawning helpers.
- `src/components/Ship.tsx` — renderable ship component; `Projectile.tsx` and `Battlefield.tsx` likewise handle visuals.
- `src/types/index.ts` — canonical types: entities, GameState, queries and helper types.

Conventions and responsibilities
- Edit TypeScript sources only under `src/`; do not modify `dist/` build artifacts.
- Keep deterministic logic (seeded RNG) inside `src/game/` or `src/utils/` as appropriate.
- UI code (React/R3F) belongs in `src/components/` and should prefer props + hooks over module-level state.
- The `GameState` type in `src/types/index.ts` is the canonical runtime state shape — other modules should import it rather than creating separate global state.

Development workflow (practical)
1. Make changes in `src/` and add/update unit tests under `test/vitest/`.
2. Run type checks and tests: `npm run typecheck && npm test`.
3. Build for production: `npm run build` (output: `dist/`).

Follow-ups / docs to align
- This document is the authoritative quick reference for the `src/` layout. Other longer specs in `spec/`, `docs/`, or `memory/` may reference additional conceptual architecture (rendering pipeline, physics notes) and should be updated as part of any larger refactor. See `AGENTS.md` and `.github/instructions/*.instructions.md` for repository-specific contribution and agent rules.

If you want, I can also open and update other high-level docs (README, docs/renderer-pipeline.md, spec/*) to keep them consistent — I suggest a small sweep to update README and the main spec first.
