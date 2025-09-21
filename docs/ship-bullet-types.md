# Ship Bullet Types

This document describes the `ShipStats.bulletType` convention used by the game.

Overview

- Each ship hull entry in `src/game/ships.ts` may include an optional `bulletType` string.
- `bulletType` is a material/key string (for example `bullet:laser`) that maps to a renderer material registered via `src/renderer/materialRegistry.tsx`.
- When a ship is spawned, its `ShipComponent.bulletType` is copied from the hull's `ShipStats.bulletType`.
- When a ship fires, the `ProjectileComponent` receives the `bulletType` value so the projectile renderer can select the correct visual per-projectile.

Material keys

Examples of material keys currently registered:

- `bullet:laser` — default fast laser-like projectile
- `bullet:plasma` — slower, glowing purple plasma
- `bullet:ion` — bright bluish ion projectile
- `bullet:heavy` — heavier, warmer-toned projectile for big guns

Extending

- To add new projectile visuals, register a new material with `registerMaterial(key, component)` in `src/renderer/materialRegistry.tsx`, and set `bulletType` to the key in `src/game/ships.ts` for the appropriate hull.
- Prefer short names in the `bullet:*` namespace so keys remain discoverable.

Notes

- If a `bulletType` key is absent from the registry at render time, the `Projectile` component will fall back to the built-in default material.
- `bulletType` is optional and backwards-compatible with existing code.
