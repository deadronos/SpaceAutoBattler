---
title: Physics-Based Ship Movement with Renderer Smoothing and Banking
version: 1.0
date_created: 2025-09-22
last_updated: 2025-09-22
owner: SpaceAutoBattler Maintainers
tags: [design, architecture, process, simulation, renderer, deterministic]
---

## Introduction

This specification defines deterministic, physics-based ship movement combined with renderer-side smoothing (interpolation/filters) and procedural banking/visual effects. The goal is to remove visually jumpy heading changes while preserving deterministic simulation for reproducibility and testing.

## 1. Purpose & Scope

- Purpose: Introduce acceleration-limited linear and angular motion in the simulation (canonical GameState) and add visual-only smoothing and banking in the renderer.
- Scope: Simulation (movement/steering), renderer (visual interpolation and banking), configuration (per-ship motion stats), and testing/acceptance criteria.
- Audience: Engine, simulation/AI, and renderer developers.
- Assumptions:
  - All runtime state is held in canonical `GameState`.
  - Simulation must remain deterministic and testable (seeded RNG preserved).
  - Visual smoothing must not modify simulation state.

## 2. Definitions

- GameState: Canonical in-memory state for simulation/renderer; no scattered module-level runtime state.
- Deterministic: Identical initial state/inputs produce identical state transitions.
- Linear Acceleration: Change in linear velocity per unit time (units/s²).
- Angular Acceleration: Change in angular velocity per unit time (deg/s² or rad/s²).
- Max Turn Rate: Angular velocity cap (deg/s or rad/s).
- Damping: Exponential decay of linear or angular velocity.
- Renderer Smoothing: Visual-only interpolation/filters applied between discrete sim ticks.
- Banking: Procedural visual roll conveying lateral acceleration/turning.
- Lerp/Slerp: Linear interpolation (vectors) and spherical linear interpolation (quaternions).
- PD Controller: Proportional-Derivative controller that smooths convergence to a target heading.

## 3. Requirements, Constraints & Guidelines

- REQ-001: The simulation shall update ship motion using acceleration-limited linear and angular dynamics.
- REQ-002: The simulation shall cap angular velocity by per-ship `maxTurnRate` and constrain changes by `angularAcceleration`.
- REQ-003: The simulation shall cap linear velocity by per-ship `maxSpeed` and constrain changes by `linearAcceleration`.
- REQ-004: The simulation shall remain deterministic for identical seeds, initial states, and inputs.
- REQ-005: Renderer-side smoothing shall interpolate between previous and current simulation states without modifying GameState.
- REQ-006: Procedural banking/roll and thruster VFX shall be derived from simulated kinematics (yaw rate/lateral acceleration).
- REQ-007: All new motion parameters shall be configurable per ship class, using repository configuration helpers (no hardcoded constants in systems).
- REQ-008: Motion hot paths shall avoid per-frame allocations.
- REQ-009: Turning behavior shall be continuous; ships must not snap to large heading changes within a single tick under normal conditions.

- SEC-001: Determinism shall not be compromised by non-deterministic APIs in motion updates.

- CON-001: Canonical state must remain in `GameState`; do not introduce module-level runtime state.
- CON-002: Respect seeded RNG usage and time step strategy; movement math must not introduce hidden randomness.
- CON-003: Do not break ECS/entity shapes; extend with motion components as needed.
- CON-004: Renderer smoothing is strictly visual-only: no feedback into simulation.
- CON-005: Use existing config helpers in `src/config/*` where applicable.

- GUD-001: Prefer PD-like angular control for stable response; use torque-style integration if more physically plausible behavior is desired.
- GUD-002: Use slerp for rotations and lerp for positions when interpolating between sim ticks.
- GUD-003: Critically-damped spring smoothing is optional for visuals when profiling permits.
- GUD-004: Compute bank angle proportional to lateral acceleration or yaw rate and clamp to a maximum roll.
- GUD-005: Tune damping to prevent oscillation; start with small `angularDamping` and increase as needed.

- PAT-001: Separation of concerns:
  - Simulation: compute next state with acceleration/damping limits.
  - Renderer: interpolate and bank visually from sim state.
- PAT-002: Provide per-ship defaults via config; no system-level magic constants.
- PAT-003: Add deterministic unit tests for motion primitives (angle wrap, clamps, integration).

## 4. Interfaces & Data Contracts

The following TypeScript-like interfaces describe data shapes for configuration and runtime state. Actual code must live under `src/` and follow repo conventions.

Ship motion stats (config-level, per class):

