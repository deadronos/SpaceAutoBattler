---
title: Design - Renderer (renderer.js)
version: 1.0
date_created: 2025-08-20
last_updated: 2025-08-20
owner: SpaceAutoBattler Contributors
tags: [design, renderer, ui]
---

## Introduction

This specification documents the renderer contract: how `src/renderer.js` consumes simulation state and emits visual-only effects. It clarifies responsibilities, performance guidance, and testable acceptance criteria.

## 1. Purpose & Scope

Purpose: Define the renderer's inputs, outputs, and constraints so it remains decoupled from game logic.

Scope: `src/renderer.js`, `space_themed_autobattler_canvas_red_vs_blue.html` integration, visual-only randomness.

## 2. Definitions

- Renderer: visual subsystem that draws ships, bullets, and event-driven effects from simulation output.
- Visual wrappers: renderer-local objects that represent the visual state for a given Ship or Bullet.
- Cosmetic RNG: non-deterministic randomness used for particle jitter and visual variety (allowed in renderer).

## 3. Requirements & Constraints

- **REQ-REN-001**: Renderer MUST NOT mutate simulation-only fields or perform game logic changes.
- **REQ-REN-002**: Renderer must accept event arrays with shapes defined by `simulateStep` and handle missing arrays gracefully.
- **REQ-REN-003**: Cosmetic randomness may use `Math.random()` but must be explicitly separate from `src/rng.js` game randomness.
- **GUD-REN-001**: Pool particles/flash objects to reduce GC pressure.

## 4. Interfaces & Data Contracts

- Entry points (visible behavior): `reset(seed?)`, internal `simulate(dt)`, `render()`.
- Consumed simulation fields: `state.ships`, `state.bullets`, `state.explosions`, `state.shieldHits`, `state.healthHits`.
- Event shapes: same as `spec/design-simulate.md` (Explosion, ShieldHit, HealthHit).

## 5. Acceptance Criteria

- **AC-REN-001**: Given a state with `shieldHits` and `healthHits`, When `simulate()` is invoked, Then renderer creates corresponding visual flashes attached to the correct ship ids and does not throw.
- **AC-REN-002**: Given a ship removal in simulation, When the next render happens, Then renderer removes the visual wrapper and does not leak memory.
- **AC-REN-003**: Cosmetic RNG usage does not affect game determinism.

## 6. Test Automation Strategy

- Unit tests: feed minimal `state` objects and assert renderer's internal visual collections (shieldFlashes, particles) update correctly.
- Integration tests: call `reset(seed)` with `srand(seed)` and run a short deterministic simulation sequence to ensure no exceptions and stable wrapper counts.

## 7. Rationale & Context

- Keeping renderer separate from game logic allows deterministic simulation testing and reproducible replays.
- Minimizing per-frame allocations improves runtime performance in the browser.

## 8. Dependencies

- Consumer: `src/simulate.js` (provides events and state).
- Optional: pooling utilities for particles.

## 9. Examples & Edge Cases

- Missing `state.explosions`: renderer should treat as empty and continue.
- Shield hit refers to unknown ship id: renderer should ignore or log and continue.

## 10. Validation Criteria

- Unit and integration tests exist and pass on CI.
- No DOM mutations from simulation code in test runs.

*** End of file
