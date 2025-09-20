# SpaceAutoBattler — Source code layout (rewrite branch)

This document reflects the actual layout and responsibilities of the current `src/` tree. It’s concise and oriented towards where to edit game logic vs. rendering.

Top-level `src/` (overview):

```text
src/
├─ App.tsx              # React shell (wraps scene + HUD)
├─ main.tsx             # App bootstrap; patches GLTF loader at runtime
├─ ui.html              # Minimal HTML template for builds
├─ assets/              # GLTF models, SVGs; helper map for ship models
│  ├─ gltf/             # *.glb ship models
│  └─ ships.ts          # SHIP_MODEL_PATHS (hull -> emitted URL)
├─ components/          # R3F scene graph & HUD
│  ├─ Battlefield.tsx   # Canvas, lights, OrbitControls, Grid, stars
│  ├─ Ship.tsx          # useGLTF model render + transform sync
│  ├─ Projectile.tsx    # Simple projectile visuals
│  └─ Hud.tsx           # On-screen stats
├─ game/                # Pure game logic & state (deterministic)
│  ├─ config.ts         # WORLD_SIZE=4000 cube, camera/fog defaults, clampToWorld
│  ├─ context.tsx       # React context/provider for GameState
│  ├─ state.ts          # create/dispose state, spawnInitialFleets
│  ├─ ships.ts          # SHIP_STATS (1:1 scale), spawnShip (Rapier bodies)
│  └─ systems.ts        # updateGame: AI-lite, movement, projectiles, sync
├─ hooks/               # Shared hooks (archetype queries etc.)
├─ styles/              # CSS
├─ types/               # Canonical types for entities & GameState
│  └─ react-three-drei.d.ts # Minimal ambient stubs
└─ utils/               # Utilities (seeded RNG, loader runtime patch)
	├─ rng.ts            # Seeded RNG for determinism
	└─ patchGltfLoader.ts# Guards against invalid GLTF URLs
```

Key design points

- Determinism: all simulation state lives on `GameState` (`src/types/index.ts`). RNG is seeded via `SeededRng` and used only in game logic.
- World scale: the game runs in a cubic world `WORLD_SIZE^3` (default 4000³) centered at the origin. Movement and projectiles are clamped with `clampToWorld`.
- Rendering: `Battlefield.tsx` sets up a `Canvas` with drei `OrbitControls` and an infinite `Grid`, plus a stars field for depth. Object transforms mirror Rapier kinematic bodies.
- Assets: GLBs are imported as URLs (webpack asset/resource). `useGLTF` is used with caching; `patchGltfLoader.ts` adds defensive checks in development.

Frequently edited files

- `src/game/config.ts` — world dimensions, fog/camera defaults, clamp helper.
- `src/game/systems.ts` — top-level update (movement, shooting, collisions, sync).
- `src/game/ships.ts` — ship stats (hp, range, speeds) and collider shapes.
- `src/components/Battlefield.tsx` — scene setup and camera controls.

Conventions

- Edit TypeScript in `src/` only; build output is in `dist/`.
- Import `GameState` types from `src/types/index.ts` (single source of truth).
- Keep model units 1:1; avoid ad-hoc scale multipliers. Adjust colliders instead.

Workflow

1. `npm run typecheck && npm test`
2. `npm run build` → open `dist/spaceautobattler.html` (or `npm run serve`)

This document is authoritative for layout. If other long-form specs drift, prefer this file and update the others in the same change.
