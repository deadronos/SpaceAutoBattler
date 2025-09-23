deadronos: with aiv2 ships can change direction really fast,

propose ways to make that visually less jumpy:

can we provide ships with stats like thrust/acceleration/turnrate and physics shapes a more natural flight/turnpath to new directions?

can we use generated animation like lerping to interpolate/smooth movement/steering?

dont code yet

GitHub Copilot: I'll create a short todo list for this planning work and mark the first item (drafting the proposal) as in-progress so we have structured progress tracking. Then I'll lay out concrete options, recommended approach, parameters, tradeoffs, and testing/tuning guidance (no code). 

Created 6 todos

I'll mark the "Draft turn-smoothing proposal" todo as completed. Then I'll present the proposal with options, recommended approach, parameters, tradeoffs, and tests — no code. 

Completed (1/6) *Draft turn-smoothing proposal*

I'll propose a non-code plan to reduce the "jumpy" look of ships that instantaneously change heading with AI v2. Below are options, a recommended approach (mix of deterministic physics and renderer smoothing), key parameters, tradeoffs, and a short test/tuning plan you can use before implementing.

## Summary (what I'll cover)
- Why jumpiness happens
- High-level options (physics, steering controllers, renderer smoothing, animation/VFX)
- Recommended approach (combined)
- Concrete data/parameters to add to ship configs/types
- Steering algorithms and interpolation options (math-level)
- Visual cues (banking/roll, thrusters, trails)
- Tradeoffs (determinism, CPU, fidelity)
- Acceptance criteria and tests for tuning

## Why ships look jumpy
- AI chooses a new target heading and code instantly sets orientation or velocity direction.
- The visual renderer immediately displays that change (or only waits a single tick), producing discontinuous rotation or velocity that looks unnatural.
- Low simulation tick-rate or discrete steering updates amplify perceived snapping.

## High-level options (pros/cons)

1) Physics-based movement (forces/torques, inertia)
   - Pros: Natural, predictable motion; single canonical source of truth (GameState); matches player expectations.
   - Cons: More parameters to tune; needs deterministic integration (use existing seeded RNG and GameState); slightly higher CPU.
   - Good for: simulation-first approach, accurate collisions.

2) Steering controllers (PID/steering behaviors)
   - Pros: Simple to add; directly control angular acceleration/turn smoothing; deterministic if implemented on GameState.
   - Cons: Requires tuning per ship class; can feel "floaty" if over-smoothed.
   - Good for: keeping simulation logic deterministic while avoiding heavy physics.

3) Renderer-side smoothing / interpolation (visual-only)
   - Pros: No simulation changes required; cheap and fast; allows changing visuals independent of sim.
   - Cons: Can hide simulation discrepancies; must be carefully implemented to avoid diverging visuals from sim state (especially in authoritative/netplay scenarios).
   - Good for: quick wins, improving visuals when sim is already "good enough".

4) Generated animation / procedural bank & roll + particle VFX
   - Pros: Excellent for perceived smoothness; communicates forces; cheap to compute.
   - Cons: Cosmetic only; must be sync’d with sim to avoid mismatch.

Recommended: combine (1 or 2) + (3 + 4). Use deterministic steering (PID or torque-limited angular acceleration) for canonical motion, and renderer-side interpolation + banking visuals for polish.

## Recommended approach (step-by-step, non-code)

1. Add motion stats to ship definitions (thrust, mass, maxSpeed, linearAccel, angularAccel/turnRate, angularDamping/inertia, collision shape).
   - Purpose: allow different ship classes to have characteristic turning behavior.

2. Implement a deterministic steering controller in GameState:
   - Goal: compute desired linear thrust and desired angular acceleration/torque to point toward the desired heading.
   - Approach: compute angle difference between current forward vector and desired heading; clamp angular acceleration by ship angularAcceleration and angularDamping; integrate angular velocity to update orientation.
   - Choose either:
     - Torque-style: integrate angular velocity (use inertia/mass), or
     - Kinematic PID-style: directly compute angular velocity command with a PD controller (gives tight control).
   - Ensure all state is on canonical GameState and uses the deterministic RNG and integration step used elsewhere.

3. Update linear motion similarly:
   - Only change thrust magnitude toward forward axis; accelerate using linearAcceleration, limit by maxSpeed.
   - Optionally allow lateral thrusters for strafing with lower lateral acceleration.

4. Renderer-side smoothing (visual-only, added on top of sim):
   - Interpolate position each render frame between last and current simulation state: positionLerp = lerp(prevPos, simPos, alpha).
   - Slerp rotations between prevQuat and simQuat to produce smooth orientation changes: visualQuat = slerp(prevQuat, simQuat, alpha).
   - For higher polish, use critically-damped spring smoothing or exponential moving average (low-pass filter) that smooths both position and quaternion but remains responsive.