```ts
type AngleUnit = 'deg' | 'rad'; // Implementation must select a consistent unit.

interface MotionStats {
  mass: number;                         // unitless or kg-equivalent
  maxSpeed: number;                     // units/s
  linearAcceleration: number;           // units/s^2
  linearDamping: number;                // per-second damping (continuous model)
  maxReverseSpeed?: number;             // units/s
  maxLateralAcceleration?: number;      // units/s^2 (strafing), default 0

  maxTurnRate: number;                  // deg/s or rad/s (consistent unit)
  angularAcceleration: number;          // deg/s^2 or rad/s^2
  angularDamping: number;               // per-second damping (continuous)
  steeringController?: 'PD' | 'Torque'; // default: 'PD'
  turnResponse?: number;                // 0..1 blending of controller styles (optional)

  responseDelayMs?: number;             // hysteresis to avoid target flip-flop

  // Renderer-only visual smoothing
  smoothing?: {
    positionLerp?: number;              // 0..1 per frame (simple lerp)
    rotationSlerp?: number;             // 0..1 per frame (simple slerp)
    springStiffness?: number;           // optional for spring smoothing
    springDamping?: number;             // optional for spring smoothing
  };

  // Visual banking
  visualBankFactor?: number;            // deg per unit lateral accel or per deg/s yaw
  maxBankDeg?: number;                  // clamp for roll
}
```

ECS/Entity components (simulation-level):

```ts
interface Transform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number }; // quaternion
}

interface Kinematics {
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number }; // axis-angle rate; often yaw-dominant
}

interface Dynamics {
  mass: number;
  linearDamping: number;
  angularDamping: number;
  // Optional future: inertia tensor or scalar inertia (yaw-only)
}

interface MotionControllerState {
  desiredHeading: { x: number; y: number; z: number }; // unit vector
  lastUpdateTime: number;                              // ms or sim time
  // Optional: PD gains/derived caches to avoid re-computation
}
```

Renderer-side smoothing state (visual-only; do not write back to sim):

```ts
interface VisualSmoothingState {
  prevSimPosition: { x: number; y: number; z: number };
  prevSimRotation: { x: number; y: number; z: number; w: number };
  visualPosition: { x: number; y: number; z: number };
  visualRotation: { x: number; y: number; z: number; w: number };
  bankRollDeg: number; // computed visual roll offset
}
```

Control equations (high-level):

- PD-like angular control:
  - `angleError = shortestAngle(currentHeading, desiredHeading)`
  - `targetAngVel = clamp(kp * angleError, -maxTurnRate, +maxTurnRate)`
  - `angVelDelta = clamp(targetAngVel - angularVelocity, -angularAcceleration * dt, +angularAcceleration * dt)`
  - `angularVelocity += angVelDelta`
  - `rotation = integrate(rotation, angularVelocity, dt)`
  - `angularVelocity *= (1 - angularDampingEff(dt))`

- Linear control:
  - `forwardSpeed = dot(velocity, forward)`
  - `desiredSpeed = clamp(targetSpeed, -maxReverseSpeed, +maxSpeed)`
  - `accelForward = clamp((desiredSpeed - forwardSpeed) / dt, -linearAcceleration, +linearAcceleration)`
  - `velocity += forward * accelForward * dt`
  - Optionally apply lateral acceleration (strafe) limited by `maxLateralAcceleration`
  - `velocity *= (1 - linearDampingEff(dt))`

- Damping (continuous to per-step):
  - `dampingEff(dt) = 1 - exp(-dampingPerSecond * dt)`

Renderer interpolation:

- `alpha = saturate((renderTime - simTickStart) / simDelta)`
- `visualPosition = lerp(prevSimPosition, currSimPosition, alpha)`
- `visualRotation = slerp(prevSimRotation, currSimRotation, alpha)`

Banking (visual):

- `bankFromYawRate = yawRateDegPerSec × bankYawFactor`
- `bankFromLateral = lateralAcceleration × visualBankFactor`
- `bankRollDeg = clamp(selectedBank, -maxBankDeg, +maxBankDeg)`
- Apply as extra roll around the ship’s forward axis on top of sim rotation (visual-only).

## 5. Acceptance Criteria

