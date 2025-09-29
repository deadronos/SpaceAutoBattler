# TASK228 — Rapier Velocity Sampling Hardening

## Problem Statement

`getShipVelocity` and helpers that feed intercept scoring still pull movement vectors by calling `rigidBody.linvel()`. After the motion system migration, ships keep their authoritative velocity inside `ShipComponent.velocity`, and Rapier bodies run as kinematic shells. Continuing to touch Rapier inside AI scoring reintroduces the "recursive use of an object" panic whenever the engine queries velocities during or shortly after world mutation (despawns, carrier launches). We need to stop querying Rapier from decision code and rely on the motion subsystem's state instead.

## Confidence Assessment

- **Confidence Score:** 0.87 (High). The motion system already maintains canonical velocities; swapping the sampling site is straightforward and aligns with previous Rapier deferral fixes.
- **Execution Strategy:** Proceed directly with the full implementation plan—no PoC required. We'll update the helper, adjust consumers, and expand the intercept spec to guard the new path.

## Architecture

- Permanently redirect `getShipVelocity` to read from `ShipComponent.velocity`, cloning into the provided temp vector and normalising invalid values to zero.
- Remove direct Rapier access from the helper; retain a defensive guard that short-circuits to zero when the velocity vector is missing or contains non-finite components.
- Ensure `getSpeedMagnitude` and intercept math continue to call the helper so the updated semantics propagate without additional churn.
- Keep temporary vectors (`TEMP_TARGET_VEL`, etc.) for allocation-free reuse; only their source will change.

## Data Flow

1. AI scoring invokes `getSpeedMagnitude` or `computeInterceptHeadingVector` with a ship entity.
2. The helper fetches the ship's `ShipComponent.velocity` vector.
3. If the vector exists and contains finite numeric components, it copies the values into the supplied temp vector.
4. If the vector is missing or contains NaN/Infinity, the helper writes zeros to the temp vector.
5. Callers proceed with the copied vector; Rapier APIs are never touched during this flow.

## Interfaces

- `getShipVelocity(ship: ShipEntity, out: Vector3): Vector3` (existing): Update implementation to depend on `ShipComponent.velocity` with zero fallback.
- No signature changes; external callers continue to receive the populated `out` vector.

## Data Models

- `ShipComponent.velocity` remains the canonical mutable vector maintained by the motion system. No schema changes required, but tests that previously relied on mocked `linvel` must now seed this vector directly.

## Error Handling Matrix

| Scenario | Detection | Response |
| --- | --- | --- |
| Ship has no `ship` component (legacy harness) | `ship.ship` undefined | Return zero vector; callers already guard for absent targets |
| `ShipComponent.velocity` missing or null | Nullish check | Write zeros and return without Rapier access |
| Velocity contains NaN/Infinity due to upstream bug | `Number.isFinite` checks per axis | Clamp to zero to avoid propagating invalid math |
| Out vector reused with same reference | Helper mutates provided vector | Safe; copies values each call |

## Testing Strategy

- Extend `test/vitest/ai-intercept.spec.ts` to seed interceptor/target `ShipComponent.velocity` vectors and verify intercept lead calculations respect the stored velocities while the mocked `linvel` spy remains untouched.
- Add a regression covering the missing-velocity case (ship lacks velocity vector) to confirm the helper returns zero without invoking the Rapier stub.
- Run `npm run typecheck` and `npm test` after implementation.

## Implementation Notes

- Update test helpers (`createShip`) to populate `ShipComponent.velocity` when constructing moving targets.
- Remove any unused Rapier-specific temp structures if they become obsolete; keep `TEMP_TARGET_VEL`, etc., for copies.
- Consider adding a tiny helper inside the spec to assert Rapier spy calls remain at zero to prevent regressions.