5. Add visual cues:
   - Banking (roll): compute roll angle from lateral acceleration / turn rate and apply to visual transform (not sim).
   - Thruster VFX: scale rear/front thruster emission intensity with throttle and lateral thruster usage.
   - Trail/afterburner smoothing: render trails based on averaged velocity.

6. Tuning and tests:
   - Provide per-ship defaults and a tuning guide (numbers below).
   - Create deterministic unit tests for turning math (e.g., given inputs, angular accel integrates to expected heading after N ticks).
   - Playtest with reduced and increased tick rates to validate renderer smoothing blends well.

## Concrete ship stats to add (schema-like, no code)
- mass: number (kg or unitless) — inertia baseline
- collisionShape: enum | params (sphere radius / box dims / convex) — for physics/rapier
- maxSpeed: number (units/sec)
- linearAcceleration: number (units/sec^2) — forward thrust acceleration
- linearDamping: number (unitless) — reduces velocity over time (sim integration)
- maxReverseSpeed: number (optional)
- maxLateralAcceleration: number (optional; for strafing)
- maxTurnRate: number (deg/sec or rad/sec) — soft limit on angular velocity
- angularAcceleration: number (deg/sec^2 or rad/sec^2) — how quickly ships can change rotational velocity
- angularDamping: number (reduces angular velocity)
- turnResponse: number (0..1) — mixes between kinematic heading snap and dynamic torque (useful for tuning)
- steeringController: enum {PID, Torque, Direct} — choose algorithm per ship class
- responseDelay: number (ms) — optional; small delay to avoid high frequency target flipping
- visualBankFactor: number (deg per lateral g) — controls roll amplitude visually
- smoothing: object (renderer-only)
  - positionLerp: 0..1 (per-frame alpha)
  - rotationSlerp: 0..1 (per-frame alpha)
  - springStiffness, springDamping — if using spring smoothing

Default example values (starting point; tune later):
- mass: 1
- maxSpeed: 30
- linearAcceleration: 40
- linearDamping: 0.02
- maxLateralAcceleration: 10
- maxTurnRate: 180 deg/sec (pi rad/s)
- angularAcceleration: 360 deg/sec^2
- angularDamping: 0.1
- turnResponse: 1.0 (fully dynamic), or 0.5 for snappier classes
- responseDelay: 0 ms
- visualBankFactor: 10 deg per unit lateral acceleration
- smoothing.positionLerp: 0.15
- smoothing.rotationSlerp: 0.12

These are ballpark numbers — test and tune per ship size/class.

## Steering/controller options (deterministic, choose one)

- Torque-based (simulate angular inertia):
  - Compute angleError = shortestAngle(desiredHeading, currentHeading)
  - DesiredAngularAccel = clamp(kp * angleError - kd * angularVelocity, -angularAcceleration, +angularAcceleration)
  - angularVelocity += DesiredAngularAccel * dt
  - rotate by angularVelocity * dt
  - Pros: physically plausible, smooth. Cons: may overshoot; tuning needed.

- PD (kinematic) controller that sets target angular velocity:
  - targetAngularVel = clamp(kp * angleError, -maxTurnRate, +maxTurnRate)
  - angularVelocity += clamp((targetAngularVel - angularVelocity) * responseFactor, -angularAcceleration * dt, +angularAcceleration * dt)
  - Pros: better control, less overshoot; deterministic.

- Direct interpolation with smoothing (simpler, possibly acceptable):
  - Compute nextHeading = currentHeading + clamp(angleError, -maxTurnRate*dt, maxTurnRate*dt)
  - But use acceleration-limited delta to prevent instant changes.

Pick PD/Torque for best tradeoff; ensure integrator and math are deterministic.

## Renderer smoothing algorithms (visual-only)
- Simple lerp/slerp:
  - Each render frame compute alpha = fraction of time since last sim tick (frameTime / simDelta)
  - pos = lerp(prevSimPos, currSimPos, alpha)
  - rot = slerp(prevSimQuat, currSimQuat, alpha)

- Exponential smoothing (per-frame low-pass):
  - visual = visual * (1 - a) + sim * a, where a = 1 - exp(-k * dt)
  - For rotations, convert to axis-angle or use squad/slerp with small alpha.

- Critically-damped spring:
  - More advanced; maintains velocity and acceleration state, yields smooth, non-overshooting following. Use for camera-like smoothing or ship visual follow when you need both responsiveness and no overshoot.

