# Simulation Flow & User Story Guide

**Last updated:** 2025-05-19

This document explains how the Space Auto Battler application boots, how the deterministic game simulation advances each frame, how rendering consumes state, and what core user interactions are currently supported. File references point to the most important source modules for understanding or extending each part of the flow.

## 1. Application Boot Sequence

1. **Entry point:** `src/main.tsx` patches Three.js helpers, locates the `#root` element, and renders `<App />` inside React `StrictMode`.【F:src/main.tsx†L1-L21】
2. **Shell composition:** `<App />` wraps all visible UI inside `<GameProvider>` so that both the simulation and the React tree share the same deterministic `GameState`. It mounts the 3D battlefield, HUD, controls, and debug panels together.【F:src/App.tsx†L1-L23】

## 2. Game Provider Lifecycle

`GameProvider` is responsible for creating, exposing, and disposing the canonical `GameState`.

- **Creation:** On mount, the provider asynchronously creates the Rapier world, ECS world, deterministic RNG, and AI subsystems, then seeds both fleets using `spawnInitialFleets`. The hook also exposes lightweight E2E helpers for deterministic QA and automation.【F:src/game/context.tsx†L30-L156】
- **UI mirroring:** React UI toggles (pause, time scale, HUD flags, AI enablement) are mirrored back into `GameState` so simulation systems see the latest operator choices.【F:src/game/context.tsx†L159-L185】
- **Cleanup:** On unmount the provider disposes the `GameState`, ensuring Rapier and ECS resources are released.【F:src/game/context.tsx†L148-L156】

### 2.1 GameState Structure

`createGameState` constructs all simulation subsystems: physics, entity queries, AI doctrine, sensors, explosion pools, and diagnostic counters. Defaults such as fixed-step size (1/20s), deterministic RNG seed (1337), and AI tick budget are centralized here.【F:src/game/createGameState.ts†L1-L149】

`spawnInitialFleets` places mirrored blue and red squadrons with deterministic jitter so every run starts from the same configuration unless the RNG seed changes.【F:src/game/spawnFleets.ts†L1-L52】

## 3. Simulation Advancement

### 3.1 Fixed-Step Orchestration

`BattlefieldSystems` runs inside the R3F render loop. Each frame it:

1. Mirrors pause/time-scale flags into `GameState`.
2. Accumulates elapsed time according to the configured fixed step and maximum sub-steps.
3. Calls `updateGame` once per step until the accumulator is drained, also updating interpolation alpha for renderer lerps.【F:src/components/BattlefieldSystems.tsx†L1-L55】

This arrangement lets rendering tick at monitor refresh rates while simulation advances deterministically at 20 Hz (or faster when sped up).

### 3.2 Per-Tick Pipeline

`updateGame` performs the core deterministic pipeline each simulation tick:

1. Updates simulation clocks and tick counters.
2. Executes critical systems with fault isolation, recording diagnostics without crashing the loop (AI decision, ship preparation, carrier launches, turret updates, motion integration, projectile advancement).
3. Flushes deferred mutations, steps Rapier, then flushes post-physics mutations.
4. Synchronizes ECS transforms, resolves projectile impacts, and updates explosion lifecycles.【F:src/game/systems.ts†L1-L97】

The helper also exposes AI scoring hooks for testing, which is useful when validating intent logic changes.【F:src/game/systems.ts†L99-L117】

## 4. Rendering Integration

`Battlefield` mounts the Three.js canvas, installs post-processing when enabled, and renders the various instanced layers (ships, turrets, projectiles, explosions, particle trails). It also mounts `BattlefieldSystems` so the simulation keeps stepping alongside rendering. A loading overlay appears until `GameState` is ready.【F:src/components/Battlefield.tsx†L1-L117】

HUD overlays pull entity data through ECS archetypes: `Hud` summarizes fleet strength and health while exposing settings/debug drawers controlled through the shared UI store.【F:src/components/Hud.tsx†L1-L100】

## 5. UI State & Controls

The Zustand `useUiStore` centralizes all operator toggles (pause, speed, post-processing, AI experiments, debug overlays) and enforces invariants such as “AI v2 cannot be disabled.” Because the store lives outside React components it can be accessed from simulation helpers when necessary.【F:src/game/uiStore.ts†L1-L186】

`Controls` consumes that store to expose the primary interaction surface: pause/resume, reset, spawn ships, and adjust time scale. Ship spawning uses `spawnRandomShip`, while resets queue a safe post-physics `resetGame` to avoid Rapier mutations mid-step.【F:src/components/Controls.tsx†L1-L45】【F:src/game/resetGame.ts†L1-L38】

## 6. Core User Stories

1. **Start viewing the simulation** – As a player I load the app and see the 3D battlefield once `GameProvider` finishes creating the deterministic `GameState`, with a loading overlay shown until then.【F:src/App.tsx†L10-L22】【F:src/components/Battlefield.tsx†L74-L117】
2. **Pause or resume combat** – From the controls bar I toggle the pause button, which flips `paused` in the UI store; `BattlefieldSystems` honors it by skipping fixed-step updates while keeping interpolation alpha at zero.【F:src/components/Controls.tsx†L18-L24】【F:src/components/BattlefieldSystems.tsx†L7-L55】
3. **Adjust simulation speed** – I change the speed dropdown to scale time; the UI store clamps the value and `BattlefieldSystems` multiplies frame delta accordingly before stepping the simulation.【F:src/components/Controls.tsx†L25-L41】【F:src/game/uiStore.ts†L72-L120】
4. **Reset the battle** – I click Reset to queue a post-physics reset, which clears entities, metrics, and re-spawns the default formations safely after the current tick.【F:src/components/Controls.tsx†L18-L24】【F:src/game/resetGame.ts†L7-L38】
5. **Introduce reinforcements** – Using the `+ Red` or `+ Blue` buttons spawns an additional ship with deterministic jitter around the team’s anchor zone.【F:src/components/Controls.tsx†L18-L24】【F:src/game/spawnFleets.ts†L54-L75】
6. **Monitor fleet health and status** – The HUD reads ECS archetypes to summarize per-team counts and hull integrity, optionally replacing world-space health bars when they are disabled.【F:src/components/Hud.tsx†L20-L59】
7. **Toggle visual/debug overlays** – Settings drawers interact with the UI store, which mirrors health overlay toggles back to `GameState` for systems that rely on those flags.【F:src/components/Hud.tsx†L30-L59】【F:src/game/context.tsx†L159-L185】

## 7. Extending the Flow

- **New systems:** Register additional deterministic systems inside `updateGame` (ideally guarded by `runSafely`) and provide ECS archetypes plus renderer hooks similar to existing layers.【F:src/game/systems.ts†L44-L97】
- **New UI interactions:** Add store fields in `useUiStore`, mirror them within `GameProvider` if the simulation needs to react, and surface controls in `Controls` or HUD drawers.【F:src/game/uiStore.ts†L16-L186】【F:src/game/context.tsx†L159-L185】

Refer to `ARCHITECTURE.md` for a broader structural overview, and pair this guide with system-specific docs (e.g., `docs/postprocessing-pipeline.md`) when working on specialized subsystems.
