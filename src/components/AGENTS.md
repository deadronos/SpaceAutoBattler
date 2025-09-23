# Agents Guide: src/components

- Purpose: React components for battlefield rendering and HUD abstractions.
- Patterns: Compose logic through hooks and ECS selectors; keep heavy simulation in `src/game`.
- State: Rely on context/providers rather than module-level singletons; honour the canonical `GameState`.
- Performance: Avoid per-frame allocations inside `useFrame` handlers; memoise expensive Three.js objects.
- QA: Pair component changes with focused Vitest specs or Playwright flows when they affect player interaction.
