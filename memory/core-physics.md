# Memory — core-physics

Files: `src/game/state.ts`, `src/game/systems.ts`

Responsibilities

- Initialize Rapier world and EventQueue (created with `{ auto: true }`) in `createGameState` and step the world each frame via `physicsWorld.step(eventQueue)`.
- Ships and turrets are kinematic bodies; many temporary objects (turret sensor colliders, small projectile bodies if used) are created consistently and cleaned up during entity teardown.
- Collider setup: ships use capsule colliders sized for models authored at 1:1 scale; turret entities use very small ball colliders as sensors; when projectiles are represented in physics they use smaller primitives.

Notes

- Physics runs on the main thread (R3F `useFrame`). Integration parameters are adjusted to `delta * timeScale` when present and the simulation clock is used to accumulate fixed-steps.
- A `requestReset(state)` API schedules a deterministic `resetGame` via `SimulationClock.pendingReset` to execute after the current physics step — this pattern avoids Rapier aliasing errors caused by removing/creating bodies while the engine iterates physics internals.
- Keep per-frame allocations near zero in hot paths; turret/projectile pools and shared Vector3/Quaternion temp arrays are preferred.

Testing guidance

- Tests that exercise world reset behavior should schedule a `requestReset` and then step the world one frame to observe the expected cleared state. Avoid calling the reset inline during physics stepping in tests to match production timing semantics.

Updated: 2025-09-30
