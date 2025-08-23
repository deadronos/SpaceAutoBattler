# Implementation status — SpaceAutoBattler

This file records the current implementation progress and verification status for the recent changes to the progression system: function-valued scalars, new progression axes, validator updates, simulation application, tests, and build verification.

## Summary (high-level)

- Goal: Support number-or-function progression scalars (e.g., exponential `xpToLevel`, diminishing `hpPercentPerLevel`), add `speedPercentPerLevel` and `regenPercentPerLevel`, update validation and simulation to handle functions, and add tests and build verification.
- Branch: `webgl` (working branch); default branch: `main`.

## Completed work

- Progression config updated (JS + TS): function-valued scalars and new fields added:

  - `xpToLevel(level) => 100 * 1.25^(level - 1)` (function)
  - `hpPercentPerLevel(level) => Math.min(0.10, 0.05 + 0.05 / Math.sqrt(level))` (function)
  - `dmgPercentPerLevel`, `shieldPercentPerLevel` (numbers)
  - `speedPercentPerLevel`, `regenPercentPerLevel` (numbers)

- Validator updated to accept number OR function for per-level scalars and to allow speed/regen fields.

- Simulation updated (`simulate.ts` / `simulate.js`): added `resolveScalar` helper that calls functions with the level or treats numeric scalars directly. Resolved scalars are applied at level-up to HP/damage/shields and to speed and shield-regen where applicable.

- Tests added and exercised:

  - `test/vitest/progression.spec.ts` — unit tests for `xpToLevel` and `hpPercentPerLevel` numeric outputs (passed).
  - `test/vitest/progression-application.spec.ts` — smoke test that seeds XP to trigger a deterministic level-up and asserts `accel` and `shieldRegen` were multiplied by `1 + speedPercentPerLevel` and `1 + regenPercentPerLevel` (updated to seed XP; passed).

- Standalone build verification: ran `npm run build-standalone` and inspected `dist/simWorker.js`. The bundled worker contains the inlined `progression` object with function-valued entries and the `resolveScalar` usage in `simulateStep`.

## Verification status

- Targeted unit tests: `progression.spec.ts` and `progression-application.spec.ts` — both pass locally with Vitest.

- Dist bundle inspection: `dist/simWorker.js` contains function-valued progression entries and level-up application logic.

## Pending / follow-ups

- Run the full Vitest suite to ensure there are no regressions (recommended next step).

- Add tests for multi-level progression (multiple sequential level-ups) and for hp/dmg/shield scaling across several levels.

- Optionally run headless Playwright checks against the built standalone (`dist/`) to verify worker runtime in a browser environment.

## Notes and considerations

- Tests that assert level-up side-effects must seed XP to just below `xpToLevel` to deterministically exercise the level-up code path.

- Current bundler preserves function-valued config entries; if bundling is changed later (e.g., to JSON-only), functions may be lost. If that occurs, consider either expanding functions to numeric tables at build-time or serializing function parameters rather than raw functions.

## Recent actions (traceability)

- Ran targeted Vitest smoke test: `test/vitest/progression-application.spec.ts` — passed after seeding XP to trigger level-up.

- Built standalone (`npm run build-standalone`) and inspected `dist/simWorker.js`.

## Current todo status

- `Update IMPLEMENTATION_STATUS.md` — completed (this file)
- `Verify full test run` — not-started (recommended)
- `Rebuild & smoke-run standalone` — not-started (recommended)

---

If you'd like, I can now run the full Vitest suite and/or rebuild + run the standalone in a headless Playwright test and report results. Tell me which you'd prefer next.
# Implementation status summary — SpaceAutoBattler

This document records the current implementation progress and verification status for the recent changes to the progression system (function-valued scalars, new progression axes, validator updates, simulation application, and tests).

## Summary (high-level)

- Goal: Extend the progression system to support number-or-function scalars (e.g., exponential `xpToLevel`, diminishing `hpPercentPerLevel`), add `speedPercentPerLevel` and `regenPercentPerLevel`, update validation and simulation to handle functions, and add tests and build verification.

- Branch: `webgl` (working branch); default branch: `main`.

## Completed work

- Progression config updated (JS + TS): added function-valued scalars and new fields:

  - `xpToLevel(level) => 100 * 1.25^(level - 1)` (function)
  - `hpPercentPerLevel(level) => Math.min(0.10, 0.05 + 0.05 / Math.sqrt(level))` (function)
  - `dmgPercentPerLevel`, `shieldPercentPerLevel` (numbers)
  - `speedPercentPerLevel`, `regenPercentPerLevel` (numbers)

