# TASK251 — Beam Visual Alignment Design

**Status:** Draft  
**Author:** Codex (GPT-5)  
**Updated:** 2025-10-15

## 1. Summary

Beam visuals currently drift away from their firing ships and close-range impacts appear invisible. The fix is to persist local-space muzzle metadata at spawn time, reconstruct world transforms deterministically every frame, and guarantee a minimum visible beam length without exceeding configured ranges. The scope touches projectile spawning (`fireProjectile`), the beam visuals system, renderer instancing, and shared combat types.

## 2. Requirements Traceability

| Requirement | Design Hook | Notes |
| ----------- | ----------- | ----- |
| R1 – Store local muzzle metadata on spawn | §3.2 | New `localOrigin` / `localDirection` fields added to `BeamVisualComponent` and populated in `fireProjectile`. |
| R2 – Rebuild world transform each tick | §3.3 | `advanceBeamVisuals` prioritises stored local metadata, falling back to turret/world cues. |
| R3 – Clamp visible beam length | §4.2 | Renderer enforces `minVisibleLength` derived from width/config while respecting `maxLength`. |
| R4 – Remove orphan beams immediately | §3.3 | Existing removal retained; additional logging ensures immediate teardown when metadata invalid or source missing. |

## 3. Architecture & Data Flow

### 3.1 Component relationships

```
ShipEntity ─fireProjectile─► BeamVisualEntity
   │                             │
   │ stores local origin/dir     │ consumed by
   ▼                             ▼
AdvanceBeamVisuals ─updates─► BeamVisualsInstancedLayer ─renders─► Scene
```

### 3.2 Spawn pipeline updates (`fireProjectile`)

- Compute inverse rotation of the firing ship once per beam shot (`TEMP_INV_ROT` reused).
- Derive `localOrigin = (startPosition - ship.position)` transformed into ship-local space and divided by ship scale (mirrors projectile bookkeeping).
- Derive `localDirection = direction` rotated into ship-local space and normalised.
- Persist both vectors on the new `beamVisual` component; shallow clones ensure ECS mutation safety.
- Preserve existing fields (`team`, `ttl`, `length`, `maxLength`, `sourceId`, turret metadata).

### 3.3 Runtime transform reconstruction (`advanceBeamVisuals`)

Priority order when updating each beam per tick:

1. Look up the source ship via `sourceId`. If absent, mark for destruction (R4).
2. If the beam retained `localOrigin`, reconstruct world origin as:<br/>
   `worldOrigin = ship.position + ship.rotation * (localOrigin * ship.scale)`.
3. Otherwise, fall back to turret world transforms (`sourceTurretId` / embedded `sourceTurretIndex`), then to ship centre + muzzle offset as today.
4. If the beam retained `localDirection`, rotate by ship rotation and normalise to get `worldDirection`.<br/>
   Fallback to turret direction → embedded aim → ship forward when metadata missing.
5. Update `beam.direction`, `beam.transform.rotation`, and `beam.transform.position` from the computed values.
6. Clamp position with `clampToWorld` post reconstruction.
7. Maintain TTL decrement/removal path.

This keeps beams welded to moving/rotating sources for the duration of their TTL even when no turret entity exists.

## 4. Renderer adjustments

### 4.1 Instance transform usage

`BeamVisualsInstancedLayer` already composes matrices from `beam.transform.position` and `beam.transform.rotation`. With §3 updates the origin will now follow the source reliably.

### 4.2 Minimum visible length

- Introduce `const MIN_VISIBLE_LENGTH = 0.75;` (tunable) and compute `minLength = Math.max(MIN_VISIBLE_LENGTH, beam.beamVisual.width * 0.6)`.  
- Effective render length becomes `Math.min(Math.max(rawLength, minLength), beam.beamVisual.maxLength)`.  
- Matrix composition retains start-at-origin semantics; the extra 0.3–0.5 units covers immediate hits without significantly overshooting the contact point.
- Store the clamped length on the temp scale vector; renderer offset continues to use the clamped length (ensures consistent transform math).
- Add fallback for negative/NaN lengths.

## 5. Interfaces & Data Model Changes

- `BeamVisualComponent` (src/types/combat.ts): add optional `localOrigin?: Vector3` and `localDirection?: Vector3`. Update re-export in `src/types/index.ts` automatically via type file change.
- No external API signature changes; internal systems/tests must account for new optional fields.

## 6. Error Handling Matrix

| Scenario | Detection | Response | Notes |
| -------- | --------- | -------- | ----- |
| Source ship entity missing | `ships.find` returns `undefined` | Destroy beam immediately via `destroyEntity` | Existing logic retained; ensures R4. |
| Stored local metadata malformed (NaN / zero vectors) | Validation in `advanceBeamVisuals` (length/`lengthSq` checks) | Discard metadata and fall back to turret/ship derived vectors; log debug warning (guarded) | Prevents propagation of invalid transforms. |
| Turret lookup fails despite metadata | Null checks already in place | Fall back to stored local metadata or ship centre | Keeps visuals alive even if turret entity despawns first. |
| Rendered length underflows/NaN | Guard before scaling | Use `minLength` fallback and reset brightness to default | Prevents invisible or stretched instances. |
| Attribute allocation saturation | Existing saturation warning | No change | Out of scope but verified unchanged. |

## 7. Testing Strategy

1. **System unit test**: spawn beam, move ship before calling `advanceBeamVisuals`, assert beam position rotates/translates with ship (tolerance ≤ 0.25 units).  
2. **System removal test**: remove source ship prior to advance, expect beam to be destroyed in one tick.  
3. **Renderer util test**: inject beam entity with `length < MIN_VISIBLE_LENGTH`, run layer update once, and assert Z scale equals the clamped minimum while matrix origin remains close to `transform.position`.  
4. **Spawn metadata regression**: verify new fields exist on spawned beam and match precomputed expectations (local origin pointing down forward axis, direction `(0,0,1)`).  
5. **Existing suites**: run `npx tsc --noEmit` plus targeted Vitest files (`projectile-behaviours.spec.ts`, new `beam-visuals.system.spec.ts`, and renderer layer spec). Consider a narrow Playwright smoke if time permits (optional).

## 8. Implementation Steps (mirrors task plan)

1. Update combat types and projectile spawn logic with local metadata capture.  
2. Refactor `advanceBeamVisuals` to prioritise metadata reconstruction and clamp fallback paths.  
3. Adjust instanced renderer length clamp and add guards for invalid data.  
4. Author new Vitest specs for spawn metadata, system alignment, and renderer clamping.  
5. Run validations (`npx tsc --noEmit`, `npm test -- beam-visuals`).  
6. Document outcomes (task file, progress log, potential PR notes if behaviour change observed).

## 9. Risks & Mitigations

- **Risk**: Additional vector math per beam raises CPU cost. Mitigation: reuse temp vectors and early-return when metadata already matches; TTL remains low (≤0.45s) keeping entity count modest.  
- **Risk**: Clamping length may visually overshoot close-range impacts. Mitigation: keep threshold small (≤1 unit) and add TODO for fine tuning if QA feedback arises.  
- **Risk**: Tests may need new helpers for comparing vectors with tolerance. Mitigation: add small utility inside spec or reuse existing epsilon comparisons.

## 10. Follow-ups

- Evaluate adding beam impact decals/sparks once alignment is stable.  
- Consider exposing min beam length as config if balancing feedback demands tuning.
