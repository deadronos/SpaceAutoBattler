# Source (src) structure

Generated on: 2025-09-27

This document lists the files and folders under `src/` with a concise purpose
summary for each entry. It is intended to help new contributors quickly locate
core systems and understand responsibilities across the codebase.

## Top-level

- `src/ui.html` — Minimal host HTML used during development; contains loading
  placeholder and base background styles.
- `src/main.tsx` — Application bootstrap: patches loaders, creates the React
  root, and mounts `<App />`.
- `src/App.tsx` — Top-level React application shell. Sets up `GameProvider` and
  composes Battlefield, HUD, and controls.
- `src/AGENTS.md` — Contributor guidance for working inside `src/`.
- `src/styles/` — Global CSS and related notes (see dedicated section below).

## assets

- `src/assets/ships.ts` — Mapping of ship blueprint IDs to GLB assets and helper
  metadata consumed by visual components.
- `src/assets/planets.ts` — Accessors for procedural planet textures and their
  material setup.
- `src/assets/skysphere.ts` — Helper for loading the background skysphere texture.
- `src/assets/starDiskTextures.ts` — Registry for star disk texture variants used
  by renderer materials.
- `src/assets/AGENTS.md` — Guidelines for managing binary assets and attribution.
- `src/assets/gltf/` — Source GLB/FBX/texture packs for ships (includes
  attribution and original author resources).
- `src/assets/skysphere/` — Skysphere texture and attribution file.
- `src/assets/textures/` — Planet, gas giant, and star textures with attribution
  notes.

## components

- `src/components/AiDebugOverlay.tsx` — React overlay that displays AI decision
  snapshots, scores, and metrics.
- `src/components/Battlefield.tsx` — R3F canvas and scene composition. Creates
  lights, fog, star field, and steps the deterministic simulation (Rapier → ECS
  → visuals).
- `src/components/Controls.tsx` — UI controls bar for pause, reset, spawn, time
  scale, post-processing, and AI toggles.
- `src/components/Explosion.tsx` — Placeholder explosion mesh that registers for
  selective bloom; used until entity-driven VFX lands.
- `src/components/Hud.tsx` — Heads-up display and fleet summary panel with
  optional AI debug overlay.
- `src/components/HudHealthLayer.tsx` — HUD layer that renders ship health bars
  and status metadata.
- `src/components/HudOverlayCollector.tsx` — Collects HUD overlay elements from
  ship components and forwards them to the HUD layer.
- `src/components/ParticleTrails.tsx` — Mesh particle trails for projectiles and
  thrusters, reusing material registry entries.
- `src/components/Postprocessing.tsx` — Post-processing pipeline (selective
  bloom, FXAA) integrated with `BloomProvider` registration.
- `src/components/PostprocessingLazy.tsx` — Lazy-loaded wrapper for
  `Postprocessing` to reduce the initial bundle size.
- `src/components/Projectile.tsx` — Projectile visuals and transforms sourced
  from the deterministic simulation.
- `src/components/Ship.tsx` — Ship renderer: resolves GLB models, applies hull
  tints, thruster effects, shield bubble, and interpolated transforms.
- `src/components/ShipHudOverlay.tsx` — Ship-level HUD overlay origin that
  publishes status data to the collector.
- `src/components/Turret.tsx` — Turret geometry and muzzle flash visuals, plus
  bloom registration for muzzle objects.
- `src/components/environment/` — Celestial environment primitives (star disk,
  planets, skysphere, lighting, parallax billboards) assembled by Battlefield.
- `src/components/AGENTS.md` — Guidance and patterns for authoring components.

## config

- `src/config/carriers.ts` — Carrier hull configuration, bay counts, and spawn
  sequencing helpers.
- `src/config/environment.ts` — Environment parameters (fog, parallax layer
  layout, celestial scaling).
- `src/config/hudHealth.ts` — Tunable values that drive HUD health overlay
  thresholds and animations.
- `src/config/projectiles.ts` — Projectile tuning and mapping for visuals and
  physics parameters.
- `src/config/renderer.ts` — Renderer constants (shield visuals, ripple tuning,
  hull tints, motion defaults).
- `src/config/starDiskDebug.ts` — Debug presets and toggles for the star disk
  material.
- `src/config/AGENTS.md` — Configuration file conventions.

## game

- `src/game/context.tsx` — React context and `GameProvider` lifecycle that owns
  the canonical `GameState` (creation, teardown, and hooks).
- `src/game/state.ts` — `createGameState` factory, Rapier initialization,
  Miniplex world, seeded RNG, spawn/reset helpers, and disposal utilities.
