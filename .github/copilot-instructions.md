# Summary
All JS files in /src are build artifacts. All logic, codepaths, and updates should be made to the TypeScript files in /src. Do not edit JS files directly; always update the corresponding TypeScript source and rebuild.
<!--
	SpaceAutoBattler - Copilot / Contributor Instructions
	This file documents the actual project mechanics, tech stack, runtime contracts,
	contributor workflow, and precise guidance for AI assistants (Copilot / GPT-5).
	Keep this file current when you change important contracts like simulateStep
	or progression constants.
-->

# SpaceAutoBattler — Contributor & Copilot Guidelines

!! What To Do At The End of each work cycle !!
update/overwrite /spec/IMPLEMENTATION_STATUS.md with recent completed goals and and shortterm and longterm goals or current state of the project and shorten the file


Purpose
-------
This document is the single-source guidance for contributors and automated
coding agents working on SpaceAutoBattler (the repo root is the canonical
source). It describes the game's mechanics, the deterministic simulation
contract, file ownership, test/build commands, and best-practices for
automated contributors (Copilot/GPT-5 agents).

Project summary
---------------
- Project name: SpaceAutoBattler
- Short description: A small, deterministic 2D auto-battler where fleets of
	ships fight on a toroidal playfield. Simulation (gameplay) is deterministic
	and separate from the renderer (visuals), which consumes small, replayable
	events to produce effects.
- Primary mechanics currently implemented:
	- Ships with HP and regenerating shields.
	- Bullets with owner attribution (ownerId) for XP/kill crediting.
	- XP and level progression: ships earn XP for damage and kills and gain
		stat increases per level (HP, damage, shields) via `src/progressionConfig.ts`.
	- Visual-only effects emitted by simulateStep: `explosions`, `shieldHits`,
		`healthHits` arrays in the `state` object.

## Tech Stack
- TypeScript ES modules (edit `.ts` in `/src`).
- Node.js for tooling/tests.
- Vitest for unit tests, Playwright for E2E.
- Build: `scripts/build-standalone.mjs` (esbuild).
- Seeded RNG for simulation (`src/rng.ts`).

## Types & Config
- Import types from `src/types/index.ts` only.
- Game balance/visuals: edit config files in `src/config/`.
- Use config helpers (e.g., `getVisualConfig(type)`).

## Simulation & Renderer Contract
- `simulateStep(state, dt, bounds)` mutates `state` (ships, bullets, events).
- Event arrays: `explosions`, `shieldHits`, `healthHits`.
- Bullets must have `ownerId` for XP attribution.
- Simulation must be deterministic (use seeded RNG).

## Contribution Rules
- Make minimal, targeted edits.
- Edit TypeScript sources, rebuild for JS.
- Add/adjust unit tests for gameplay changes.
- Preserve public APIs and event shapes.
- No runtime dependencies; dev deps OK.
- Use 2-space indent, semicolons, const/let.

## GameManager
- Edit `src/gamemanager.ts` for spawn/UI logic.
- `spawnShip(team)` samples types per config or falls back to default.

## Testing & Build
- Run `npm test` after changes.
- Build: `npm run build`, `npm run build-standalone`.
- Validate config: `npm run validate-config`.

## High-Level Guidance
- Follow explicit instructions.
- State intent before non-trivial edits.
- Prefer small, test-backed changes.
- Use seeded RNG for simulation logic.
- Add unit tests for behavioral changes.
- For major changes, create a Decision Record.

## Useful Patterns
- Seed RNG in tests:  
  `import { srand } from '../src/rng.ts'; srand(12345);`
- Minimal test example:
  ```ts
  test('simulateStep emits shieldHits', () => {
    srand(1);
    const state = { ships: /* ... */, bullets: [], explosions: [], shieldHits: [], healthHits: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    expect(state.shieldHits.length).toBeGreaterThanOrEqual(0);
  });
  ```

## Maintainers
- Owner: deadronos
- Main branch: `main`

**Questions?** Open an issue titled "clarify: copilot instructions".

