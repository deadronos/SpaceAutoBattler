# AI Controller (current)

Last-Reviewed: 2025-09-21

Summary (authoritative):

- Historical module: earlier versions exposed a class `AIController` under `src/core/`.
- Current implementation: AI-like decisions are implemented as compact logic inside `src/game/systems.ts` and supporting helpers across `src/game/*` (e.g., `ships.ts`, `systems.ts`). There is no long-lived `AIController` class in the active codebase.

Key runtime behavior (where to look):

- `src/game/systems.ts` contains the `updateGame(state, dt)` step that:
  - Prepares ship state for the tick (cooldowns, turret readiness),
  - Selects targets using `findNearestEnemy` and similar helpers,
  - Decides firing via turret logic embedded in the simulation step,
  - Advances projectiles and resolves hit detection.

- Helper functions that act as AI primitives (seeking, separation, facing, simple pursuit) are implemented in small helpers near `ships.ts` or `systems.ts`.

Guidance:

- For a heavier AI-controller abstraction, see the historical design reference in `memory/ai_controller_design_reference` (keeps the long-form design separate from the concise operational memory).
- When adding substantial AI logic, prefer creating a `src/game/ai/` subfolder and keeping state inside `GameState` rather than module-level singletons.

References:

- `src/game/systems.ts`, `src/game/ships.ts`, `memory/ai_controller_design_reference` (design archive)
