# DESIGN: TASK253 — Beam Projectile Follow

## Goal

Ensure beam projectiles reliably apply hits and keep visuals aligned with their firing source when the source moves during the beam's short lifetime. Minimise physics world mutations while preserving deterministic behaviour and testability.

## Data model changes

- BeamProjectile (projectile entity): add optional fields
  - `followSourceId: EntityId | null` — id of the firing ship or turret (null for non-following projectiles)
  - `localMuzzleOrigin: Vec3` — muzzle origin expressed in the source's local space at spawn
  - `localMuzzleDirection: Vec3` — normalized direction vector in source local space at spawn
  - `followStrategy: 'raycast' | 'physics'` — preferred approach; default `raycast`

## System changes

- fireProjectile (spawn): when spawning a beam-like projectile, capture and store `followSourceId`, `localMuzzleOrigin`, `localMuzzleDirection`. Avoid binding the spawned projectile rigid body to the source to prevent Rapier ownership/mutation issues.
- advanceProjectiles / resolveProjectiles: for beam projectiles with `followSourceId`:
  1. Attempt to resolve the source entity; if unresolved, destroy beam (or mark for immediate removal) to avoid orphans.
  2. Reconstruct world origin/direction by transforming `localMuzzleOrigin` and `localMuzzleDirection` via the source's `TransformComponent` (position + quaternion). Use shared temp vectors/matrices to avoid allocations.
  3. Perform a debug/production raycast using the reconstructed origin/direction to determine impact/hit results and to apply damage. Use a shared (cached) RaycastParams object for perf.
  4. Update beam visual records (BeamVisualComponent) with the reconstructed transform and length; preserve existing clamp/min-length logic from TASK251.

## Performance

- Raycast per-beam per-frame is acceptable given short TTLs and expected low concurrent beam counts; however, place a conservative cap (e.g., `MAX_ACTIVE_BEAMS_FOR_RAYCAST = 128`) and fail back to cheaper heuristics if exceeded.
- Use temporary pre-allocated vectors and matrices (module-level pool) to avoid GC churn.

## Error handling and edge cases

- Source destroyed mid-frame: destroy beam immediately and ensure visuals are pruned in the same tick. (Avoid orphan visuals)
- Source transform jitter: clamp reconstructed origin to a small tolerance (0.5 units) to avoid visual popping; test edge cases with large instantaneous teleport spawns.
- If `followStrategy === 'physics'` is selected, schedule body teleport via `state.simulation.deferredMutations` at flush point rather than teleporting mid-tick to avoid Rapier aliasing.

## Testing strategy

- Unit tests:
  - Validate `fireProjectile` populates follow metadata for beams.
  - Validate transform reconstruction math (local->world) using known transforms.
- System tests:
  - Move the source ship between ticks and assert reconstructed origin/direction tracks within ≤0.5 units.
  - Spawn a beam that hits a moving target and assert damage applied regardless of source movement during TTL.
  - Source removal test: remove source after spawn and assert immediate beam destruction and no lingering visuals.
- Integration tests:
  - Regression scenario covering known cases that previously showed misaligned hits.

## Migration notes

- Backwards compatibility: spawn code should only attach follow metadata for projectiles whose config flags `shouldFollowSource` or `category === 'beam'` to avoid touching other projectile types.

## Validation

- Run `npm run typecheck`, targeted Vitest suites for projectiles and beam visuals, and Playwright visual baselines if the visual changes affect captured images.


