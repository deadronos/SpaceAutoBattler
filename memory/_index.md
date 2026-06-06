# Project Memory Index

This index lists the short searchable memory summaries generated for the `src/` codebase. These are intended to help new contributors and automated agents quickly find per-file summaries and integration notes.

## How to use

- Each memory is a short, focused Markdown document describing a single source file's responsibility, key functions, integration points, and suggested follow-ups.
- Use these when onboarding, writing tests, or making changes so you can quickly find where behavior is implemented.
- If you change source files, consider updating the corresponding memory entry.
- If you add new important modules, create a new memory file under `memory/` and add a link to this index.

## Per-file memories

### Core game systems

- [core-gameState.md](./core-gameState.md) — `src/game/state.ts` (barrel exports for GameState lifecycle; implementations in `createGameState.ts`, `entityLifecycle.ts`, `spawnFleets.ts`, `resetGame.ts`).
- [core-systems.md](./core-systems.md) — `src/game/systems.ts` (simulation step ordering: prepareShips, advanceProjectiles, syncTransforms, resolveProjectiles; AI decision ordering and exported test hooks).
- [core-ships.md](./core-ships.md) — `src/game/ships.ts` (SHIP_STATS, spawnShip, turret ECS creation and registration, progression seeding, range variance logic).
- [core-physics.md](./core-physics.md) — `src/game/state.ts` & `src/game/systems.ts` (Rapier initialization, main-thread stepping, pending reset semantics with `requestReset`).
- [core-projectileSystems.md](./core-projectileSystems.md) — `src/game/systems/projectiles/*` (folder split for spawn/advance/beam/homing/physicsAdapter/sharedTemps; homing + point-defense integration).
- [core-simulationBridge.md](./core-simulationBridge.md) — `src/game/SimulationBridge.ts` + `src/worker/*` (optional Web-Worker simulation, SoA transform buffers, message protocol, URL flags).

### Renderer and assets

- [core-assets.md](./core-assets.md) — `src/utils/patchGltfLoader.ts` and `src/assets/ships.ts` (GLTF loader guard and model asset mappings used by renderer; `patchGltfLoader` imported in `main.tsx`).
- [core-celestialEnvironment.md](./core-celestialEnvironment.md) — `src/components/environment/Skysphere.tsx` and star-disk providers (procedural celestial environment rendering).
- [dynamic-res-scaler.md](./dynamic-res-scaler.md) — `src/components/DynamicResScaler.tsx` (DPR auto-scaling component; exports `computeNextDpr()` and includes integration tests at `test/vitest/dynamic-res-scaler.spec.ts`).

### Utilities and tooling

- [core-rng.md](./core-rng.md) — `src/utils/rng.ts` (seeded deterministic RNG used by simulation and spawn randomization).
- [core-steering.md](./core-steering.md) — `src/utils/steering.ts` (allocation-free vector/orientation helpers: safeNormalize, orientQuaternionFromDirection, lead/seek/arrive/intercept/evade).
- [core-cappedBuffer.md](./core-cappedBuffer.md) — `src/utils/cappedBuffer.ts` (shared FIFO-trim history helper consolidating diagnostics, ripples, metrics, progression events).

### AI and testing

- [core-aiProfiles.md](./core-aiProfiles.md) — `src/game/aiProfiles.ts` (behavior profile definitions + hull-to-profile mapping for AI v2).
- [core-aiScenarioHarness.md](./core-aiScenarioHarness.md) — `test/support/aiScenarioHarness.ts` (headless scenario runner feeding deterministic AI command logs and fixtures; test-only).
- [e2e-static-server.md](./e2e-static-server.md) — `scripts/e2e-static-server.mjs` (small static server used to serve built artifacts for Playwright/CI E2E runs and compression verification).

### Design and review

- [design-ship-progression-system.md](./design-ship-progression-system.md) — Design doc for the ship progression / leveling system.
- [review-2026-01.md](./review-2026-01.md) — Project review Jan 2026 summary and prioritized recommendations (performance/HUD, worker simulation, missile/torpedo recommendations; actionable items referenced in tasks & designs).

### Root context

- [projectbrief.md](./projectbrief.md) — Project brief describing goals, constraints, and success criteria.
- [productContext.md](./productContext.md) — Users, stakeholders, and high-level assumptions.
- [systemPatterns.md](./systemPatterns.md) — Architecture patterns and guidance (GameState canonicalization, simulation/renderer separation).
- [techContext.md](./techContext.md) — Tooling, stack, and development workflow notes.
- [activeContext.md](./activeContext.md) — Current active work and next steps.
- [progress.md](./progress.md) — High-level progress notes and known issues.
- [requirements.md](./requirements.md) — EARS-style testable requirements tracked across the project.

## Maintenance guidelines

- Keep each memory short (200-800 words) and focused on the file's responsibilities.
- Link to relevant config files and note key tunables where appropriate.
- Prefer short examples and references to where the file is used (e.g., `main.tsx` or `systems.ts`).

Audited on 2026-06-06 by Copilot agent. Previous audit: 2025-10-28.