Notes:
- If simulation rate varies or is lower than render FPS, prefer interpolation (lerp/slerp) between sim ticks to avoid temporal aliasing.
- For authoritative sim, keep visual interpolation read-only and do not mutate GameState.

## Visual banking/animation
- Compute lateral acceleration (accelLocal = transformWorldToLocal( (velocity - prevVelocity) / dt ) ) or compute turn rate.
- Derive bank angle = clamp(-accelLocal.x * visualBankFactor, -maxBankDeg, +maxBankDeg); apply as roll to visual transform (multiply to sim rotation).
- Blend bank via a smoothing filter (to avoid jitter due to small acceleration noise).
- Add thruster particle intensity proportional to throttle and lateral thruster usage.

## Handling sudden direction changes due to AI target swapping
- Add short hysteresis or responseDelay to heading updates:
  - If desired heading toggles between directions in <X ms, optionally ignore small reversals or low-confidence updates.
- Optionally, use "planning heading" vs "immediate heading":
  - AI computes planned heading; steering controller tracks planned heading but can be made to follow a filtered version (ex: running average) to avoid reacting to tiny target changes.
- Stabilize target selection: require sustained higher confidence before big heading shifts.

## Determinism & networking considerations
- All simulation logic must belong to GameState and be deterministic (per repo instructions).
- Renderer smoothing and visual-only animation may diverge visually but are acceptable if server-authoritative sim remains canonical.
- If the project uses replay/deterministic simulation tests, ensure unit tests validate numerical integration and steering deterministic behavior.

## Performance considerations
- Steering controllers are cheap (per-ship math). Torque-based physics slightly more expensive but still minimal for small fleets.
- Renderer interpolation per frame per ship is cheap (few lerps and slerps).
- Critically-damped spring or quaternion math is slightly more expensive but acceptable.
- For many ships, avoid per-frame allocations; reuse vectors/quaternions.

## Acceptance criteria (measurable)
- Ships no longer visually "snap" to new headings: turning should be continuous with max angular jerk limited by angularAcceleration.
- Turn latency: time to rotate 180° should be consistent with ship stats (within +/-10%).
- No perceptible stutter at both high and low simulation tick rates (test with dt=1/60 and dt=1/20).
- Visual bank/roll matches turn rate and is visually informative (doesn’t jitter).
- Deterministic unit tests for steering math pass under n=3 different dt values.

## Tests & tuning checklist
- Unit tests:
  - Given initial heading, apply a target heading and verify angle over N ticks matches expected within tolerance.
  - Verify angular damping causes decay of angular velocity.
  - Verify position integration for linearAcceleration obeys maxSpeed.
- Playtests:
  - Test with many ships turning in formation; look for unnatural separation or collisions (if physics used).
  - Run with low sim tick rate (e.g., 20Hz) and verify renderer interpolation hides aliasing.
- Metrics:
  - Log max instantaneous angular change between ticks (should be << maxTurnRate * dt).
  - Measure overshoot ratio for PD controller.

## Implementation roadmap (next steps once you want code)
- Add types/defaults to ship config and index.ts.
- Implement controller in simulation update path (GameState systems).
- Add renderer-side visual smoothing and banking transform in `Ship.tsx` or renderer system.
- Add VFX hooks and tune particle emission by throttle values.
- Add unit tests in vitest for motion math.

## Small example tuning scenarios (guide)
- Fighter (agile):
  - mass: 0.7, maxSpeed: 45, linearAccel: 90, maxTurnRate: 270°/s, angularAccel: 720°/s^2, visualBankFactor: 14°
- Corvette (balanced):
  - mass: 1.2, maxSpeed: 30, linearAccel: 40, maxTurnRate: 120°/s, angularAccel: 360°/s^2, visualBankFactor: 10°
- Frigate (slow/heavy):
  - mass: 3.0, maxSpeed: 18, linearAccel: 20, maxTurnRate: 60°/s, angularAccel: 120°/s^2, visualBankFactor: 6°

Tune damping to remove oscillation: set angularDamping to ~0.1–0.5 depending on inertia.

## Final notes and recommendations
- If you want a minimal, low-risk first step: implement renderer-side lerp/slerp and visual banking. This gives a large visual improvement with minimal simulation changes.
- If you want consistent physics and future-proofing (collisions, formation behavior), implement steering controller on GameState next.
- Keep tests deterministic and add "feel" playtests for designer tuning—numbers above are initial heuristics.

If you want, I can now:
- Draft the concrete TypeScript types and default values to add to index.ts and ships.ts, or
- Implement renderer-side interpolation and banking in Ship.tsx first (quick visual win), or
- Implement the deterministic PD/two-state steering controller in systems.ts (simulation change).

Which next step should I take?




