# src/game/systems.ts

Path: src/game/systems.ts
Last-Reviewed: 2025-09-21

Purpose: Simulation systems executed per tick: movement, targeting, projectile updates, collision resolution, and scoring.

Key exports/symbols:
- stepSimulation / runSystems (names vary) — tick runner

Notes:
- Should use seeded RNG for any non-deterministic behavior.
- Keep simulation logic separate from rendering; use `GameState` for data.
