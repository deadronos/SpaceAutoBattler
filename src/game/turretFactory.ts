import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, TurretEntity } from '../types/index.js';
import type { TurretSpec } from '../types/combat.js';
import { registerTurret } from './turretRegistry.js';
import { createKinematicBodyWithCollider, registerColliderHandle } from './utils/physicsFactory.js';
import { reportLifecycleError } from '../utils/errorReporting.js';

/**
 * Creates turret ECS entities for a newly-spawned ship.
 *
 * @param state - The game state.
 * @param parent - The parent ship entity.
 * @param turretSpecs - Turret specifications from the ship's hull stats.
 * @param parentPosition - The parent ship's world position.
 * @param parentRotation - The parent ship's world rotation.
 */
export function createTurretEntities(
  state: GameState,
  parent: ShipEntity,
  turretSpecs: readonly TurretSpec[],
  parentPosition: Vector3,
  parentRotation: Quaternion,
): TurretEntity[] {
  const turrets: TurretEntity[] = [];

  turretSpecs.forEach((spec, idx) => {
    const { body: tBody, collider: tCollider } = createKinematicBodyWithCollider(state, {
      position: parentPosition,
      rotation: parentRotation,
      collider: { type: 'ball', radius: 0.05 },
      sensor: true,
    });

    const turretEntity = state.world.add({
      id: state.nextEntityId++,
      rigidBody: tBody,
      collider: tCollider,
      transform: {
        position: parentPosition.clone(),
        rotation: parentRotation.clone(),
        scale: 1,
      },
      turret: {
        parent,
        offset: spec.offset.clone(),
        damage: spec.damage,
        fireRate: spec.fireRate,
        projectileSpeed: spec.projectileSpeed,
        range: spec.range,
        bulletType: spec.bulletType,
        cooldown: spec.fireRate * state.rng.next(),
        index: idx,
        yaw: 0,
        pitch: 0,
        minYaw: spec.minYaw ?? -Math.PI * 0.9,
        maxYaw: spec.maxYaw ?? Math.PI * 0.9,
        minPitch: spec.minPitch ?? -Math.PI * 0.25,
        maxPitch: spec.maxPitch ?? Math.PI * 0.5,
        priority: spec.priority ?? 'any',
      },
    }) as TurretEntity;

    registerColliderHandle(state, tCollider, turretEntity);
    try {
      registerTurret(state, parent.id, turretEntity);
    } catch (error) {
      reportLifecycleError('create', 'TurretRegistry', parent.id, error);
    }

    turrets.push(turretEntity);
  });

  return turrets;
}
