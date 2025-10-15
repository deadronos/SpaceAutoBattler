# Agents Guide: src/renderer/materials

- Purpose: Material factories and a material registry for bullets, thrusters, explosions and other shared materials.
- Reuse: Centralise material creation and caching (see `materialRegistry.tsx`) to avoid duplicate GPU resources.
- Disposal: Provide deterministic disposal / lifecycle hooks for materials used in tests and during hot-reload.
- Testing: Validate that material keys map consistently and that lifecycle hooks free GPU resources when expected.