- Validator updated: accepts number OR function for per-level scalars and optional speed/regen fields.

- Simulation updated (`simulate.ts` / `simulate.js`): added `resolveScalar` helper that calls functions with the relevant level or treats numeric scalars directly. At level-up, resolved scalars are applied to HP/damage/shields as before and to speed and shield-regen where applicable.

- Tests added:

  - `test/vitest/progression.spec.ts` — unit tests for `xpToLevel` and `hpPercentPerLevel` numeric outputs (passed).
  - `test/vitest/progression-application.spec.ts` — smoke test that seeds XP to trigger a deterministic level-up and asserts `accel` and `shieldRegen` were multiplied by `1 + speedPercentPerLevel` and `1 + regenPercentPerLevel` (updated to seed XP; re-run passed).

- Build verification: ran the standalone build and inspected `dist/simWorker.js`; the bundled worker contains the inlined `progression` object with function-valued entries and the `resolveScalar` usage in `simulateStep`.

## Verification status

- Unit tests (targeted): `progression.spec.ts` and `progression-application.spec.ts` — both pass locally (Vitest).

- Dist bundle inspection: `dist/simWorker.js` contains function-valued progression entries and level-up application logic.

## Pending / follow-ups

- Run the full Vitest suite to ensure nothing else regresses (recommended next step).

- Add additional tests for multi-level progression (multiple successive level-ups) and for hp/dmg/shield scaling across several levels.

- Optionally run a headless/Playwright test against the built standalone (`dist/`) to verify worker runtime in a browser environment.

## Notes and considerations

- Tests that assert level-up side-effects must ensure preconditions (seed XP to just below `xpToLevel`) to deterministically exercise the level-up code path.

- The current bundler preserves function-valued config entries; if you later change bundling to a JSON-only config or serialize configs, functions may be lost and you'll need a different strategy (e.g., explicit numeric expansion at build-time or serializing function parameters rather than functions).

## Recent actions (for traceability)

- Ran targeted Vitest smoke test: `test/vitest/progression-application.spec.ts` — passed after seeding XP to trigger level-up.

- Built standalone (`npm run build-standalone`) and inspected `dist/simWorker.js`.

## Current todo status

- `Update IMPLEMENTATION_STATUS.md` — completed (this file)
- `Verify full test run` — not-started (recommended)
- `Rebuild & smoke-run standalone` — not-started (recommended)

If you'd like, I can now run the full Vitest suite and/or rebuild + run the standalone in a headless Playwright test and report results. Tell me which you'd prefer next.
Implementation status summary — SpaceAutoBattler

This document records the current implementation progress and verification status for the recent changes to the progression system (function-valued scalars, new progression axes, validator updates, simulation application, and tests).

Summary (high-level)
- Goal: Extend the progression system to support number-or-function scalars (e.g., exponential xpToLevel, diminishing hpPercentPerLevel), add speedPercentPerLevel and regenPercentPerLevel, update validation and simulation to handle functions, and add tests and build verification.
- Branch: webgl (working branch), default branch: main

Completed work
- Progression config updated (JS + TS): added function-valued scalars and new fields:
	- `xpToLevel(level) => 100 * 1.25^(level - 1)` (function)
	- `hpPercentPerLevel(level) => Math.min(0.10, 0.05 + 0.05 / Math.sqrt(level))` (function)
	- `dmgPercentPerLevel`, `shieldPercentPerLevel` (numbers)
	- `speedPercentPerLevel`, `regenPercentPerLevel` (numbers)
- Validator updated: accepts number OR function for per-level scalars and optional speed/regen fields.
- Simulation updated (`simulate.ts` / `simulate.js`): added `resolveScalar` helper that calls functions with the relevant level or treats numeric scalars directly. At level-up, resolved scalars are applied to HP/damage/shields as before and to speed and shield-regen where applicable.
- Tests added:
	- `test/vitest/progression.spec.ts` — unit tests for `xpToLevel` and `hpPercentPerLevel` numeric outputs (passed).
	- `test/vitest/progression-application.spec.ts` — smoke test that seeds XP to trigger a deterministic level-up and asserts `accel` and `shieldRegen` were multiplied by `1 + speedPercentPerLevel` and `1 + regenPercentPerLevel` (updated to seed XP; re-run passed).
