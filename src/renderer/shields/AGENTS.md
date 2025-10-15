# Agents Guide: src/renderer/shields

- Purpose: Shield materials and helper shaders for shield ripple visuals.
- Contracts: Keep shield materials deterministic and driven by `GameState` events (shieldRipples array) rather than ad-hoc randomness.
- Resource management: Reuse shader programs and guard against leaking WebGL resources on hot-reload.
- Tests: Add visual baselines for ripple amplitude and shader falloff changes.
