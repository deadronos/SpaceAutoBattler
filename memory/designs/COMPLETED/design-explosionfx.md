# Design — Ship Kill Explosion Effects

**Status:** Draft 2025-09-27  
**Related Requirements:** 2025-09-27 — Ship Kill Explosion Effects (memory/requirements.md)

## Problem Statement

Explosions triggered by ship destruction currently have no bespoke visual treatment, leaving lethal hits without satisfying feedback. We need a deterministic, multi-stage explosion effect that prioritises ship-kill events, delivers faction-aware visuals, and integrates with existing renderer systems without introducing camera shake or simulation nondeterminism.

## Goals

- Emit deterministic explosion events every time a ship is destroyed, including seeded data for renderer playback.
- Render a multi-stage explosion stack (flash → shockwave → fireball → debris → smoke) that reads clearly in Playwright captures.
- Apply transient dynamic lighting to nearby ships without disturbing camera transforms or physics.
- Respect faction palettes (Alliance cool tones, Reavers warm tones) and scale visuals by hull size.
- Maintain performance by reusing pools, instancing, and bloom groups already configured for explosions.

## Non-Goals

- Non-lethal projectile impact visuals (tracked as follow-up issue).
- Screen shake, UI overlays, or audio responses tied to explosions.
- Overhauling existing shield ripple or muzzle flash systems.
- Introducing configurable tuning panels in this pass (handled after baseline lands).

## Architecture Overview

```text
Game Systems (resolveProjectiles)
  └─ emitShipKillExplosion(state, ship, projectile)
        ├─ ExplosionEvent pool (GameState.explosions[])
        ├─ EXPLOSION_CONFIG lookup (per faction/hull)
        └─ seeded timeline + light spawn data

Render Frame (Battlefield)
  └─ ExplosionsLayer
        ├─ ExplosionRenderer (instanced meshes + shader materials)
        │     ├─ Flash (sprite)
        │     ├─ Shockwave (ring shader)
        │     ├─ Fireball (noise sphere)
        │     ├─ Debris instancer
        │     └─ Smoke particles
        └─ DynamicLightManager (transient point lights)
```

## Data Flow

1. `resolveProjectiles` detects a lethal hit and invokes `emitShipKillExplosion`, passing ship transform, projectile data, and RNG seed.
2. `emitShipKillExplosion` selects a preset from `EXPLOSION_CONFIG` (faction + hull tier), writes a pooled `ExplosionEvent` containing `id`, `seed`, `variant`, `position`, `radius`, `startTime`, `duration`, `lightFalloff`, and staged timing data, then appends it to `state.explosions`.
3. `updateExplosions(state, delta)` (new system step) advances timeline cursors, trims expired events, and recycles pooled vectors/lights.
4. `Battlefield` mounts `ExplosionsLayer`, reading `state.explosions` every frame. For each active event it feeds the seeded parameters into `ExplosionRenderer` and `DynamicLightManager`.
5. `ExplosionRenderer` updates instanced geometry attributes (scale, opacity, UV offsets) deterministically; `useBloomRegistration` keeps glow elements in the existing `explosions` bloom group.
6. `DynamicLightManager` enables/updates per-event point lights with distance-based attenuation, disabling them once `lightDuration` lapses.
7. Playwright captures and renderer tests inspect the composed stages; once an event expires, both renderer and simulation cleanup occur within the same frame.

## Visual Stages

