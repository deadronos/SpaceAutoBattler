<!--
	SpaceAutoBattler - Copilot / Contributor Instructions
	This file documents the actual project mechanics, tech stack, runtime contracts,
	contributor workflow, and precise guidance for AI assistants (Copilot / GPT-5).
	Keep this file current when you change important contracts like simulateStep
	or progression constants.
-->

# SpaceAutoBattler — Contributor & Copilot Guidelines

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

Tech stack & runtime
--------------------
- Browser-side game: TypeScript + ES modules (see `src/*.ts`) that compile to JS for the browser. Both a Canvas 2D renderer and a WebGL renderer are supported (see `src/canvasrenderer.ts` and `src/webglrenderer.ts`).
- The codebase is primarily authored in TypeScript. Edit `.ts` sources under `src/` — the JS runtime (`src/*.js`) is considered build output and will be (re)generated from TypeScript during the build.
- Node.js is used for dev tooling (build helpers) and tests.
- Testing: Vitest for unit tests (run with `npm test`), and Playwright for end-to-end / visual browser tests (tests live under `test/playwright/`).
- Bundling/inlining: `scripts/build-standalone.mjs` (esbuild) produces an inlined standalone HTML into `./dist/`. The build now includes a step to transpile authoritative TS runtime sources (for example `src/gamemanager.ts`) into their JS runtime equivalents before bundling.
	- Seeded RNG for deterministic simulation: `src/rng.ts` (srand, unseed, srandom, srange, srangeInt). The simulation must use the seeded RNG; the renderer may use `Math.random()` for purely cosmetic (non-deterministic) effects. The runtime JS (`src/*.js`) will be generated from the TypeScript sources during the build.

Types — single source of truth
------------------------------
- Import types from `src/types/index.ts` only. This barrel file re-exports types from config modules and other domains so consumers have a single, stable import path.
- Example:
	- `import type { TeamsConfig, ShipSpec } from '../types';`
- When adding or renaming types in config modules, update the re-exports in `src/types/index.ts` so dependents don’t import deep paths directly.
- Prefer `import type { X } from '...'` to avoid runtime circulars and keep the bundle lean.

Configuration modules — balance & visuals
-----------------------------------------
All gameplay balance and most visuals are controlled through config modules under `src/config/`. Prefer changing these files over hardcoding constants in logic or renderers.

- `src/config/assets/assetsConfig.ts`
	- Palette: `palette.background` (scene clear color), `shipHull`, `shipAccent`, `bullet`, `turret`.
	- Shapes: `shapes2d` definitions for ships, bullets, turrets.
	- Animations: `animations.engineFlare` (points, `pulseRate`, `alpha`, `offset`), `animations.shieldEffect` (`r`, `color`, `pulseRate`, `strokeWidth`, `alphaBase`, `alphaScale`), `animations.damageParticles`.
	- Damage mapping: `damageStates` and `damageThresholds` (e.g., `{ moderate: 0.66, heavy: 0.33 }`).
	- Visual defaults: `visualStateDefaults` per ship type (`engine`, `shield`, `damageParticles`).
	- Helper: `getVisualConfig(type)` returns shape, palette, animations, and damage states — use this instead of deep-reading config internals.

- `src/config/rendererConfig.ts`
	- Renderer choice: `preferred`, `allowUrlOverride`, `allowWebGL`.
	- HP bar styling: `hpBar` with `{ bg, fill, w, h, dx, dy }` consumed by the Canvas renderer.

- `src/config/gamemanagerConfig.ts`
	- Hit particles: `SHIELD` and `HEALTH` TTL/count/color/size.
	- Explosions: `EXPLOSION` with `particleCount`, `particleTTL`, `particleColor`, `particleSize`, `minSpeed`, `maxSpeed`.
	- Starfield: `STARS` with `twinkle`, `redrawInterval`, plus `background` and `count`.

- `src/config/progressionConfig.ts`
	- XP rewards/curve and per-level scalars (HP/damage/shield/etc.). Keep tests up to date if you change these.

- `src/config/teamsConfig.ts`
	- Team colors and reinforcement preferences. Deterministic selection helpers live here.

- `src/config/entitiesConfig.ts`
	- Ship mapping and helpers (e.g., `getDefaultShipType`, `bulletKindForRadius`).

