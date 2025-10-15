# Agents Guide: src/components/thrusters

- Purpose: Thruster instanced managers and glow materials used by ships for visual thrust effects.
- Performance: Use instanced meshes, per-instance attributes, and minimal per-frame allocations.
- Integration: Thruster visuals follow `ShipComponent.motion` and should be deterministic given the same simulation input.
- Testing: Add visual baselines and unit tests for attribute generation code.
