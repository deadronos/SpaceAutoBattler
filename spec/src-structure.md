# Source (src) structure

Updated on: 2025-12-19

This document lists the files and folders under `src/` with a concise
purpose summary for each entry. It's intended to help new contributors find
core systems and understand responsibilities across the codebase.

Files are grouped by subdirectory. Descriptions focus on the primary role,
key exports, and any notable dependencies or behaviors.

## Root files

- `App.tsx` — Main React application component; renders the game canvas, HUD,
  and controls.
- `main.tsx` — Application entry point / React DOM bootstrap.
- `AGENTS.md` — High-level agents guide for the entire `src` directory.
  Covers purpose, language, and best practices.
- `ui.html` — Static HTML shell used by local demos and tests.

## `src/components`

- `AGENTS.md` — Agents guide for React components, emphasizing patterns,
  performance, and testing.
- `Hud.tsx` — Renders the main HUD with team summaries, health overlays, and
  toggle drawers.
- `hudToggleConfig.ts` — Defines toggle configurations for HUD settings and
  debug overlays.

- Note: explosion rendering utilities live under `src/components/explosions/`.
  See that folder for `derived.ts`, `constants.ts`, `DynamicLightManager.tsx`,
  and `materials.ts`.

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
- `Ship.tsx` — Higher-level ship render wrapper (uses `ShipModel.tsx`).
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
- `AiDebugOverlay.tsx` — Developer overlay showing AI-related debug info.
- `Projectile.tsx` — Single projectile mesh and helpers.
- `ProgressionPanel.tsx` — Dev UI for progression/debug controls.

### `src/components/environment`

- `CelestialEnvironment.tsx` — Wrapper for planet, star, and skysphere
  rendering.
- `ParallaxBillboard.tsx` — Parallax-backed billboards for distant effects.
- `PlanetBody.tsx`, `PlanetRimShell.tsx`, `PlanetRings.tsx` — Planet body
  components and ring visuals.
- `Skysphere.tsx` — Skysphere background loader.
- `StarDisk.tsx`, `StarLight.tsx` — Star disk and light helpers.

### `src/components/explosions`

- `derived.ts` — Computes derived particle data (debris, sparks, etc.) from
  explosion events.
- `constants.ts` — Explosion rendering constants (capacities, lifetimes).
- `DynamicLightManager.tsx` — Manages transient dynamic lights for explosions.
- `materials.ts` — Explosion-related material helpers and shader uniforms.

### `src/components/layers`

- `ProjectilesLayer.tsx`, `ShipsLayer.tsx`, `TurretsLayer.tsx`,
  `StarsField.tsx` — Instanced/aggregate render layers for entity groups.

### `src/components/postprocessing`

- `buildEffects.ts` — Builds postprocessing effect passes (bloom, tone, blur)
  and config used by the composer.
- `createComposer.ts` — Creates and wires a postprocessing composer for a
  renderer and the provided passes (used by `Postprocessing.tsx`).

### `src/components/ship`

- `rippleUtils.ts`, `shieldUtils.ts`, `ShipModel.tsx`, `ShipShield.tsx` —
  Ship rendering helpers and utilities.

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
- `renderer.ts` — Renderer-related runtime options (postprocessing toggles,
  quality presets).

## `src/game`

- `AGENTS.md` — Agents guide for the game simulation layer.
- `README.md` — World configuration and setup notes.
- `SimulationBridge.ts` — Worker simulation bridge (feature-flagged); streams snapshots to the renderer.
- `progression.ts` — Ship progression system (XP, levels, subsystems).
- `progression/` — Progression helpers and subsystem implementations.
- `metrics.ts` — AI decision and performance metrics tracking.
- `metrics/` — Metrics helpers and aggregation utilities.
- `explosions.ts` — Explosion event management and pooling.
- `context.tsx` — React context for `GameState` provider.
- `config.ts` — World bounds, AI flags, and simulation parameters.
- `ships.ts` — Ship creation/spawning; turret setup; re-exports `SHIP_STATS`.
- `createGameState.ts` — Constructs the canonical `GameState` (Rapier init, ECS queries, RNG seed).
- `entityLifecycle.ts` — `destroyEntity` / `disposeGameState` cleanup utilities.
- `spawnFleets.ts` — `spawnInitialFleets` / `spawnRandomShip` implementation.
- `resetGame.ts` — `resetGame` plus `requestReset` (post-physics scheduling).
- `simulationQueue.ts` — Deferred mutation queues, diagnostics recording, debug snapshot publishing.
- `safeSnapshot.ts` — Defensive snapshot used by subsystem guards.
- `subsystems.ts` — Shared subsystem naming/helpers for profiling and diagnostics.
- `aiTraits.ts` — Deterministic AI trait generation from seeds.
- `aiDoctrine.ts` — AI doctrine state and defaults.
- `aiState.ts` — AI state helpers and initialization.
- `state.ts` — Barrel exports for `GameState` lifecycle (create/dispose/spawn/reset); implementations live in the modules above.
- `validation.ts` — Motion stats validation utilities.
- `uiStore.ts` — Zustand store for UI state (pause, toggles).
- `turretRegistry.ts` — Turret entity registration and cleanup.

- `combat/` — Combat helpers and coordination utilities.
- `physics/` — Rapier integration utilities and safe mutation helpers.
- `systems/` — Per-tick simulation systems and AI decision logic.
- `utils/` — Small deterministic helpers used by simulation modules.

- `aiProfiles.ts` — AI profile presets and deterministic seeds used by
  scenario harnesses and tests.

### Systems and decision code

- Implementation note: system-level code is organized under
  `src/game/systems/`. That folder contains `systems.ts` and per-step system
  implementations such as `carriers.ts`, `combat.ts`, `motion.ts`, and
  `shipControl.ts`.
- Decision (AI) modules live under `src/game/systems/decision/` and include
  `manager.ts`, `blackboard.ts`, `interrupts.ts`, `intents.ts`,
  `intent-utils.ts`, `combat-intents.ts`, `tactical-intents.ts`, and
  `formation-intents.ts`.

- `systems.ts` — System orchestrator that registers and steps per-frame
  simulation systems.
- `carriers.ts` — Carrier system: handles launching, queuing, and recovery of
  fighters and escort behavior.
- `combat.ts` — High-level combat system coordinating engagements, target
  arbitration, and combat-level bookkeeping.
- `motion.ts` — Low-level system that integrates velocities/forces and updates
  entity transforms each simulation step.
- `systems/decision/utils.ts` — Collection of small helpers and math utilities
  used by decision scoring and intent evaluation (clamping, smoothing,
  safe-divisions).

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
- `hudOverlayStore.ts` — Store for HUD overlay registrations and renderer/HUD
  sync (positions, visibility, z-order).

### `src/renderer/shaders`

- `starDisk.vertex.glsl`, `starDisk.fragment.glsl`, `mainsequencestar.glsl` —
  GLSL shader sources used by the star disk material.

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
- `jsx-shim.d.ts` — Small compatibility shim for JSX usage.
- `three-stdlib-ambient.d.ts` — Ambient declarations for three-stdlib helpers.

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
- `gltf/` — Directory with local GLTF test models and manifests.
- `textures/` — Directory with supplemental textures used in development
  and tests.

## Notes

- Total files: ~135 (including subdirectories and assets).
- Core focus: Simulation (`game/`) and rendering (`renderer/`,
  `components/`) dominate; hooks bridge React and Three.js.
- Dependencies: Types centralize shared shapes; configs provide tweakable
  values without code changes.
- Testing: Most files have Vitest specs or Playwright coverage; see `test/`
  for details.