Renderer behavior driven by config
----------------------------------
- Background clear color comes from `AssetsConfig.palette.background` (Canvas/WebGL).
- Damage tint thresholds come from `AssetsConfig.damageThresholds`; tint colors/opacity from `damageStates`.
- Shield effect uses animation config (`r`, `strokeWidth`, `alphaBase`, `alphaScale`, `pulseRate`).
- Engine flare uses `animations.engineFlare.alpha` and `offset` with `pulseRate`.
- Canvas HP bar reads `RendererConfig.hpBar`.
- GameManager uses `EXPLOSION`, `SHIELD`, and `HEALTH` for particle bursts and `STARS` for the starfield background and count.

Key areas and where to make related changes
------------------------------------------
- Simulation core (entities & simulate): Contains ship and bullet definitions, damage/shield handling, XP/level progression, and the deterministic time-step that advances game state. Changes here affect gameplay and must be covered by unit tests.
- Canvas renderer: The Canvas-based renderer draws ships, bullets, particles and handles device-pixel-ratio and backing-store transforms. If visuals are blurry, choppy, or scale incorrectly, inspect this area first.
- WebGL renderer: The WebGL path handles GL context creation, viewport sizing, and (optionally) shader/mesh rendering. It currently contains a minimal drawing path and can be extended for full GPU rendering.
- Seeded RNG module: Provides functions to seed and generate deterministic pseudo-random values used by the simulation. Always use this for simulation logic to keep tests deterministic.
- Progression & tuning constants: Where XP, per-level effect scalars, and other balancing numbers live. Update tests when changing these values.
- App bootstrap & dev UI: Bootstraps the canvas, selects renderer, and exposes dev UI hooks such as the renderer scale slider. It also computes backing-store size using device-pixel-ratio * renderer scale.
- Standalone build script: Bundles and inlines the compiled code into a single HTML file used for visual regression testing and distribution.
- Tests: Unit tests for deterministic simulation and unit behaviors, and Playwright tests for end-to-end / visual validation. Follow the project's Playwright testing guidance when adding visual tests.

Simulation & renderer contract (must be preserved)
-----------------------------------------------
Always preserve these small, stable contracts so automated tooling and tests
don't break unexpectedly.

1) simulateStep signature and behavior

	- function: `simulateStep(state, dt, bounds)`
	- Behavior: Mutates the `state` object by advancing ship and bullet
		positions, resolving collisions, and awarding XP.
	- Event emissions: simulateStep may push to the following arrays on
		`state` (create these arrays ahead of time if you expect events):
		- `state.explosions` — push objects: `{ x, y, team }` when a ship dies.
		- `state.shieldHits` — push objects: `{ id, hitX, hitY, team, amount }` when
			a ship's shield absorbs damage.
		- `state.healthHits` — push objects: `{ id, hitX, hitY, team, amount }` when
			a ship's HP is reduced (after shield depletion).

	- Do NOT do canvas drawing or DOM manipulation here. Keep events minimal and
		numeric (positions/amounts/ids/teams) so renderer can re-create visuals.

2) Bullet owner attribution

	- Bullets created by ships should include `ownerId` so XP and kill credit
		are awarded to the attacker. Example: `new Bullet(x,y,vx,vy,team, ownerId)`.

3) Determinism

	- The simulation must be deterministic when seeded. Tests rely on calling
		`srand(seed)` before running simulation steps. Use functions exported from
		`src/rng.ts` for any randomness in game logic. The renderer may use
		non-deterministic randomness (Math.random) for cosmetic variety only.

Coding & contribution rules (human + automated)
---------------------------------------------
- Prefer small, targeted edits: change the minimal files needed to implement a behavior change.
- Source of truth: The TypeScript sources under `src/*.ts` are authoritative. For runtime behavioral changes (for example the GameManager), edit the `.ts` file and run the build to regenerate the JS runtime. This avoids dual maintenance of JS and TS implementations.
- Tests first: For any gameplay change (shields, XP, bullets), add unit tests under `test/` that seed the RNG and assert deterministic outcomes. Include a happy path and 1–2 edge cases for changes that affect build-time behavior (e.g., configuration-driven sampling).
- Preserve public APIs: `simulateStep`, Ship/Bullet property names, and the event shapes in the `state` object must be kept stable or updated together with tests and changelog.
- No runtime dependencies: Avoid adding browser runtime dependencies. Dev dependencies (Vitest, esbuild, http-server) are acceptable.
- Respect the repo style: 2-space indentation, semicolons, const/let usage.

