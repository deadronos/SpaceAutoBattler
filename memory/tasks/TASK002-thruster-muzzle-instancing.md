# TASK002 - Thruster & Muzzle Instancing + Bloom Registration

**Status:** Completed
**Added:** 2025-10-05
**Updated:** 2025-10-05

## Original Request

Batch thruster glows, engine plumes, and muzzle flashes into pooled InstancedMesh groups and ensure proper bloom registration and additive blending to preserve visual fidelity.

## Scope

- Implement pooled instancing for short-lived additive effects: thruster glows, engine plumes, muzzle flashes.
- Ensure per-instance TTL-driven scaling/fading and bloom registration via existing bloom provider hooks.
- Provide unit tests and perf harness coverage.

## Requirements (EARS-style)

1. WHEN thrusters or turrets emit additive glow effects, THE RENDERER SHALL batch them into pooled instanced meshes and preserve visual bloom/intensity behavior equivalent to prior per-entity rendering. (Acceptance: visual smoke test + unit tests for TTL/scale behavior.)

2. WHEN pooled capacity is exceeded, THE SYSTEM SHALL clamp new instances gracefully and emit a single rate-limited warning per frame. (Acceptance: saturation tests.)

## Implementation Plan

- Create `src/components/layers/MuzzleFlashInstancedLayer.tsx` and `src/components/thrusters/ThrusterInstancedManager.tsx` as needed.
- Hook into the existing bloom provider (e.g., `useBloomRegistration`) to register instance-level intensity where required.
- Add tests for RTT/bloom registration, TTL lifecycle, and saturation.
- Add perf harness scenarios combining projectiles + thrusters + muzzle flashes.

## Tests & Acceptance

- Unit tests verifying TTL lifecycle, bloom registration calls, and pool reuse.
- Visual snapshots for combined heavy-fire scenes to ensure parity.
- Perf harness results captured and added to task progress.

## Completion Notes

- Added `ThrusterInstancedManager` with pooled instanced glow rendering, bloom registration, and saturation logging used by the ship LOD pipeline.
- Extended `MuzzleFlashInstancedLayer` integration to share allocator utilities and ensured bloom-safe fallback materials.
- Added coverage for explosion/instancing managers that exercise capacity clamping behaviours.

---
