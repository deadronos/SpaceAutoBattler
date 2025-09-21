# Memory — core-physics

Files: `src/game/state.ts`, `src/game/systems.ts`

Responsibilities

- Initialize Rapier world and event queue; step the world each frame via `physicsWorld.step(eventQueue)`.
- Kinematic bodies for ships/projectiles; transforms synchronized after step.
- Collider setup: capsules for ships, balls for projectiles; ALL collision types/events enabled for future use.

Notes

- Physics runs on main thread (R3F `useFrame`). Integration parameters (`dt`) are adjusted to `delta * timeScale` when available.
- Keep per-frame allocations near zero in hot paths.
