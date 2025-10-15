import { Vector3 } from 'three';
import type { GameState, BeamVisualEntity, ShipEntity, TurretEntity } from '../../types/index.js';
import { clampToWorld } from '../config.js';
import { destroyEntity } from '../state.js';

const TEMP_BEAM_ORIGIN = new Vector3();
const TEMP_BEAM_DIR = new Vector3();
const FORWARD = new Vector3(0, 0, 1);

/**
 * Advances beam visual entities each frame, updating their positions and directions
 * to follow their source ship/turret and expiring them when TTL reaches zero.
 */
export function advanceBeamVisuals(state: GameState, delta: number): void {
  const beamVisuals = state.queries.beamVisuals.entities as BeamVisualEntity[];
  const ships = state.queries.ships.entities as ShipEntity[];
  const turrets = state.queries.turrets.entities as TurretEntity[];
  const toRemove: BeamVisualEntity[] = [];

  for (const beam of beamVisuals) {
    beam.beamVisual.ttl -= delta;
    if (beam.beamVisual.ttl <= 0) {
      toRemove.push(beam);
      continue;
    }

    // Update beam position and direction to follow source ship translation while
    // keeping the original firing orientation stable.
    if (beam.beamVisual.sourceId != null) {
      const source = ships.find((ship) => ship.id === beam.beamVisual.sourceId);
      if (!source) {
        // Source ship destroyed, remove beam
        toRemove.push(beam);
        continue;
      }

      let worldOrigin: Vector3 | null = null;
      let usedShipCenterFallback = false;

      const worldOffset = beam.beamVisual.worldOffset;
      if (
        worldOffset &&
        Number.isFinite(worldOffset.x) &&
        Number.isFinite(worldOffset.y) &&
        Number.isFinite(worldOffset.z)
      ) {
        worldOrigin = TEMP_BEAM_ORIGIN.copy(source.transform.position).add(worldOffset);
      }

      const localOrigin = beam.beamVisual.localOrigin;
      if (
        !worldOrigin &&
        localOrigin &&
        Number.isFinite(localOrigin.x) &&
        Number.isFinite(localOrigin.y) &&
        Number.isFinite(localOrigin.z)
      ) {
        worldOrigin = TEMP_BEAM_ORIGIN.copy(localOrigin)
          .multiplyScalar(source.transform.scale)
          .applyQuaternion(source.transform.rotation)
          .add(source.transform.position);
      }

      // Try turret entity if local metadata unavailable
      if (!worldOrigin && beam.beamVisual.sourceTurretId != null) {
        const turret = turrets.find((t) => t.id === beam.beamVisual.sourceTurretId);
        if (turret) {
          worldOrigin = TEMP_BEAM_ORIGIN.copy(turret.transform.position);
        }
      }

      // Try embedded turret next
      if (!worldOrigin && beam.beamVisual.sourceTurretIndex != null) {
        const embedded = source.turrets?.[beam.beamVisual.sourceTurretIndex];
        if (embedded) {
          worldOrigin = TEMP_BEAM_ORIGIN.copy(embedded.offset)
            .multiplyScalar(source.transform.scale)
            .applyQuaternion(source.transform.rotation)
            .add(source.transform.position);
        }
      }

      // Fallback to ship position; mark so we can nudge to muzzle after we know direction
      if (!worldOrigin) {
        worldOrigin = TEMP_BEAM_ORIGIN.copy(source.transform.position);
        usedShipCenterFallback = true;
      }

      // Resolve the firing direction once; preserve it across frames.
      const existingDirection = beam.direction;
      const hasExistingDirection = existingDirection.lengthSq() > 1e-6;
      let resolvedDirection: Vector3 | null = null;

      if (hasExistingDirection) {
        resolvedDirection = TEMP_BEAM_DIR.copy(existingDirection);
        if (resolvedDirection.lengthSq() > 1e-6) {
          resolvedDirection.normalize();
        } else {
          resolvedDirection = null;
        }
      }

      if (!resolvedDirection) {
        const localDirection = beam.beamVisual.localDirection;
        if (
          localDirection &&
          Number.isFinite(localDirection.x) &&
          Number.isFinite(localDirection.y) &&
          Number.isFinite(localDirection.z) &&
          localDirection.lengthSq() > 1e-6
        ) {
          resolvedDirection = TEMP_BEAM_DIR.copy(localDirection)
            .applyQuaternion(source.transform.rotation)
            .normalize();
        }
      }

      if (!resolvedDirection && beam.beamVisual.sourceTurretId != null) {
        const turret = turrets.find((t) => t.id === beam.beamVisual.sourceTurretId);
        const turretDirection =
          turret?.direction && turret.direction.lengthSq() > 1e-6
            ? turret.direction
            : turret?.turret?.aimDirection && turret.turret.aimDirection.lengthSq() > 1e-6
              ? turret.turret.aimDirection
              : null;
        if (turretDirection) {
          resolvedDirection = TEMP_BEAM_DIR.copy(turretDirection).normalize();
        }
      }

      if (!resolvedDirection && beam.beamVisual.sourceTurretIndex != null) {
        const embedded = source.turrets?.[beam.beamVisual.sourceTurretIndex];
        if (embedded?.aimDirection && embedded.aimDirection.lengthSq() > 1e-6) {
          resolvedDirection = TEMP_BEAM_DIR.copy(embedded.aimDirection).normalize();
        }
      }

      if (!resolvedDirection) {
        // Use ship's forward direction as a final fallback.
        resolvedDirection = TEMP_BEAM_DIR.set(0, 0, 1)
          .applyQuaternion(source.transform.rotation)
          .normalize();
      }

      if (resolvedDirection) {
        existingDirection.copy(resolvedDirection);
        beam.transform.rotation.setFromUnitVectors(FORWARD, resolvedDirection);
      }

      // If we used ship center fallback, nudge origin forward to approximate a muzzle
      if (usedShipCenterFallback && resolvedDirection) {
        const muzzleOffset = source.transform.scale * 1.6;
        worldOrigin.addScaledVector(resolvedDirection, muzzleOffset);
      }

      clampToWorld(worldOrigin);
      beam.transform.position.copy(worldOrigin);
    }
  }

  for (const beam of toRemove) {
    destroyEntity(state, beam);
  }
}
