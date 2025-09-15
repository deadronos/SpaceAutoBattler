# renderer-effects — Visual effects and pooling

Last-Reviewed: 2025-09-15

Purpose

- Centralize effect creation and pooling (explosions, muzzle flashes, trails, shield impacts).

Key patterns

- Use object pools for ephemeral effects to avoid frequent allocations. Each effect type has a pool with factory functions that create and initialize Three.js meshes or particle systems.
- Reuse materials and geometries from `state.assetPool` when possible.
- Support both GPU-based particle systems and simple mesh-based effects depending on `rendererConfig`.

API

- `spawnExplosion(position, scale, color)` — obtains an effect from the pool, positions it, and schedules its return after life expires.
- `spawnTrail(start, end, lifetime, color)` — creates a trailing mesh attached to a bullet or ship.
- `spawnImpact(contactPoint, intensity)` — spawn small sparks/debris.
- `updateEffects(dt)` — update per-frame animation of pooled effects.

Optimization notes

- Keep effect lifetimes short and reuse geometry instances with per-instance uniforms for color/scale/time.
- When many effects are active, fall back to a lower-fidelity representation (fewer particles) to maintain frame rate.

Session note (2025-09-15): Reviewed and updated the last-reviewed date; confirmed pooling patterns and integration with `threeRenderer`.