- Build verification: ran the standalone build and inspected `dist/simWorker.js`; the bundled worker contains the inlined `progression` object with function-valued entries and the `resolveScalar` usage in `simulateStep`.

Verification status
- Unit tests (targeted): `progression.spec.ts` and `progression-application.spec.ts` — both pass locally (Vitest).
- Dist bundle inspection: `dist/simWorker.js` contains function-valued progression entries and level-up application logic.

Pending / follow-ups
- Run the full Vitest suite to ensure nothing else regresses (recommended next step).
- Add additional tests for multi-level progression (multiple successive level-ups) and for hp/dmg/shield scaling across several levels.
- Optionally run a headless/Playwright test against the built standalone (`dist/`) to verify worker runtime in a browser environment.

Notes and considerations
- Tests that assert level-up side-effects must ensure preconditions (seed XP to just below xpToLevel) to deterministically exercise the level-up code path.
- The current bundler preserves function-valued config entries; if you later change bundling to a JSON-only config or serialize configs, functions may be lost and you'll need a different strategy (e.g., explicit numeric expansion at build-time or serializing function parameters rather than functions).

Recent actions (for traceability)
- Ran targeted Vitest smoke test: `test/vitest/progression-application.spec.ts` — passed after seeding XP to trigger level-up.
- Built standalone (`npm run build-standalone`) and inspected `dist/simWorker.js`.

Current todo status
- `Update IMPLEMENTATION_STATUS.md` — completed (this file)
- `Verify full test run` — not-started (recommended)
- `Rebuild & smoke-run standalone` — not-started (recommended)

If you'd like, I can now run the full Vitest suite and/or rebuild + run the standalone in a headless Playwright test and report results. Tell me which you'd prefer next.






I'll scan the src directory for obvious hardcoded values (hex colors, magic numbers around UI/visuals, thresholds) to build a concrete report of what should be moved into config and whether existing configs are already used. I'll search for hex colors and other likely magic constants. I’ll scan src for magic numbers and hardcoded visuals, note whether a config already exists, and suggest where each value should live so render/sim remain tunable and consistent.

## Findings by file (what’s hardcoded vs. config)

### canvasrenderer.ts
- Background color
  - Hardcoded: `ctx.fillStyle = '#0b1220'`
  - Should be: A palette entry (e.g., `AssetsConfig.palette.background`) or `RendererConfig.background`.
  - Current usage of config: none for background.

- Damage thresholds
  - Hardcoded: `hpPct < 0.66` → moderate, `< 0.33` → heavy.
  - Should be: Config thresholds (e.g., `AssetsConfig.damageThresholds = { moderate: 0.66, heavy: 0.33 }`).
  - Current usage of config: uses `AssetsConfig.damageStates` for colors/opacity, but thresholds are inline here.

- Damage overlay color fallback
  - Hardcoded fallback: `'#ff6b6b'`
  - Should be: Only via `damageStates` with no local fallback, or fallback via `AssetsConfig.palette`.
  - Current usage of config: uses `vconf.damageStates` or `AssetsConfig.damageStates` if present.

- Shield effect stroke width fallback
  - Hardcoded: `(sh.strokeWidth || 0.08)`
  - Should be: Set in `AssetsConfig.animations.shieldEffect.strokeWidth`.
  - Current usage of config: Reads `shieldEffect` from animations; strokeWidth not declared in config (should be added).

- Shield effect color fallback
  - Hardcoded fallback: `'#88ccff'`
  - Should be: Only via `animations.shieldEffect.color` (or a palette key).
  - Current usage of config: Reads animation color, but maintains a local fallback.

- Engine flare alpha scaling constant
  - Hardcoded: `ctx.globalAlpha = 0.4 * pulse`
  - Should be: Configurable, e.g., `AssetsConfig.animations.engineFlare.alpha`.
  - Current usage of config: Uses engine polygon and pulseRate; alpha factor is inline.

- HP bar styling and metrics
  - Hardcoded: colors `'#222'`, `'#4caf50'` and geometry offsets `-10, -12`, width `20`, height `4`.
  - Should be: In a small renderer UI config (e.g., `RendererConfig.hpBar = { bg:'#222', fill:'#4caf50', w:20, h:4, dx:-10, dy:-12 }`).
  - Current usage of config: none for HP bar visuals.

