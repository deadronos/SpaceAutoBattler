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

    // Update beam position and direction to follow source ship/turret
    if (beam.beamVisual.sourceId != null) {
      const source = ships.find((ship) => ship.id === beam.beamVisual.sourceId);
      if (!source) {
        // Source ship destroyed, remove beam
        toRemove.push(beam);
        continue;
      }

      let worldOrigin: Vector3 | null = null;
      let usedShipCenterFallback = false;

      const localOrigin = beam.beamVisual.localOrigin;
      if (
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

      // Update direction
      let worldDirection: Vector3 | null = null;

      const localDirection = beam.beamVisual.localDirection;
      if (
        localDirection &&
        Number.isFinite(localDirection.x) &&
        Number.isFinite(localDirection.y) &&
        Number.isFinite(localDirection.z) &&
        localDirection.lengthSq() > 1e-6
      ) {
        worldDirection = TEMP_BEAM_DIR.copy(localDirection)
          .applyQuaternion(source.transform.rotation)
          .normalize();
      }

      if (!worldDirection && beam.beamVisual.sourceTurretId != null) {
        const turret = turrets.find((t) => t.id === beam.beamVisual.sourceTurretId);
        if (turret?.direction && turret.direction.lengthSq() > 1e-6) {
          worldDirection = TEMP_BEAM_DIR.copy(turret.direction).normalize();
        } else if (turret?.turret?.aimDirection && turret.turret.aimDirection.lengthSq() > 1e-6) {
          worldDirection = TEMP_BEAM_DIR.copy(turret.turret.aimDirection).normalize();
        }
      }

      if (!worldDirection && beam.beamVisual.sourceTurretIndex != null) {
        const embedded = source.turrets?.[beam.beamVisual.sourceTurretIndex];
        if (embedded?.aimDirection && embedded.aimDirection.lengthSq() > 1e-6) {
          worldDirection = TEMP_BEAM_DIR.copy(embedded.aimDirection).normalize();
        }
      }

      if (!worldDirection) {
        // Use ship's forward direction
        worldDirection = TEMP_BEAM_DIR.set(0, 0, 1)
          .applyQuaternion(source.transform.rotation)
          .normalize();
      }

      if (worldDirection) {
        beam.direction.copy(worldDirection);
        beam.transform.rotation.setFromUnitVectors(FORWARD, worldDirection);
      }

      // If we used ship center fallback, nudge origin forward to approximate a muzzle
      if (usedShipCenterFallback && worldDirection) {
        const muzzleOffset = source.transform.scale * 1.6;
        worldOrigin.addScaledVector(worldDirection, muzzleOffset);
      }

      clampToWorld(worldOrigin);
      beam.transform.position.copy(worldOrigin);
    }
  }

  for (const beam of toRemove) {
    destroyEntity(state, beam);
  }
}
