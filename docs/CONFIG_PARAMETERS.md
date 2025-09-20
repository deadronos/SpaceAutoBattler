# Configuration Parameters — current implementation

The rewrite branch uses a small, explicit configuration surface focused on world scale and rendering defaults. Most gameplay values live in code (with TypeScript types) to keep behavior deterministic and discoverable.

## World configuration (`src/game/config.ts`)

- `WORLD_SIZE` — length of the cubic world edge (default: 4000). The world is centered at the origin.
- `WORLD_HALF` — `WORLD_SIZE / 2` (±2000 with defaults).
- `WORLD_BOUNDS_MARGIN` — small inward margin used by clamping.
- `clampToWorld(v)` — clamps a position `{x,y,z}` to stay within the world cube.
- `CAMERA_DEFAULTS` — far/near, fov, and default camera position tuned for the large world.
- `FOG_DEFAULTS` — fog start/end tuned for deep-space look at the chosen scale.

Usage example:

```ts
import { WORLD_SIZE, clampToWorld } from '@/game/config';

// Move an object then keep it inside bounds
pos.addScaledVector(dir, speed * dt);
clampToWorld(pos);
```

## Rendering helpers

`src/components/Battlefield.tsx` integrates `@react-three/drei`:

- `OrbitControls` — orbit/pan/zoom around origin with sensible min/max distances.
- `Grid` — infinite grid sized around `WORLD_SIZE` for spatial context.

These can be tuned directly in `Battlefield.tsx` if the world size is changed.

## Ship stats/scales

`src/game/ships.ts` defines `SHIP_STATS`. All models are assumed to be authored at roughly 1:1 units, and each ship uses `scale: 1`. Colliders are adjusted in code (`capsule(0.8, 0.6)`) for consistent gameplay.

---

Legacy docs that referenced broader configs (AI behavior, separation, etc.) are archived. When reintroducing runtime-tunable parameters, prefer a single config module and add minimal unit tests demonstrating the effect of the parameter on behavior.
