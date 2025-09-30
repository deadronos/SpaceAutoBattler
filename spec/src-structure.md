# Source (src) structure

Updated on: 2025-09-30

This document lists the files and folders under `src/` with a concise
purpose summary for each entry. It's intended to help new contributors find
core systems and understand responsibilities across the codebase.

Files are grouped by subdirectory. Descriptions focus on the primary role,
key exports, and any notable dependencies or behaviors.

## Root files

- `App.tsx` — Main React application component; renders the game canvas, HUD,
  and controls.
- `AGENTS.md` — High-level agents guide for the entire `src` directory. Covers
  purpose, language, and best practices.

## `src/components`

- `AGENTS.md` — Agents guide for React components, emphasizing patterns,
  performance, and testing.
- `Hud.tsx` — Renders the main HUD with team summaries, health overlays, and
  toggle drawers.
- `hudToggleConfig.ts` — Defines toggle configurations for HUD settings and
  debug overlays.
- `derived.ts` — Computes derived particle data (debris, sparks, etc.) from
  explosion events.
- `constants.ts` — Explosion rendering constants (capacities, lifetimes).
- `Turret.tsx` — Renders turret entities with optional debug gizmos and muzzle
  flashes.
- `ShipHudOverlay.tsx` — Individual ship health bar overlay with status
  effects.
- `shieldUtils.ts` — Utilities for shield fraction computation and
  validation.
- `ExplosionRenderer.tsx` — Instanced rendering for explosion effects
  (flash, shockwave, particles).
- `ExplosionDebugOverlay.tsx` — Debug UI for explosion events and
  configuration.
- `Explosion.tsx` — Placeholder for single explosion mesh rendering.
- `rippleUtils.ts` — Processes shield ripples for rendering (scaling,
  coalescing).
- `ShipShield.tsx` — Renders shield bubble with hex or transmission material.
- `ShipModel.tsx` — Loads and manages ship GLTF models with material handling.
- `HudOverlayCollector.tsx` — Collects ship positions for HUD overlays.
- `HudHealthLayer.tsx` — Manages layout and rendering of health overlays.
- `PerfMonitorOverlay.tsx` — Draggable performance monitor using r3f-perf.
- `ParticleTrails.tsx` — Instanced particle system for ship engine exhaust.
- `HudToggleDrawer.tsx` — Reusable drawer for HUD toggles and settings.
- `TurretsLayer.tsx` — Renders all turret entities.
- `StarsField.tsx` — Renders static starfield points.
- `ShipsLayer.tsx` — Renders all ship entities and particle trails.
- `ProjectilesLayer.tsx` — Renders all projectile entities.
- `PostprocessingLazy.tsx` — Lazy-loaded postprocessing component.
- `Postprocessing.tsx` — Selective bloom and FXAA postprocessing setup.
- `Controls.tsx` — UI controls for pause, reset, and spawning ships.
- `BattlefieldSystems.tsx` — Fixed-step simulation integration.
- `Battlefield.tsx` — Main Three.js canvas with scene, lights, and layers.

## `src/config`

- `AGENTS.md` — Agents guide for configuration files.
- `hudHealth.ts` — HUD health bar and status effect configurations.
- `explosions.ts` — Explosion visual and timing configurations.
- `experiments.ts` — AI experiment flags and overrides.
- `environment.ts` — Celestial environment (planets, stars, skysphere).
- `carriers.ts` — Carrier launch system configuration.
- `projectiles.ts` — Projectile visual and collider configurations.
- `progression.ts` — Ship progression, XP, and damage type configs.
- `starDiskDebug.ts` — Debug settings for star disk rendering.

## `src/game`