1. **Flash (0–0.12s):** Additive quad/sprite at explosion origin; emissive intensity derived from hull size. Alliance palette: #a6d8ff core rimmed with #ffffff. Reavers palette: #ffb347 core with #ff6138 rim. Flicker amplitude seeded via `SeededRng`.
2. **Shockwave (0.08–0.40s):** Expanding torus/plane with custom shader performing radial alpha falloff and normal-based distortion of background. Radius growth and opacity planned via `ShockwaveTimeline` configuration, independent of camera distance.
3. **Fireball Core (0.20–0.60s):** Noise-distorted sphere using triplanar noise to animate edges; emissive color interpolates from faction tint to neutral charcoal (#2f2f2f).
4. **Debris Trails (0.18–0.90s):** Instanced shard meshes (low-poly triangles) launched along seeded cone vectors. Each shard uses glowing edge material (emissive Fresnel) that cools over lifetime.
5. **Particle Variety (0.22–1.8s):**
   - **Sparks:** Additive billboards with short lifespans (≤0.35s) and high bloom.
   - **Plasma Wisps:** Medium-lifespan quads with gradient alpha, tinted by faction.
   - **Smoke Wisps:** Soft noise-textured planes, depth-write disabled, drifting upward with seeded perlin velocity.
6. **Dynamic Lighting:** Point light spawns at origin with intensity curve `[1.0 → 0.0]` over 0.25s. Light color matches faction palette but clamps to avoid bleaching neighbouring ships.

## Faction & Hull Scaling

- Alliance (blue/white): cooler flash, pale shockwave edge, light-blue plasma wisps. Light color `#a6d8ff`.
- Reavers (orange/red): warmer flash, high-contrast sparks, red-orange smoke fringe. Light color `#ff8447`.
- Hull tiers adjust explosion radius, debris count, and smoke density via `EXPLOSION_CONFIG.hulls` mapping (e.g., fighter small, carrier massive) while maintaining consistent timing percentages.

## Interfaces & Configuration

```ts
export interface ExplosionEvent {
  id: number;
  seed: number;
  faction: 'alliance' | 'reavers';
  hull: ShipHull;
  position: Vector3;
  radius: number;
  startTime: number;
  duration: number;
  lightDuration: number;
  shockwave: { delay: number; duration: number; maxRadius: number };
  fireball: { delay: number; duration: number };
  debris: { count: number; speed: [number, number] };
  particles: { sparks: number; plasma: number; smoke: number };
}

export interface ExplosionConfigEntry {
  baseRadius: number;
  flashIntensity: number;
  lightColor: ColorRepresentation;
  lightFalloff: number;
  debrisCount: number;
  particleCounts: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
}
```

- `EXPLOSION_CONFIG` keyed by `faction:hull` maps to `ExplosionConfigEntry`.
- `emitShipKillExplosion` merges config defaults with projectile overrides (e.g., heavy torpedo yields hotter fireball).
- `ExplosionRenderer` consumes `ExplosionEvent` plus memoised geometry/material pools.

## Error Handling Matrix

| Scenario | Detection | Response | Validation |
| --- | --- | --- | --- |
| Pool exhaustion (more ship kills than pool size) | `emitShipKillExplosion` finds no free slot | Reuse oldest inactive slot after logging rate-limit warning; ensure determinism by deterministic eviction | Vitest stress test simulates rapid kills and asserts oldest event recycled |
| Missing config entry for faction/hull | Config lookup undefined | Fallback to neutral preset (orange-white) and log once | Unit test mocks missing key, expects fallback palette and warning |
| Shader compilation failure for shockwave/fireball | Material compilation throws | Swap to `meshStandardMaterial` fallback with reduced visuals, keep event active | Renderer unit injects failure and asserts fallback path |
| Dynamic light creation fails (WebGL limit) | Light manager catches allocation error | Skip light stage but continue other visuals | Unit test mocks failure and ensures event still renders |
| Playwright capture mismatch due to bloom intensity | Visual diff exceeds threshold | Provide tuning knobs in config (follow-up) and update baseline once tuned | Manual review + future tuning issue |

## Testing Strategy

- **Unit (Vitest):**
  - `explosions-event.spec.ts`: lethal hit emits expected event payload, seeded timeline deterministic.
  - `explosions-renderer.spec.tsx`: stage opacity/scale curves align with config for seeded event.
  - `explosions-lighting.spec.tsx`: dynamic light intensity scales by distance; camera matrices unchanged.
  - `explosions-lifecycle.spec.ts`: events expire and recycle pools, unregistering bloom and lights.
- **Integration (Playwright):**
  - `explosions-visual.spec.ts`: orchestrated battle replicates Alliance vs Reavers ship kills, captures baseline images verifying stage presence and faction palettes.
- **Manual:**
  - QA smoke run in dev build toggling selective bloom intensity to ensure explosion halo remains controlled.

## Implementation Steps

1. Extend `GameState` with `explosions: ExplosionEvent[]` pool plus allocator helpers in `src/game/state.ts`.
2. Add `emitShipKillExplosion` and `updateExplosions` to `src/game/explosions.ts`; invoke emission from `resolveProjectiles` on lethal hits.
3. Introduce `EXPLOSION_CONFIG` in `src/config/explosions.ts` defining faction/hull presets and timing.
4. Create `ExplosionRenderer` component in `src/components/ExplosionRenderer.tsx` (instanced meshes, shader materials, seeded animations) and register it via new `ExplosionsLayer` inside `Battlefield`.
5. Implement `DynamicLightManager` to spawn/cleanup transient point lights without affecting camera transforms.
6. Wire `useBloomRegistration` for flash/shockwave/fireball meshes using existing `explosions` bloom group.
7. Add Vitest suites and Playwright spec outlined above; update baselines after verifying visuals.
8. Document config knobs and palette mapping in `docs/renderer-explosions.md` (optional once visuals stabilise).

## Follow-ups

- **Projectile Impact Visuals:** Add non-lethal impact sparks/smoke reusing explosion assets ([#187](https://github.com/deadronos/SpaceAutoBattler/issues/187)).
- **Timing & Config Tuning:** Expose explosion timing/intensity in config for easier iteration ([#188](https://github.com/deadronos/SpaceAutoBattler/issues/188)).
- **Visual QA:** After baseline lands, schedule dedicated art pass to tweak palettes and bloom (optional).