- `src/game/config.ts` — World constants (bounds, fog), camera defaults, and
  AI configuration defaults.
- `src/game/ships.ts` — Ship blueprints, spawn logic, `SHIP_STATS`, motion stats,
  and turret creation helpers.
- `src/game/systems.ts` — Orchestrator for simulation systems: AI ticks, turret
  logic, projectile advancement, physics stepping, and transform sync.
- `src/game/systems/` — Specialized systems (carrier launch management,
  motion/banking logic) split out for maintainability.
- `src/game/turretRegistry.ts` — Registry that tracks turret ownership for
  lookups and cascade deletion.
- `src/game/uiStore.ts` — Zustand store backing UI controls (pause, speed,
  post-processing, AI toggles, debug flags).
- `src/game/validation.ts` — Validation helpers enforcing plausible motion stats
  and configuration inputs.
- `src/game/aiTraits.ts` — Deterministic AI trait generator (aggression, patience,
  dodge modifiers) seeded via RNG.
- `src/game/aiProfiles.ts` — AI profile resolution and defaults consumed by
  ships and debugger tooling.
- `src/game/aiScenarioHarness.ts` — Headless harness for AI simulations used in
  testing and balancing.
- `src/game/README.md` — Overview of world configuration and camera/scale notes.
- `src/game/AGENTS.md` — Game-layer guidance (determinism, GameState usage,
  testing protocol).

## hooks

- `src/hooks/useArchetypeEntities.ts` — Subscribes to a Miniplex archetype and
  returns a stable entity list for rendering components.
- `src/hooks/usePlanetTexture.ts` — Hook that manages async loading of planet
  textures and caching for environment components.
- `src/hooks/usePrefersReducedMotion.ts` — Media-query hook that surfaces user
  reduced-motion preference to adapt effects.
- `src/hooks/AGENTS.md` — Guidance for creating hooks in this project.

## renderer

- `src/renderer/BloomProvider.tsx` — Context provider enabling selective bloom
  registration for meshes.
- `src/renderer/hudOverlayStore.ts` — Internal store used by HUD overlays to
  publish and subscribe to ship overlay data.
- `src/renderer/materialRegistry.tsx` — Registry for reusable material components
  (shield shader, transmission material, bullet/explosion materials).
- `src/renderer/rippleDebug.ts` — Debug utility tracking shield ripple counts.
- `src/renderer/starDiskMaterial.ts` — Configurable star disk material builder
  tying together GLSL shaders and texture inputs.
- `src/renderer/starDiskOrientation.ts` — Helper functions for orienting the star
  disk and aligning visual offsets.
- `src/renderer/shaders/` — GLSL shader sources for the star disk and
  main-sequence star effects.
- `src/renderer/AGENTS.md` — Renderer-level contributor guidance.

## styles

- `src/styles/app.css` — Global CSS for HUD, controls, debug overlays, and layout.
- `src/styles/AGENTS.md` — Notes on styling conventions inside `src/styles/`.

## types

- `src/types/index.ts` — Canonical TypeScript types (`GameState`, entities,
  motion stats, AI state, config shapes).
- `src/types/assets.d.ts` — Module declarations for binary assets (e.g. `*.glb`).
- `src/types/glsl.d.ts` — Ambient module declarations for GLSL shader imports.
- `src/types/jsx-compat.d.ts` — Compatibility shim mapping `JSX.Element` to
  React types during upgrades.
- `src/types/jsx-shim.d.ts` — Temporary JSX shim that relaxes intrinsic element
  typing pending dependency updates.
- `src/types/react-three-drei.d.ts` — Ambient declarations for `@react-three/drei`
  stubs (`MeshTransmissionMaterial`, `useGLTF`, `OrbitControls`).
- `src/types/three-stdlib-ambient.d.ts` — Ambient types for GLTFLoader helpers
  used during development.
- `src/types/AGENTS.md` — Notes about type declarations and maintenance.

## utils

- `src/utils/color.ts` — Color helper functions shared by HUD and renderer code.
- `src/utils/deterministicLerp.ts` — Deterministic interpolation helpers that
  avoid floating-point drift between runs.
- `src/utils/patchGltfLoader.ts` — Runtime patch/guard for GLTFLoader to safely
  resolve assets across environments.
- `src/utils/rng.ts` — Deterministic seeded RNG (Lehmer-like) used across
  simulation and AI flows.
- `src/utils/AGENTS.md` — Utility-layer guidance and patterns.

## root-level docs (in src)

- `src/AGENTS.md` — Top-level contributor notes for working inside `src/`.
