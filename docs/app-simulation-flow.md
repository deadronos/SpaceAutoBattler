# Simulation Flow & User Story Guide

**Last updated:** 2025-12-19

This document explains how the Space Auto Battler application boots, how the deterministic game simulation advances each frame, how rendering consumes state, and what core user interactions are currently supported. File references point to the most important source modules for understanding or extending each part of the flow.

## 1. Application Boot Sequence

1. **Entry point:** `src/main.tsx` patches Three.js helpers, locates the `#root` element, and renders `<App />` inside React `StrictMode`.
2. **Shell composition:** `<App />` wraps all visible UI inside `<GameProvider>` so that both the simulation and the React tree share the same deterministic `GameState`. It mounts the 3D battlefield, HUD, controls, and debug panels together.

## 2. Game Provider Lifecycle

`GameProvider` is responsible for creating, exposing, and disposing the canonical `GameState`.

- **Creation:** On mount, the provider initializes the canonical `GameState` (Rapier world, ECS world, deterministic RNG, AI subsystems) and seeds both fleets using `spawnInitialFleets`. The hook also exposes lightweight E2E helpers for deterministic QA and automation.
- **UI mirroring:** React UI toggles (pause, time scale, HUD flags, simulation profiling/guard controls) are mirrored back into `GameState` so simulation systems see the latest operator choices.
- **Optional worker simulation:** When enabled via feature-flag, the provider creates a `SimulationBridge` so the simulation can run in a Web Worker.
- **Cleanup:** On unmount the provider disposes the `GameState`, ensuring Rapier and ECS resources are released.

### 2.1 GameState Structure

`createGameState` constructs all simulation subsystems: physics, entity queries, AI doctrine, sensors, explosion pools, and diagnostic counters. Defaults such as fixed-step size (1/20s), deterministic RNG seed (1337), and AI tick budget are centralized here.

`spawnInitialFleets` places mirrored blue and red squadrons with deterministic jitter so every run starts from the same configuration unless the RNG seed changes.

## 3. Simulation Advancement

### 3.1 Fixed-Step Orchestration

`BattlefieldSystems` runs inside the R3F render loop. Each frame it:

1. Mirrors pause/time-scale flags into `GameState`.
2. Accumulates elapsed time according to the configured fixed step and maximum sub-steps.
3. Calls `updateGame` once per step until the accumulator is drained, also updating interpolation alpha for renderer lerps.

When worker simulation is active in “render worker ships only” mode, `BattlefieldSystems` skips the main-thread simulation tick and only renders the latest worker-provided snapshot.

This arrangement lets rendering tick at monitor refresh rates while simulation advances deterministically at 20 Hz (or faster when sped up).

### 3.2 Per-Tick Pipeline

`updateGame` performs the core deterministic pipeline each simulation tick:

1. Updates simulation clocks and tick counters.
2. Executes critical systems with fault isolation, recording diagnostics without crashing the loop (AI decision, ship preparation, carrier launches, turret updates, motion integration, projectile advancement).
3. Flushes deferred mutations, steps Rapier, then flushes post-physics mutations.
4. Synchronizes ECS transforms, resolves projectile impacts, and updates explosion lifecycles.

Note: Rapier stepping uses `physicsWorld.step()` without explicitly passing the `eventQueue` (the queue is created with `{ auto: true }`, and passing it to `step()` has been observed to cause recursive-use errors).

The helper also exposes AI scoring hooks for testing, which is useful when validating intent logic changes.

## 4. Rendering Integration

`Battlefield` mounts the Three.js canvas, installs post-processing when enabled, and renders the various instanced layers (ships, turrets, projectiles, explosions, particle trails). It also mounts `BattlefieldSystems` so the simulation keeps stepping alongside rendering. A loading overlay appears until `GameState` is ready.

HUD overlays pull entity data through ECS archetypes: `Hud` summarizes fleet strength and health while exposing settings/debug drawers controlled through the shared UI store.

## 5. UI State & Controls

The Zustand `useUiStore` centralizes all operator toggles (pause, speed, post-processing, AI experiments, debug overlays) and enforces invariants such as “AI v2 cannot be disabled.” Because the store lives outside React components it can be accessed from simulation helpers when necessary.

`Controls` consumes that store to expose the primary interaction surface: pause/resume, reset, spawn ships, and adjust time scale. Ship spawning uses `spawnRandomShip`, while resets queue a safe post-physics `resetGame` to avoid Rapier mutations mid-step.

## 6. Core User Stories

1. **Start viewing the simulation** – As a player I load the app and see the 3D battlefield once `GameProvider` finishes creating the deterministic `GameState`, with a loading overlay shown until then.
2. **Pause or resume combat** – From the controls bar I toggle the pause button, which flips `paused` in the UI store; `BattlefieldSystems` honors it by skipping fixed-step updates while keeping interpolation alpha at zero.
3. **Adjust simulation speed** – I change the speed dropdown to scale time; the UI store clamps the value and `BattlefieldSystems` multiplies frame delta accordingly before stepping the simulation.
4. **Reset the battle** – I click Reset to queue a post-physics reset, which clears entities, metrics, and re-spawns the default formations safely after the current tick.
5. **Introduce reinforcements** – Using the `+ Red` or `+ Blue` buttons spawns an additional ship with deterministic jitter around the team’s anchor zone.
6. **Monitor fleet health and status** – The HUD reads ECS archetypes to summarize per-team counts and hull integrity, optionally replacing world-space health bars when they are disabled.
7. **Toggle visual/debug overlays** – Settings drawers interact with the UI store, which mirrors health overlay toggles back to `GameState` for systems that rely on those flags.

## 7. Extending the Flow

- **New systems:** Register additional deterministic systems inside `updateGame` (ideally guarded by the subsystem guard helpers) and provide ECS archetypes plus renderer hooks similar to existing layers.
- **New UI interactions:** Add store fields in `useUiStore`, mirror them within `GameProvider` if the simulation needs to react, and surface controls in `Controls` or HUD drawers.

Refer to `ARCHITECTURE.md` for a broader structural overview, and pair this guide with system-specific docs (e.g., `docs/postprocessing-pipeline.md`) when working on specialized subsystems.
