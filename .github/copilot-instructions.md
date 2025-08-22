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
		stat increases per level (HP, damage, shields) via `src/progressionConfig.js`.
	- Visual-only effects emitted by simulateStep: `explosions`, `shieldHits`,
		`healthHits` arrays in the `state` object.

Tech stack & runtime
--------------------
- Browser-side game: Vanilla ES modules with TypeScript source files (see `src/*.ts`) that compile to JS for the browser. Both a Canvas 2D renderer and a WebGL renderer are supported (see `src/canvasrenderer.ts` and `src/webglrenderer.ts`).
- Node.js used for dev tooling (build helpers) and tests.
- Testing: Vitest for unit tests (run with npm script `test`), and Playwright for end-to-end / visual browser tests (tests live under `test/playwright/`).
- Bundling/inlining: `scripts/build-standalone.mjs` (esbuild JS API) produces an inlined standalone HTML into `./dist/` and (optionally) overwrites the repo-root standalone file.
- Seeded RNG for deterministic simulation: `src/rng.ts` / `src/rng.js` (srand, unseed, srandom, srange, srangeInt). The simulation must use the seeded RNG; the renderer may use `Math.random()` for purely cosmetic (non-deterministic) effects.

Key files (what to edit for each concern)
----------------------------------------
- `src/entities.ts` / `src/entities.js` — Core gameplay objects and rules. Ship and Bullet definitions, damage and shield handling, XP/level code (Ship.gainXp, Ship.applyLevel). When modifying gameplay balance or mechanics, start here.
- `src/simulate.ts` / `src/simulate.js` — The deterministic time-step: `simulateStep(state, dt, bounds)`. Responsibilities: advance ships & bullets, resolve collisions, award XP, and push small event objects into `state.explosions`, `state.shieldHits`, and `state.healthHits`. Do not perform rendering here.
- `src/canvasrenderer.ts` — Canvas 2D renderer implementation. Draws ships, bullets, particles and handles DPR/backing-store transforms. When fixing visual issues related to scale or crispness, look here.
- `src/webglrenderer.ts` — WebGL renderer implementation (WebGL2 then fallback to WebGL1). Contains viewport and scale handling; currently a minimal drawing path—contributions to fully implement ship rendering here are welcome but non-trivial.
- `src/rng.ts` / `src/rng.js` — Seeded RNG used by the simulation. Always use this for logic randomness to remain deterministic across runs/tests.
- `src/progressionConfig.ts` / `src/progressionConfig.js` — All XP and per-level scaling constants.
- `src/main.ts` / `src/main.js` — App bootstrap: canvas setup, renderer selection, and dev UI hooks (including the renderer scale slider). Contains `fitCanvasToWindow()` which computes backing-store size using `devicePixelRatio * RendererConfig.rendererScale`.
- `space_themed_autobattler_canvas_red_vs_blue.html` — Main page, imports the compiled renderer as a module.
- `space_themed_autobattler_canvas_red_vs_blue_standalone.html` — Single-file exported inlined build (created by `scripts/build-standalone.mjs`).
- `scripts/build-standalone.mjs` — Bundles renderer code (from `src/`) and inlines the result into HTML for distribution. Supports a watch mode.
- `test/vitest/` — Unit tests (Vitest) verifying deterministic simulation and unit behaviors (e.g., `simulate.spec.ts`, `entities.spec.ts`, `rng.spec.ts`).
- `test/playwright/` — Playwright end-to-end and visual tests (e.g., checks that `dist/` builds produce expected visuals). Follow the project's Playwright guidelines in `.github/instructions/playwright-typescript.instructions.md`.

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
		`src/rng.js` for any randomness in game logic. The renderer may use
		non-deterministic randomness (Math.random) for cosmetic variety only.

Coding & contribution rules (human + automated)
---------------------------------------------
- Keep changes minimal: modify the smallest number of files necessary.
- Tests first: For any gameplay change (shields, XP, bullets), add unit
	tests under `test/` that seed the RNG and assert deterministic outcomes.
- Preserve public APIs: `simulateStep`, Ship/Bullet property names, and the
	event shapes in the `state` object must be kept stable or updated together
	with tests and changelog.
- No runtime dependencies: Avoid adding browser runtime dependencies. Dev
	dependencies (Vitest, esbuild, http-server) are acceptable.
- Respect the repo style: 2-space indentation, semicolons, const/let usage.

Testing and quality gates
-------------------------
- Run tests: `npm test` (runs Vitest). Ensure all new tests pass.
- After code edits run:

