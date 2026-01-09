# Project Memory Index

This index lists the short searchable memory summaries generated for the `src/` codebase. These are intended to help new contributors and automated agents quickly find per-file summaries and integration notes.

## How to use

- Each memory is a short, focused Markdown document describing a single source file's responsibility, key functions, integration points, and suggested follow-ups.
- Use these when onboarding, writing tests, or making changes so you can quickly find where behavior is implemented.
- If you change source files, consider updating the corresponding memory entry.
- If you add new important modules, create a new memory file under `memory/` and add a link to this index.

## Per-file memories

- [core-gameState.md](./core-gameState.md) — `src/game/state.ts` (barrel exports for GameState lifecycle; implementations in `createGameState.ts`, `entityLifecycle.ts`, `spawnFleets.ts`, `resetGame.ts`).
- [core-systems.md](./core-systems.md) — `src/game/systems.ts` (simulation step ordering: prepareShips, advanceProjectiles, syncTransforms, resolveProjectiles; AI decision ordering and exported test hooks).
- [core-ships.md](./core-ships.md) — `src/game/ships.ts` (SHIP_STATS, spawnShip, turret ECS creation and registration, progression seeding, range variance logic).
- [core-physics.md](./core-physics.md) — `src/game/state.ts` & `src/game/systems.ts` (Rapier initialization, main-thread stepping, pending reset semantics with `requestReset`).
- [core-assets.md](./core-assets.md) — `src/utils/patchGltfLoader.ts` and `src/assets/ships.ts` (GLTF loader guard and model asset mappings used by renderer; `patchGltfLoader` imported in `main.tsx`).
- [dynamic-res-scaler.md](./dynamic-res-scaler.md) — `src/components/DynamicResScaler.tsx` (DPR auto-scaling component; exports `computeNextDpr()` and includes integration tests at `test/vitest/dynamic-res-scaler.spec.ts`).- [e2e-static-server.md](./e2e-static-server.md) — `scripts/e2e-static-server.mjs` (small static server used to serve built artifacts for Playwright/CI E2E runs and compression verification). - [review-2026-01.md](./review-2026-01.md) — Project review Jan 2026 summary and prioritized recommendations (performance/HUD, worker simulation, missile/torpedo recommendations; actionable items referenced in tasks & designs).
- [core-rng.md](./core-rng.md) — `src/utils/rng.ts` (seeded deterministic RNG used by simulation and spawn randomization).
- [core-aiProfiles.md](./core-aiProfiles.md) — `src/game/aiProfiles.ts` (behavior profile definitions + hull-to-profile mapping for AI v2).
- [core-aiScenarioHarness.md](./core-aiScenarioHarness.md) — `test/support/aiScenarioHarness.ts` (headless scenario runner feeding deterministic AI command logs and fixtures; test-only).

- [projectbrief.md](./projectbrief.md) — Project brief describing goals, constraints, and success criteria.
- [productContext.md](./productContext.md) — Users, stakeholders, and high-level assumptions.
- [systemPatterns.md](./systemPatterns.md) — Architecture patterns and guidance (GameState canonicalization, simulation/renderer separation).
- [techContext.md](./techContext.md) — Tooling, stack, and development workflow notes.
- [activeContext.md](./activeContext.md) — Current active work and next steps.
- [progress.md](./progress.md) — High-level progress notes and known issues.

## Maintenance guidelines

- Keep each memory short (200-800 words) and focused on the file's responsibilities.
- Link to relevant config files and note key tunables where appropriate.
- Prefer short examples and references to where the file is used (e.g., `main.tsx` or `systems.ts`).

Audited on 2025-10-28 by Copilot agent.