GameManager & spawn behavior (important)
----------------------------------------
- The GameManager implementation is authored in `src/gamemanager.ts` (authoritative). The build process transpiles TypeScript runtime sources into their `.js` equivalents prior to bundling so runtime JS is generated from the TypeScript source.
- When adding or changing behavior used by UI (for example `spawnShip()` or `formFleets()`), update `src/gamemanager.ts`. The UI calls into the manager API (for example `gm.spawnShip()` and `gm.formFleets()`), so keeping the TS source authoritative prevents desyncs between dev-time JS and TS implementations.
- spawnShip semantics: calling `spawnShip(team)` without an explicit ship type will sample types according to `TeamsConfig.defaultFleet.counts` when present. If counts are absent or empty the manager falls back to `getDefaultShipType()` for deterministic tests.

Testing and quality gates
-------------------------
- Run tests: `npm test` (runs Vitest). Ensure all new tests pass.
- After code edits run:

```powershell
npm test
node ./scripts/build-standalone.mjs
```

- If you add a new constant to `src/progressionConfig.ts`, include a unit test
	that exercises the behavior at two different values so regressions are
	detectable.

Config changes — quick validation
---------------------------------
- When changing any `src/config/*` values (balance or visuals), run:
	- `npm run validate-config` to validate config shapes and invariants.
	- `npm test` to ensure deterministic/unit tests remain green.
	- Optionally `npm run build-standalone` and a Playwright smoke to visually sanity-check dist.

Build & dev workflow
--------------------
- Install dev deps: `npm install` (devDependencies include `vitest`, `esbuild`, `http-server`). If `npm install` fails on esbuild, ensure you have a compatible Node toolchain and try reinstalling.

- One-off build (creates `./dist/` and inlines a standalone HTML):

```powershell
npm run build
npm run build-standalone
```

- Note: The build includes a step that transpiles authoritative TS runtime files (for example `src/gamemanager.ts`) into JS runtime files in `src/` before bundling. Edit `.ts` sources and run the build to regenerate the runtime JS.

- Watch mode (rebuilds on changes):

```powershell
npm run build-standalone:watch
```

- Serve the project locally:

```powershell
npm run serve
# then open http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue.html
npm run serve:dist
# then open http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue.html
```


Contributor & automated-agent guidance (high-level)
--------------------------------------------------
This project benefits from concise, low-risk contributions. Keep guidance for
both humans and automated agents intentionally high-level so contributors can
make safe, test-backed changes.

High-level rules:
- Follow explicit human directions. If a request is ambiguous or high-risk,
  ask one brief clarifying question before changing code.
- State a short intent line before making non-trivial edits (what file and why).
- Prefer small, surgical changes. Avoid wide refactors unless coordinated in
  a design doc and accompanied by tests.
-- Preserve determinism: use the seeded RNG (`src/rng.ts`) for
  simulation logic and update tests when behavior changes.
- Add unit tests for behavioral changes (happy path + 1–2 edge cases) and run
  the test suite locally before committing.
- Do not exfiltrate secrets or call external network APIs from CI or tests.
- For larger design decisions, create a short Decision Record in
  `.github/DECISIONS/` with rationale and test coverage notes.

Commit messages: use conventional short prefixes (e.g., `feat:`, `fix:`, `test:`)
and include a one-line description of the change.

Appendix: Useful snippets & patterns
-----------------------------------
	- Seed RNG in tests to make simulations deterministic:

```ts
import { srand } from '../src/rng.ts';
srand(12345);
```

- Minimal simulateStep test pattern (Vitest):

```ts
import { test, expect } from 'vitest';
import { srand } from '../src/rng.ts';
import { simulateStep } from '../src/simulate.ts';

test('simulateStep emits shieldHits on shield absorption', () => {
  srand(1);
  const state = { ships: /* small fleet */, bullets: [], explosions: [], shieldHits: [], healthHits: [] };
  simulateStep(state, 0.016, { W: 800, H: 600 });
  expect(state.shieldHits.length).toBeGreaterThanOrEqual(0);
});
```

Maintainers
-----------
- Repo owner: deadronos
- Primary branch: `main`
- Current working branch (example): `webgl`

If you are an automated agent performing large work, open a draft PR and link
this file in the PR description so reviewers can validate the agent's
compliance with these instructions.

Contact
-------
If anything in these instructions is unclear, open an issue titled
"clarify: copilot instructions" with a one-paragraph request and a code
example if relevant.

update/overwrite /spec/IMPLEMENTATION_STATUS.md with recent completed goals and and shortterm and longterm goals or current state of the project