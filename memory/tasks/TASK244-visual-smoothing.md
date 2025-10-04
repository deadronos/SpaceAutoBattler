# [TASK244] - Visual smoothing and local visual offsets for ships

**Status:** In Progress  
**Added:** 2025-10-04  
**Updated:** 2025-10-04

## Original Request
Improve ship visuals by adding robust dt-independent smoothing, per-hull overrides, and an advanced critically-damped bank spring. Provide a global toggle and task out implementation & tests.

## Thought Process
- The current implementation in `useShipInterpolation` uses per-frame lerp factors (`positionLerp`, `rotationSlerp`, `bankLerp`) without `dt`. These are frame-rate dependent and risk inconsistent smoothing across rates.
- Visual transforms are currently applied on the same `groupRef` that contains the ship scene. To safely add bob/sway/bank we should split physics-root vs visual child to avoid moving any collider-affecting data and to keep visuals recomputed each frame from the physics pose.
- Bank should be driven from a smoothed turn-rate rather than raw angular velocity, or use a critically-damped spring for better stability.

## Implementation Plan (steps)
1. Add configuration shape and defaults
   - Add `motion.visual` to ship config (`src/data/shipStats.ts` default map) with fields: `enabled`, `position.k`, `rotation.k`, `bank.k`, `bank.maxDeg`, `bank.useCriticallyDamped`, `bob` params, `localSpace`, `enableCcd`.
   - Add global renderer flag: `renderer.visualSmoothing.enableShipVisualSmoothing` in central config.
2. ShipView markup change
   - Modify `src/components/ship/ShipView.tsx` to create an inner `visualRef` group inside the `groupRef` (physics root). Keep `groupRef` set to interpolated physics pose and apply local bob/bank to `visualRef`.
3. Interpolation hook changes
   - Update `src/hooks/useShipInterpolation.ts`:
     - Change `useFrame` callback to accept `delta` and pass `dt` to `updateInterpolation`.
     - Convert smoothing params to time-constant `k` semantics. Add helper `kToAlpha(k, dt)`.
     - Replace per-frame `lerp(...)` with exponential filters using dt-derived alpha. For rotation use slerp with alpha.
     - Add optional critically-damped scalar spring for bank (config toggled). Document equations and provide a tested implementation.
4. Add bob/sway module (minimal, safe defaults)
   - Implement bob target computation based on speed/turn, local-space offsets, with amplitude clamps and fade near low speed.
5. Enable CCD toggle wiring for Rapier bodies
   - If `motion.visual.enableCcd` set, apply Rapier CCD setting on collider creation/wiring (note: will require small gating in physics body creation code; add guard and tests).
6. Tests
   - Unit tests for: k->alpha conversion, exponential filter convergence across variable dt sequences, bank spring stability across dt and target changes.
   - Integration tests: ensure toggle disables smoothing, verify child visual offsets do not affect physics raycasts/collisions.
7. Documentation & migration
   - Update `memory/designs/design-visual-smoothing.md` (this file) and add migration notes. Add config README section and change log for maintainers.

## Subtasks

| ID | Description | Status | Updated | Notes |
|---:|-------------|--------|---------|-------|
| 244.1 | Add `motion.visual` config + global toggle | completed | 2025-10-04 | default mapping for existing ships; shipStats updated; renderer global toggle added |
| 244.2 | Add `visualRef` child group to `ShipView` | not-started |  | minimal UI change |
| 244.3 | Convert smoothing to dt-independent exponential filters | completed | 2025-10-04 | `useShipInterpolation` updated to accept `dt`, compute alpha from k, and apply per-frame exponential smoothing; bank spring implemented (critically-damped) |
| 244.4 | Implement critically-damped bank spring (config) | not-started |  | unit tested |
| 244.5 | Implement bob/sway minimal safe defaults | not-started |  | clamped & faded amplitude |
| 244.6 | Wire CCD toggle into Rapier entity creation | not-started |  | opt-in only |
| 244.7 | Add unit & integration tests | not-started |  | vitest + integration checks |
| 244.8 | Update docs & memory bank | not-started |  | link design + task files |

## Acceptance Criteria
- [ ] Global toggle disables all per-ship smoothing, visuals match physics-interp directly.
- [ ] Per-hull config overrides exist and default mapping preserves legacy feel where requested.
- [ ] Smoothing is dt-independent: tests demonstrate consistent behavior across variable dt sequences.
- [ ] Bank spring option prevents oscillation across dt changes and has bounded settle time.
- [ ] Bob/sway is local-space, amplitude scales with speed/turn, and clamps/fades correctly.
- [ ] Collisions/raycasts remain governed by physics pose (visual changes do not influence gameplay correctness).

## Progress Log
### 2025-10-04

- Created task and initial implementation plan. Design doc drafted in `memory/designs`.
- Kickoff: started implementation on subtask `244.1` — add `motion.visual` config shape and global toggle.
- Completed subtask `244.1`: updated files:
  - `src/types/gameplay.ts` — added `MotionVisualConfig` and `MotionStats.visual` field.
  - `src/config/renderer.ts` — added `RENDERER_VISUAL_CONFIG` and `k -> per-frame` mapping (legacy-compatible resolve).
  - `src/data/shipStats.ts` — replaced per-hull `smoothing` blocks with `visual` blocks using recommended k defaults.
  - `src/utils/motionUtils.ts` — included `visual` defaults in `createDefaultMotionStats()`.
  - `src/game/validation.ts` — added validation rules for `motion.visual` fields.
- Completed subtask `244.3`: converted runtime smoothing to dt-based semantics and wired visual child group.
  - Key files changed:
    - `src/hooks/useShipInterpolation.ts` — pass `dt` from `useFrame`, compute smoothing alpha via `1 - exp(-k*dt)`, added legacy mapping fallback, implemented critically-damped bank spring and bank velocity state.
    - `src/components/Ship.tsx` — create `rootGroup` and `visualGroup` refs and pass both into the interpolation hook.
    - `src/components/ship/ShipView.tsx` — render nested `visualRef` group so visual offsets are local to the child.
  - Changed default bank behavior to use critically-damped spring by default for all hulls.

Next: run vitest unit tests for filter convergence and add unit coverage for spring step (subtask `244.7`).

---

Design owner: GitHub Copilot
