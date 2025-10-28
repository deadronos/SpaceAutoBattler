````markdown
# Design: Visual Smoothing and Local Visual Offsets

## Goal

Provide a robust, extensible, and dt-stable visual smoothing system for ships that:

- Keeps physics as the single source of truth for collision and gameplay.
- Supports a global enable/disable toggle and per-hull/per-ship overrides.
- Replaces framerate-dependent per-frame lerp factors with recommended time-constant parameters (exponential smoothing) by default.
- Offers an advanced, critically-damped bank spring option for stable banking behavior under variable dt.
- Exposes safe bob/sway parameters (local-space, amplitude scaling, clamp/fade) with sensible UX defaults.

## Requirements (EARS-style)

1. WHEN rendering a ship each frame, THE SYSTEM SHALL compute the visual transform as physics_root_pose + local_visual_offset. [Acceptance: visual root equals interpolated physics pose; local offsets do not affect colliders or physics state.]
2. WHEN smoothing is enabled, THE SYSTEM SHALL use framerate-independent exponential smoothing based on a time-constant k (seconds^-1) to compute per-frame alpha from dt. [Acceptance: running with variable dt yields consistent time-to-converge tests.]
3. WHEN bank is applied, THE SYSTEM SHALL support either exponential smoothing or an analytic critically-damped spring controlled by config. [Acceptance: bank never shows underdamped oscillations across dt variations; tests confirm stability.]
4. WHEN visual smoothing is globally disabled, THE SYSTEM SHALL render ship visuals directly at the physics-interpolated pose with no secondary smoothing or bobbing. [Acceptance: toggling the global switch results in direct assignment to visual group transforms.]
5. WHEN bob/sway is enabled, THE SYSTEM SHALL compute offsets in local ship space, scale amplitude by speed/turn, clamp maxima and fade near zero speed/docking. [Acceptance: manual scenario demonstrates amplitude scaling & fade behavior.]

## Design

High-level layering

- Physics root (immutable for visuals): physicsRootRef — receives interpolated physics pose (interpolated between last & current tick using sim.alpha). This is the pose that colliders and gameplay reflect.
- Visual child (smoothed offsets): visualRef — child node under physicsRootRef that receives local transforms for bob/sway/bank and optionally additional smoothing.

Data flow per frame (render loop)

1. Obtain physics interpolated pose using `prevSimPose` and `currSimPose` with `sim.alpha`. (No external smoothing applied here.)
2. Compute target local offsets from instantaneous inputs (smoothedTurnRate, speed-derived bob target, bank target) — compute these targets from the physics data only.
3. If smoothing enabled:
   - Convert time-constant k -> alpha with `alpha = 1 - Math.exp(-k * dt)`.
   - Apply exponential smoothing to scalar targets and quaternion slerp for rotations using that alpha.
   - Alternatively, if `bank.useCriticallyDamped === true`, step the analytic critically-damped spring for bank with dt.
4. Set `physicsRootRef.position/quaternion = physicsInterpPose`.
5. Set `visualRef.localPosition/localQuaternion = computed local offsets` (no accumulation of world offsets).

## Config shape (TypeScript-like)

```ts
interface VisualConfig {
  enabled?: boolean; // master per-ship override
  position?: { k?: number }; // seconds^-1
  rotation?: { k?: number };
  bank?: { k?: number; maxDeg?: number; useCriticallyDamped?: boolean };
  bob?: {
    enabled?: boolean;
    baseAmp?: number;
    freq?: number;
    speedScale?: number;
    maxAmp?: number;
  };
  localSpace?: boolean; // default true
  clampAtLowSpeed?: { enabled?: boolean; speedThreshold?: number };
  enableCcd?: boolean; // instruct Rapier collider to enable CCD
}

// Global renderer toggle
interface RendererConfig {
  visualSmoothing?: { enableShipVisualSmoothing: boolean };
}
```

Default recommended time-constant values (empirically chosen safe defaults)

- position.k = 12.0 (roughly 95% convergence in ~0.25s)
- rotation.k = 30.0 (fast visual rotations that still feel smooth)
- bank.k = 18.0 (or use critically-damped spring with natural frequency ω_n ≈ 14–18)
- bob.baseAmp = 0.08 (world units or normalized percentage of hull size); bob.freq = 1.2 Hz; bob.speedScale multiplies amplitude linearly to maxAmp.

Migration notes (legacy lerps)

- Existing per-frame lerp factors (`positionLerp`, `rotationSlerp`, `bankLerp`) will be mapped to `k` defaults conservatively. We prefer to set `k` to recommended defaults and provide a migration helper to approximate legacy feel where needed. Document mapping and provide a quick toggle for legacy behavior while teams converge.

Critically-damped bank spring (implementation summary)

- Use the standard second-order critically-damped differential equation formulation for a scalar target x(t) with natural frequency ω_n and damping ζ = 1:
  - analytic integration step available for critically-damped case; we will implement the stable discrete-time stepping method described by "Game Programming Gems" or use the exact implicit solution. This avoids oscillation and provides predictable damping under varying dt.
- Expose `bank.useCriticallyDamped` with `omegaN` or equivalently `k` to set stiffness.

UX safety

- Add `maxAmp` clamps and `fade` curves near zero speed or when certain gameplay flags active (docking, UI menus open) to avoid nausea and aim impairment.

Testing and validation

- Unit tests for exponential filter convergence across multiple dt sequences.
- Bank spring tests against variable dt for no overshoot and stable settling time.
- Integration regression ensuring raycasts/collisions use physics pose (not visualRef).

## Data and API changes

- Add `motion.visual` to ship hull config objects and default values in `src/data/shipStats.ts` (or central config normalization helper).
- Add global renderer boolean in renderer config file (config API and UI flag optional).

## Rollout

- Phase 1: Add config + dt-stable exponential smoothing (non-spring), keep legacy defaults mapped. Add tests.
- Phase 2: Add local visualRef group and migrate visuals to child offsets (ship view change). Add bob/sway minimal implementation and UX clamps.
- Phase 3: Add critically-damped bank spring option and performance/QA signoff. Switch default to spring if preferred after playtests.

## Implementation Notes (2025-10-05)

- Introduced a reusable `kToAlpha(k, dt)` helper and refactored `useShipInterpolation` to maintain both world and local visual offsets, updating an inverse root quaternion for reuse and applying smoothing only when the global/per-hull toggles allow it.
- Critically damped bank spring now preserves a velocity term and resets on teleports, with Vitest coverage ensuring no overshoot across varied deltas.
- Bob offsets are computed in local space with amplitude scaled by speed and yaw, fading when speed <5% of max and clamped to per-hull `maxAmp`. The child `visualRef` receives only the local offset, keeping the physics root deterministic.
- Added optional Rapier CCD enablement via `motion.visual.enableCcd` to mitigate tunnelling for fast hulls without impacting ships that keep the flag disabled.
- Test suite validates dt convergence, toggle bypass behaviour, bob amplitude clamping, and bank spring stability to guard regressions.

---

Design recorded by: GitHub Copilot
Date: 2025-10-04

````