- AC-001: Given a ship with finite `angularAcceleration` and `maxTurnRate`, when desired heading changes by 180°, then rotation is continuous and arrival time matches configured stats within ±10%.
- AC-002: Given `linearAcceleration` and `maxSpeed`, when accelerating from rest, then forward speed increases smoothly and does not exceed `maxSpeed`.
- AC-003: Given `angularDamping > 0`, when no control input is applied, then `angularVelocity` decays exponentially over time.
- AC-004: Given renderer smoothing enabled, when sim runs at 20 Hz and render at 60 FPS, then visual motion has no perceptible snaps; per-frame angular delta stays below a defined threshold.
- AC-005: Given banking enabled, when a ship turns steadily, then a stable roll proportional to yaw rate or lateral acceleration is visible and clamped by `maxBankDeg`.
- AC-006: Given identical initial states and inputs, when the simulation runs twice, then position, rotation, velocity, and angularVelocity sequences match exactly (determinism).
- AC-007: Renderer smoothing does not write to GameState; no sim components are mutated by the renderer.

## 6. Test Automation Strategy

- Test Levels:
  - Unit: motion math (angle wrap, clamps, damping, PD step, integration).
  - Integration: multi-tick entity motion; convergence to heading/speed under constraints.
  - E2E (visual smoke via Playwright): turn and acceleration scenarios; web-first assertions (no hard waits).
- Frameworks:
  - Unit/Integration: Vitest.
  - E2E: Playwright.
- Test Data:
  - Deterministic fixtures for ship stats and initial states.
  - No random sampling in motion tests; preserve seeded RNG harness.
- CI/CD:
  - Run `npm run typecheck` and `npm test`.
- Coverage:
  - ≥ 90% on new motion code.
- Performance:
  - Optional micro-benchmarks for motion loops; ensure no hot path allocations.

## 7. Rationale & Context

- Acceleration-limited motion prevents instantaneous heading snaps and produces natural-looking turns.
- Renderer interpolation bridges the gap between discrete sim ticks and higher render frame rates.
- Procedural banking and thruster VFX improve perceived smoothness/intent without affecting canonical state.
- Determinism is preserved by keeping all simulation state in GameState and avoiding randomness in motion paths.

## 8. Dependencies & External Integrations

### External Systems

- EXT-001: Physics/maths utilities (e.g., Rapier3D or engine-provided math) for vector/quaternion operations; collision shapes as needed.

### Third-Party Services

- SVC-001: None.

### Infrastructure Dependencies

- INF-001: Main-thread simulation loop integrated with render frames; stable `dt` from engine.

### Data Dependencies

- DAT-001: Ship configuration providing per-class motion stats.

### Technology Platform Dependencies

- PLT-001: TypeScript strict mode; deterministic math operations.
- PLT-002: Renderer capable of quaternion slerp and vector lerp (Three.js/R3F or equivalent).

### Compliance Dependencies

- COM-001: None.

Note: Specify capabilities rather than specific library versions to keep the spec architectural.

## 9. Examples & Edge Cases

Example turn-time intuition:

- With `angularAcceleration = 360°/s²` and `maxTurnRate = 180°/s`, a 180° turn typically uses accelerate→cruise→decelerate. Tuning target: total time ~2.0–2.5s (depends on accel vs cap).


Edge cases:

- EC-001: Large `dt` spikes (low FPS) — ensure clamps scale with `dt`.
- EC-002: Angle wrap-around near ±180° — use shortest-arc interpolation.
- EC-003: Teleport/spawn — reset renderer’s prevSim state to avoid lerp trails.
- EC-004: Target flip-flop — use `responseDelayMs`/hysteresis to prevent micro-oscillation.
- EC-005: Entity removal mid-turn — renderer must safely drop smoothing state.
- EC-006: Collision impulses — visual smoothing should follow sim; consider temporarily reducing smoothing alpha after large deltas.


```code
// Continuous damping converted per-step:
dampingEff = 1 - exp(-dampingPerSecond * dt);
velocity *= (1 - dampingEff);
angularVelocity *= (1 - dampingEff);

// Interpolation factor between sim ticks:
alpha = clamp((renderTime - simTickStart) / simDelta, 0, 1);
visualPos = lerp(prevSimPos, currSimPos, alpha);
visualRot = slerp(prevSimRot, currSimRot, alpha);
```

## 10. Validation Criteria

- VC-001: Unit tests demonstrate correct clamping and integration for linear and angular motion across representative `dt` values.
- VC-002: Deterministic repeatability test passes for a multi-second turn/accelerate scenario.
- VC-003: Visual inspection or automated heuristics confirm no visible snapping at 20 Hz sim with 60 FPS render.
- VC-004: Banking angle correlates with measured yaw rate or lateral acceleration within configured bounds.

## 11. Related Specifications / Further Reading

- SpaceAutoBattler Architecture: Game/Simulation/Renderer separation (repo docs).
- Canonical GameState and deterministic RNG rules (repo docs).
- Three.js/R3F quaternion slerp references (general).
