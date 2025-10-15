# Agents Guide: src/components/lod

- Purpose: LOD management for ship/scene objects (impostors, LOD switching rules).
- Responsibility: Keep LOD decisions deterministic and driven by camera distance / explicit config; avoid frame jitter by adding hysteresis.
- Performance: Ensure switching logic is cheap and prefetches impostor textures/meshes when possible.
- Tests: Add deterministic unit tests that assert LOD thresholds and switching behaviour.