- `AGENTS.md` — Agents guide for the game simulation layer.
- `README.md` — World configuration and setup notes.
- `progression.ts` — Ship progression system (XP, levels, subsystems).
- `metrics.ts` — AI decision and performance metrics tracking.
- `explosions.ts` — Explosion event management and pooling.
- `context.tsx` — React context for `GameState` provider.
- `config.ts` — World bounds, AI flags, and simulation parameters.
- `ships.ts` — Ship stats, spawning, and blueprint handling.
- `aiTraits.ts` — Deterministic AI trait generation from seeds.
- `aiScenarioHarness.ts` — AI scenario testing harness.
- `state.ts` — `GameState` creation, disposal, and fleet spawning.
- `validation.ts` — Motion stats validation utilities.
- `uiStore.ts` — Zustand store for UI state (pause, toggles).
- `turretRegistry.ts` — Turret entity registration and cleanup.
- `integration.ts` — Test harness integration logic.
- `types.ts` — AI scenario and metrics types.
- `stateBuilder.ts` — Builds test harness state.
- `metricsSummary.ts` — Summarizes AI test metrics.
- `logging.ts` — Serializes and logs scenario data.
- `shipControl.ts` — Physics-based ship motion updates.
- `combat.ts` — Projectile firing, collision, and damage resolution.
- `carriers.ts` — Carrier fighter launch mechanics.
- `manager.ts` — AI decision system core.
- `blackboard.ts` — Shared AI blackboard updates.
- `interrupts.ts` — AI intent interrupt handling.
- `intents.ts` — AI intent scoring and selection.
- `intent-utils.ts` — Shared intent utilities.
- `combat-intents.ts` — Attack, kite, flee scoring.
- `tactical-intents.ts` — Intercept, reposition scoring.
- `formation-intents.ts` — Regroup, escort scoring.

## `src/hooks`

- `AGENTS.md` — Agents guide for custom React hooks.
- `useShipThrusters.ts` — Manages ship thruster glow materials.
- `useShipInterpolation.ts` — Smooths ship motion for rendering.
- `usePrefersReducedMotion.ts` — Detects reduced motion preference.
- `usePlanetTexture.ts` — Loads and configures planet textures.
- `useArchetypeEntities.ts` — Subscribes to ECS archetype changes.

## `src/renderer`

- `AGENTS.md` — Agents guide for rendering utilities.
- `BloomProvider.tsx` — Selective bloom context and registration.
- `rippleDebug.ts` — Debug ripple count tracking (unused).
- `materialRegistry.tsx` — Registers shader materials for entities.
- `starDiskOrientation.ts` — Computes star disk view alignment.
- `starDiskMaterial.ts` — Main sequence star shader material.
- `starDisk.vertex.glsl` — Star disk vertex shader.
- `starDisk.fragment.glsl` — Star disk fragment shader.
- `mainsequencestar.glsl` — Main sequence star fragment shader.

## `src/styles`

- `AGENTS.md` — Agents guide for CSS assets.
- `app.css` — Global styles for HUD, overlays, and layout.

## `src/types`

- `AGENTS.md` — Agents guide for TypeScript declarations.
- `jsx-compat.d.ts` — JSX compatibility shim for React 19.
- `assets.d.ts` — Type declarations for asset modules.
- `glsl.d.ts` — GLSL module declaration.
- `index.ts` — Core types (`GameState`, entities, AI).
- `react-three-drei.d.ts` — Ambient declaration for `@react-three/drei`.

## `src/utils`

- `AGENTS.md` — Agents guide for utilities.
- `rng.ts` — Seeded RNG for deterministic randomness.
- `deterministicLerp.ts` — Seeded lerp for consistent easing.
- `color.ts` — Color conversion and config utilities.
- `patchGltfLoader.ts` — Runtime patch for `GLTFLoader`.

## `src/assets`

- `AGENTS.md` — Agents guide for static assets.
- `starDiskTextures.ts` — Star disk texture paths.
- `skysphere.ts` — Skysphere texture paths.
- `ships.ts` — Ship GLTF model paths.
- `planets.ts` — Planet texture paths.

## Notes

- Total files: ~135 (including subdirectories and assets).
- Core focus: Simulation (`game/`) and rendering (`renderer/`,
  `components/`) dominate; hooks bridge React and Three.js.
- Dependencies: Types centralize shared shapes; configs provide tweakable
  values without code changes.
- Testing: Most files have Vitest specs or Playwright coverage; see `test/`
  for details.
