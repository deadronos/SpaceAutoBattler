# Agents Guide: src/renderer/shields

- Purpose: Shield materials and helper shaders for shield ripple visuals.
- Contracts: Keep shield materials deterministic and driven by the `shieldRipples` array on `ShipComponent` (`src/types/ship.ts`, read via `state`) rather than ad-hoc randomness.
- Resource management: Reuse shader programs and guard against leaking WebGL resources on hot-reload.
- Tests: Add visual baselines for ripple amplitude and shader falloff changes.
