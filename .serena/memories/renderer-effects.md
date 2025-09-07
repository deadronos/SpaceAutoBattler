## Renderer Effects

Last-Reviewed: 2025-09-07

This memory documents the renderer-side effects (explosions, trails, shields) and how they are spawned.

### Responsibilities
- Receive effect spawn requests from core systems and instantiate corresponding three.js objects or particles.
- Reuse pooled meshes and textures from `GameState.assetPool`.
- Manage lifetimes and update effect transforms and shader uniforms each frame.

### API
- `spawnExplosion(position, size, color)` — spawns an explosion effect.
- `spawnTrail(startPos, endPos, options)` — spawns a trail particle effect.

### Notes
- Effects are visual-only and should not affect game state or determinism.