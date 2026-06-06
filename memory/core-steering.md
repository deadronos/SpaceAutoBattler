# Memory — core-steering

File: `src/utils/steering.ts`
Related: TASK161 (steering helpers, torpedo homing, point defense)

Summary

- Canonical vector/rotation helpers for AI motion, projectile orientation, and combat steering. All functions are pure, allocation-free in the hot path, and operate on caller-provided `Vector3` / `Quaternion` outputs.
- Conventions:
  - `FORWARD = (0, 0, 1)` — matches the asset/scene convention used by ship GLTFs and projectile meshes.
  - `DEFAULT_FALLBACK = (0, 0, 1)` — when a vector is too short to normalise, helpers fall back to this direction rather than producing NaN.
  - All `compute*Direction` helpers accept a caller-owned `out: Vector3` so they can be called thousands of times per frame without allocating.

Primary exports

| Helper                                                                                          | Purpose                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safeNormalize(dst, src, fallback?)`                                                            | Length-sq gate (`1e-12`) before normalising; falls back to `FORWARD` (or supplied vector) for degenerate inputs.                                                          |
| `orientQuaternionFromDirection(direction, fallbackDirection?, target?)`                         | Build a `Quaternion` that rotates `FORWARD` to the given direction; resets to identity when the result is non-finite. Used to align projectiles, beams, and ship visuals. |
| `computeLeadDirection(targetPos, sourcePos, targetVelocity, leadFactor?, out?)`                 | Linear lead target — adds a fraction of the target velocity to the seek vector and renormalises.                                                                          |
| `computeSeekDirection(targetPos, sourcePos, out?, fallback?)`                                   | Plain seek toward a static point.                                                                                                                                         |
| `computeArriveDirection(targetPos, sourcePos, slowRadius, stopRadius?, out?, fallback?)`        | Returns `{ direction, speedScale, distance }`; speed ramps from 1 to 0 between `slowRadius` and `stopRadius`.                                                             |
| `computeInterceptDirection(targetPos, sourcePos, targetVelocity, sourceSpeed, out?, fallback?)` | Quadratic intercept via `solveInterceptQuadratic` (`src/utils/math.ts`); falls back to seek when no real positive root exists.                                            |
| `computeEvadeDirection(threatPos, sourcePos, threatVelocity, sourceSpeed, out?, fallback?)`     | Reuses `computeInterceptDirection` and flips the result.                                                                                                                  |

Allocation discipline

- Module-scope `TEMP_*` scratch vectors (`TEMP_DIR`, `TEMP_LEAD`, `TEMP_SEEK`, `TEMP_INTERCEPT`, `TEMP_INTERCEPT_TARGET`) are reused across calls. Callers must not retain references past the call site.
- Callers should pass the `out` vector they intend to store the result in; only `orientQuaternionFromDirection` and the lead/seek helpers default-construct when no `out` is provided.

Determinism

- All math is deterministic for the same input sequence (no `Math.random`, no branching on `Object.is`-only checks). Outputs depend only on caller-supplied values.
- Combined with `SeededRng` (`src/utils/rng.ts`), the helpers make AI steering output reproducible across runs.

Where it is used

- `src/game/systems/decision/*` (intent selection, intercept lead, flee paths).
- `src/game/systems/projectiles/{spawn,advance,homing}.ts` (projectile orientation, lead targeting).
- `src/game/systems/motion/*` (angular damping integration in `motion/index.ts`).
- `src/renderer/*` (visual transform alignment for projectile meshes, beam quaternions).

Tests

- `test/vitest/steering.spec.ts` covers safe normalisation, lead scaling, arrive `speedScale`, intercept success/failure, and evade direction.
- `test/vitest/turret-priority.spec.ts` and `test/vitest/point-defense-turret.spec.ts` cover the projectile-side consumers of these helpers.

References

- `src/utils/steering.ts`
- `src/utils/math.ts` (`solveInterceptQuadratic`, `clamp`)
- TASK161: Steering helpers, torpedo homing, point defense targeting