- Damage particle spawn for state.damageEvents
  - Config usage: Good — uses `AssetsConfig.animations.damageParticles` for `color`, `lifetime`, `count`, `spread`.
  - Hardcoded fallback: none except default shape and scalar defaults if the config is absent.

- Bullet visuals
  - Config usage: Good — uses `AssetsConfig.palette.bullet` and assets for shape mapping.

### webglrenderer.ts
- Clear color
  - Hardcoded: `gl.clearColor(0.02, 0.03, 0.06, 1.0)`
  - Should be: Config palette background (e.g., `AssetsConfig.palette.backgroundGL` or derive from `background` hex).
  - Current usage of config: none for background.

- Inline palette fallbacks
  - Hardcoded fallbacks: `'#888'` (base hull), `'#ffd27f'` (accent), `'#88ccff'` (shield), `'#ff6b6b'` (damage).
  - Should be: Always through `AssetsConfig.palette`, `damageStates`, or animation configs with no inline hex.
  - Current usage of config: Reads team color, palette, damageStates; but keeps hex fallbacks.

- Damage thresholds and alpha math
  - Hardcoded: thresholds 0.66/0.33; alpha scaling `(dcfg.opacity || 0.5)`.
  - Should be: Thresholds in config; opacity via `damageStates` (ok). Alpha scaling factor is OK since it uses configured opacity.

- Shield pulse alpha math
  - Hardcoded scaling: `Math.min(1, 0.25 + 0.75 * shieldPct)` and radius multiplier `(sh.r || 1.6)`.
  - Should be: In animation config (e.g., `shieldEffect.alphaBase/alphaScale` and `radiusScale`).
  - Current usage of config: Reads `pulseRate`, `color`, `r` (radius) — but uses inline alpha transform.

- Engine flare pulse alpha
  - Hardcoded: `0.35 * pulse`
  - Should be: In animation config (see above for Canvas).
  - Current usage of config: Pulse rate from config; alpha factor is inline.

### gamemanager.ts
- Explosion particles (on ship death)
  - Hardcoded: `count = 12`, `ttl = 0.6`, `color = 'rgba(255,200,100,0.95)'`, `size = 3`, speed range `30..120`.
  - Should be: Use `EXPLOSION` from gamemanagerConfig.ts (which already defines count, ttl, color, size, minSpeed, maxSpeed).
  - Current usage of config: Not used for explosions; shield and health hit particles do use `config.shield` / `config.health`.

- Shield and health hit particle defaults
  - Good: Uses `config.shield` and `config.health` which come from gamemanagerConfig.ts.

- Stars (background field)
  - Hardcoded defaults:
    - In `reset`: `initStars(..., 800, 600, 140)` and `createStarCanvas(..., 800, 600)`
    - In `initStars`: `r = 0.5..2.0`, `a = 0.3..1.0`, `twSpeed = 0.5..2.0`
    - In `createStarCanvas`: background `'#041018'`
  - Should be: Extend `STARS` config to include `count`, background color, radii and alpha ranges, twinkle speed range (and perhaps color).
  - Current usage of config: `STARS.twinkle` and `STARS.redrawInterval` only.

- Fallback reinforcements
  - Hardcoded positions: `(100,100)` and `(700,500)` for spawned fallback ships.
  - Should be: Optional tunables (e.g., `RendererConfig.debugFallbackPositions`) or a `TeamsConfig`/`GameManagerConfig` section, if you want test-deterministic yet configurable positions.
  - Current usage of config: none for these coordinates.

### `src/config/*` (relevant configs)
- `assets/assetsConfig.(ts|js)`
  - Has: palette (shipHull, shipAccent, bullet, turret), animations (engineFlare, shieldEffect, damageParticles), damageStates, shapes.
  - Missing for our use: 
    - `palette.background` for scene background (both Canvas and GL).
    - `damageThresholds` or equivalent to map hpPct → light/moderate/heavy.
    - `animations.shieldEffect.strokeWidth` (renderer uses a fallback 0.08).
    - Optional: `animations.engineFlare.alpha`, `animations.shieldEffect.alphaBase/alphaScale`, and engine/shield offsets.

- rendererConfig.ts
  - Has: preference and flags (preferred, allowUrlOverride, allowWebGL).
  - Could include: UI overlay settings (HP bar styling), background color override.

- `gamemanagerConfig.(ts|js)`
  - Has: `SHIELD`, `HEALTH`, `EXPLOSION`, `STARS` (twinkle + redraw).
  - Could include: `STARS.background`, `STARS.count`, `STARS.rRange`, `STARS.alphaRange`, `STARS.twinkleSpeedRange`.