```powershell
npm test
node ./scripts/build-standalone.mjs
```

- If you add a new constant to `src/progressionConfig.js`, include a unit test
	that exercises the behavior at two different values so regressions are
	detectable.

Build & dev workflow
--------------------
- Install dev deps: `npm install` (devDependencies include `vitest`,
	`esbuild`, `http-server`). If `npm install` fails on esbuild, ensure you
	have a compatible Node toolchain and try reinstalling.
- One-off build (creates `./dist/` and inlines a standalone HTML):

```powershell
npm run build-standalone
```

- Watch mode (rebuilds on changes):

```powershell
npm run build-standalone:watch
```

- Serve the project locally:

```powershell
npm run serve
# then open http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue.html
```

Copilot / GPT-5 agent guidance (explicit, machine-actionable)
----------------------------------------------------------
This section tells an automated coding agent (like Copilot or a custom GPT-5
integration) exactly how to behave in this repository. Follow these rules in
order — they are intentionally strict to prevent accidental regressions.

1) Primacy of user directions

	- If the human user gives a direct and explicit instruction (e.g. "Edit
		`src/entities.js` to add X"), perform that change. If unclear, ask one
		brief clarifying question.

2) Always state intent before making edits or running tools

	- Before calling any edit or terminal tool, print a single concise line of
		intent explaining what you will change and why. Example: "I'll update
		`src/entities.js` to apply the ship's damage multiplier to newly created
		bullets so progression affects combat." Then perform the edit.

3) Minimal edits & surgical modifications

	- Make the smallest, safest change that accomplishes the request. Do not
		reformat unrelated files or perform wide refactors unless explicitly
		instructed.

4) Preserve deterministic contracts

	- Never change code that affects determinism (seeded RNG usage, math order
		of operations) without updating tests that validate determinism.

5) Tests: write them first when adding gameplay behavior

	- For new gameplay features (XP, shields, damage-scaling), add a small set
		of unit tests: a happy-path test plus 1-2 edge cases (zero/overflow,
		min/max). Run Vitest and ensure green before finalizing the change.

6) Safety and content rules

	- Never exfiltrate secrets or call external network APIs. Avoid including
		long copyrighted passages. If asked to generate content that is abusive,
		violent, or sexual, refuse per policy.

7) In-code documentation & reasoning

	- For non-trivial logic changes, add a short comment (2-4 lines) explaining
		why the change was made and referencing the relevant test file and
		`progressionConfig.js` keys if relevant.

8) When in doubt, ask a single clarifying question

	- If a requested change is ambiguous or high-risk, ask one concise
		question in chat rather than making assumptions. Example: "Should
		damage-scaling be applied to existing bullets in-flight or only to bullets
		created after level-up?"

9) Commit message guidance

	- Use short, descriptive commit messages. For feature work use: "feat:"
		prefix; bugfixes use "fix:"; tests use "test:". Example: "feat: apply
		ship damage multiplier to new bullets and add unit tests".

10) Changelogs & decision records

	- For larger design changes, create a short Decision Record in
		`.github/DECISIONS/` describing the choice, alternatives considered, and
		implications for determinism, tests, and performance.

Examples of good Copilot behavior (do these)
------------------------------------------
- Add a unit test when changing numeric behavior (XP, damage, shield regen).
- Make a small change: update `Bullet` creation to multiply `dmg` by
	`ship.damageMultiplier` and add a test that seeds RNG, levels a ship, and
	verifies post-level bullets have increased damage.
- Run tests and report results in the final message.

Examples of bad Copilot behavior (avoid these)
-------------------------------------------
- Large, unrelated refactors or style-only changes across many files.
- Changing simulation event shapes (`simulateStep` contract) without tests
	and coordinated renderer updates.
- Adding runtime browser dependencies without explicit user approval.

Appendix: Useful snippets & patterns
-----------------------------------
- Seed RNG in tests to make simulations deterministic:

```js
import { srand } from '../src/rng.js';
srand(12345);
```

- Minimal simulateStep test pattern (Vitest):

```js
import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { simulateStep } from '../src/simulate.js';

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
- Current working branch (example): `shields-and-xp/level-progression`

If you are an automated agent performing large work, open a draft PR and link
this file in the PR description so reviewers can validate the agent's
compliance with these instructions.

Contact
-------
If anything in these instructions is unclear, open an issue titled
"clarify: copilot instructions" with a one-paragraph request and a code
example if relevant.

