# Source (src) structure

This document lists the files and folders under `src/` with a concise purpose description for each entry. It is intended to help new contributors quickly locate core systems and understand responsibilities across the codebase.

## Top-level

- `src/ui.html` — Minimal host HTML used during development; contains a loading placeholder and base background styles.
- `src/main.tsx` — Application bootstrap: patches loaders, creates React root and mounts `<App />`.
- `src/App.tsx` — Top-level React application shell. Sets up GameProvider and composes Battlefield, HUD, and Controls.
- `src/styles/app.css` — Global CSS for HUD, controls, debug overlays, and layout.

## assets

- `src/assets/ships.ts` — Exposes GLB paths and mapping for ship models used by the Ship component.
- `src/assets/AGENTS.md` — Guidance notes for working with asset files in this repo.

## components

- `src/components/Battlefield.tsx` — R3F Canvas and scene composition. Creates lights, fog, grid, star field and mounts layer components. Also runs the fixed-step simulation loop that advances the deterministic simulation (syncs Rapier -> ECS -> visuals).
- `src/components/Ship.tsx` — Visual ship component: resolves model or placeholder geometry, applies hull tinting, thruster visuals, shield bubble shader, and interpolates simulation transforms to smooth visuals.
- `src/components/Turret.tsx` — Renders turret geometry and muzzle flash visuals; registers muzzle objects for selective bloom.
- `src/components/Projectile.tsx` — Projectile visual representation: selects material from the material registry and updates transform/scale based on simulation projectile entities.
- `src/components/Hud.tsx` — Heads-up display and fleet summary panel; shows team stats and embeds AI debug overlay when enabled.
- `src/components/Controls.tsx` — UI controls bar for pause, reset, add-ship, time-scale, postprocessing toggle, and AI toggles.
- `src/components/Postprocessing.tsx` — Postprocessing pipeline using `postprocessing` library (selective bloom, FXAA) and integrates with `BloomProvider` selection.
- `src/components/PostprocessingLazy.tsx` — Lazy-load wrapper for `Postprocessing` to reduce initial bundle cost.
- `src/components/Explosion.tsx` — Simple placeholder explosion mesh used for visual effects; plugs into bloom registration.
- `src/components/AiDebugOverlay.tsx` — React overlay that shows AI decision snapshots, scores, and metrics (refreshes periodically).
- `src/components/AGENTS.md` — Component-level guidance and patterns for contributors.

## config

- `src/config/renderer.ts` — Renderer tuning and constants (shield visuals, ripple tuning, hull tints, renderer motion defaults).
- `src/config/projectiles.ts` — Projectile tuning and mapping for projectile visual and physics parameters.

## game

- `src/game/context.tsx` — React context and `GameProvider` that creates/tears down the canonical `GameState`. Exposes `useGameState` / `useOptionalGameState` hooks.
- `src/game/state.ts` — `createGameState` and lifecycle helpers: Rapier initialization, Miniplex world, RNG, entity factory helpers, spawn/reset helpers, and `disposeGameState`.
- `src/game/systems.ts` — Main simulation systems and update pipeline: AI decision tick driver, turret updates, projectile advancement/resolution, physics stepping and transform sync. Contains many AI scoring and intent helper functions used by v2 AI.
- `src/game/ships.ts` — Ship blueprints and spawn logic. Declares `SHIP_STATS` (fighter → carrier), default motion stats, turret creation helpers and spawnShip routines.
- `src/game/turretRegistry.ts` — Small registry to associate turrets with their parent ship for cascade deletion and lookup.
- `src/game/uiStore.ts` — Lightweight Zustand store for UI toggles (paused, timeScale, postprocessing, AI toggles and debug flags).
- `src/game/config.ts` — World constants (WORLD_SIZE, WORLD_HALF), camera/fog defaults, and AI config defaults used by simulation.
- `src/game/validation.ts` — Motion stats and config validation helpers to ensure plausible runtime values.
- `src/game/aiTraits.ts` — Deterministic AI trait generator (aggression/patience/dodge modifiers) from a seed using the canonical seeded RNG.
- `src/game/aiProfiles.ts` — AI behavior profile resolution and defaults (used by ships and debugger).
- `src/game/aiScenarioHarness.ts` — A harness for running isolated AI decision simulations (headless) that logs commands/positions over ticks — useful for unit testing and balancing without the full renderer.
- `src/game/AGENTS.md` — Game-layer guidance and rules (determinism, canonical GameState, testing notes).
- `src/game/README.md` — Short overview of world configuration and camera/scale notes.

## hooks

- `src/hooks/useArchetypeEntities.ts` — React hook to subscribe to a Miniplex archetype (entity query) and return a stable array of matching entities for rendering components.
- `src/hooks/AGENTS.md` — Guidance notes for creating hooks in this repo.

## renderer

- `src/renderer/materialRegistry.tsx` — Central registry for reusable material React components (shield hex shader, transmission material wrapper, bullet/explosion materials). Provides `registerMaterial`/`getMaterial` used by visual components.
- `src/renderer/BloomProvider.tsx` — Context provider for selective bloom. Components register objects to be included in bloom via `useBloomRegistration`.
- `src/renderer/rippleDebug.ts` — Small debug utility to track active/pending ripple counts for the shield ripple system.
- `src/renderer/AGENTS.md` — Renderer-level contributor guidance.

## types

- `src/types/index.ts` — Canonical TypeScript types used across the project: `GameState`, entity shapes (Ship, Projectile, Turret), AI state/types, motion stats and config shapes.
- `src/types/three-stdlib-ambient.d.ts` — Minimal ambient types for the GLTFLoader import used at runtime (patch helper relies on these shapes during dev typechecks).
- `src/types/react-three-drei.d.ts` — Lightweight ambient module declarations for `@react-three/drei` stubs used during typechecks (MeshTransmissionMaterial, useGLTF, OrbitControls).
- `src/types/jsx-shim.d.ts` — Temporary JSX shim to relax intrinsic element typing until dependency upgrades are reconciled.
- `src/types/jsx-compat.d.ts` — Compatibility shim to map JSX.Element to React types; temporary while upgrading React types.
- `src/types/assets.d.ts` — Module declarations for binary assets (e.g., `*.glb`) to enable imports in TypeScript.
- `src/types/AGENTS.md` — Notes about types and ambient declarations.

## utils

- `src/utils/rng.ts` — Deterministic seeded RNG (Lehmer-like) used by simulation and AI to preserve determinism across runs.
- `src/utils/patchGltfLoader.ts` — Runtime patch/guard to safely call GLTFLoader across environments and avoid invalid URL errors at runtime.
- `src/utils/AGENTS.md` — Utility-layer guidance and patterns.

## root-level docs (in src)

- `src/AGENTS.md` — Top-level contributor notes for working inside `src/`.

---

If you want, I can also:

- include file sizes and lines-of-code estimates next to each file,
- generate a markdown TOC for quick navigation,
- or extend descriptions with links to the most relevant functions/types inside the file.

Requirements coverage:

- Read every file under `src/` and summarized their purpose: Done.
- Wrote `spec/src-structure.md` listing each file and providing concise descriptions: Done.

File created by automation. Please review and tell me if you'd like changes or additional details per file.