- `teamsConfig.(ts|js)`
  - Team colors are correctly configured here and used in renderers.

- `entitiesConfig.(ts|js)`
  - Gameplay stats (hp, shieldRegen, radius) are correctly configured and used by simulation/creation.

### ui.html
- Inline styles with RGBA/hex
  - Hardcoded inline styling (e.g., semi-transparent dark panels).
  - Should be: In ui.css (most UI theming is already there).
  - Current usage of config: Not applicable (pure UI).

### ui.css
- Hardcoded colors
  - Fine — CSS is the right place for UI theme. If you want to unify game/scene colors, consider adding CSS variables and (optionally) generating values from config at build time, but not required.

## Suggested configuration additions and code touch-points

Minimal, low-risk config improvements:
- Add scene background to palette
  - Add `background: '#0b1220'` (or chosen color) to `AssetsConfig.palette`.
  - Use this in both `CanvasRenderer` and `WebGLRenderer` (convert hex to linear color for GL if desired).
- Add damage thresholds
  - Add `damageThresholds: { moderate: 0.66, heavy: 0.33 }` to `assetsConfig`.
  - Replace inline checks in both renderers with these thresholds.

- Add shield strokeWidth
  - Add `animations.shieldEffect.strokeWidth` (e.g., `0.08`) to `assetsConfig`.
  - Replace fallback in Canvas/WebGL.

Nice-to-have animation tunables:
- Add alpha scalars
  - `animations.engineFlare.alpha` (default 0.35–0.4)
  - `animations.shieldEffect.alphaBase`, `animations.shieldEffect.alphaScale`
  - Optional: `animations.engineFlare.offset` (e.g., `-0.9`) for behind-ship placement.

GameManager particles:
- Use `EXPLOSION` config in gamemanager.ts explosions block
  - Replace hardcoded count/ttl/color/size/speed range with `EXPLOSION` from gamemanagerConfig.ts.
- Extend `STARS` config
  - Add `count`, `background`, `rRange`, `alphaRange`, `twinkleSpeedRange`.
  - Use them in `initStars` and `createStarCanvas`.

HP bar styling:
- Add to rendererConfig.ts a small `hpBar` object:
  - `{ bg:'#222', fill:'#4caf50', w:20, h:4, dx:-10, dy:-12 }`
  - Replace inline constants in `CanvasRenderer`.

Fallback reinforcements:
- If desired to make tests flexible, add a `GameManagerConfig.fallbackSpawn` with positions and type; otherwise, leave as test fixture.

## What already uses configs correctly

- Ship/turret/bullet shapes: From `assetsConfig`.
- Bullet color: From `AssetsConfig.palette.bullet`.
- Team colors: From `TeamsConfig`.
- Engine/shield animations: Pulserate and geometry from `assetsConfig`.
- Damage overlay style: Color/opacity via `damageStates`.
- Shield/health hit particles: From `gamemanagerConfig` (good).
- Entities stats and bounds: From `entitiesConfig` and `displayConfig`.

## Proposed small changes (low-risk, future PR)

- Canvas/WebGL background: read from `AssetsConfig.palette.background`.
- Add and use `damageThresholds` in `assetsConfig`, remove inline 0.66/0.33.
- Add `strokeWidth` for shieldEffect animation in `assetsConfig`, stop using `0.08` fallback.
- Parameterize engine/shield alpha multipliers in animations (optional).
- gamemanager.ts explosions: switch to `EXPLOSION` config (already exists).
- `STARS` config: extend and wire in `reset/initStars/createStarCanvas`.
- HP bar: move to `rendererConfig.hpBar` and use in `CanvasRenderer`.
- ui.html: move inline styles to ui.css.

## Quick status summary

- Config already used: assets (shapes/palette/animations), teams, shield/health particles, entities, display.
- Hardcoded visuals found: background colors, damage thresholds, shield stroke width, HP bar visuals, GL clear color, some alpha scalars, stars defaults, explosion particle params.
- Highest-impact wins:
  - Background color to palette (Canvas + GL).
  - Explosion particles to `EXPLOSION` config (one place).
  - Damage thresholds to config.
  - Shield strokeWidth in animation config.

If you want, I can make a targeted patch that adds these config fields and replaces the handful of inline constants; it’s a small, contained change with minimal risk to behavior.