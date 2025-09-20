# Project Memory Index

This index lists the short searchable memory summaries generated for the `src/` codebase. These are intended to help new contributors and automated agents quickly find per-file summaries and integration notes.

## How to use

- Each memory is a short, focused Markdown document describing a single source file's responsibility, key functions, integration points, and suggested follow-ups.
- Use these when onboarding, writing tests, or making changes so you can quickly find where behavior is implemented.
- If you change source files, consider updating the corresponding memory entry.
- If you add new important modules, create a new memory file under `memory/` and add a link to this index.

## Per-file memories

- [core-gameState.md](./core-gameState.md) — `src/game/state.ts` (GameState factory, Rapier init, entity lifecycle helpers like createGameState, destroyEntity, spawnInitialFleets).
- [core-systems.md](./core-aiController.md) — `src/game/systems.ts` (simulation step: prepareShips, advanceProjectiles, syncTransforms, resolveProjectiles; lightweight AI: nearest-enemy targeting and firing).
- [core-ships.md](./core-assetLoader.md) — `src/game/ships.ts` (SHIP_STATS, spawnShip, collider registration).
- [core-physics.md](./core-physics.md) — `src/game/state.ts` & `src/game/systems.ts` (Rapier initialization, physics stepping, collision/resolve helpers).
- [core-assetLoader.md](./core-assetLoader.md) — `src/utils/patchGltfLoader.ts` and `src/assets/ships.ts` (GLTF loader guard and model asset mappings used by renderer).
- [core-assetPool.md](./core-assetPool.md) — Runtime note: `GameState.assetPool` (optional Map used by renderer bootstrap; assets are cached by the renderer/asset loader).
- [core-rng.md](./core-rng.md) — `src/utils/rng.ts` (seeded deterministic RNG used by simulation and spawn randomization).

- [projectbrief.md](./projectbrief.md) — Project brief describing goals, constraints, and success criteria.
- [productContext.md](./productContext.md) — Users, stakeholders, and high-level assumptions.
- [systemPatterns.md](./systemPatterns.md) — Architecture patterns and guidance (GameState canonicalization, simulation/renderer separation).
- [techContext.md](./techContext.md) — Tooling, stack, and development workflow notes.
- [activeContext.md](./activeContext.md) — Current active work and next steps.
- [progress.md](./progress.md) — High-level progress notes and known issues.

## Maintenance guidelines

- Keep each memory short (200-800 words) and focused on the file's responsibilities.
- Link to relevant config files and note key tunables where appropriate.
- Prefer short examples and references to where the file is used (e.g., `main.ts` or `simWorker.ts`).

Generated on 2025-09-15 by Copilot agent.
