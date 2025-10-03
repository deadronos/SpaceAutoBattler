import { Quaternion, Vector3 } from 'three';
import type {
  GameState,
  ShipBlueprint,
  ShipEntity,
  TurretState,
  TurretEntity,
} from '../types/index.js';
import { SHIP_STATS } from '../data/shipStats.js';
import { createInitialAIState } from './aiState.js';
import { registerTurret } from './turretRegistry.js';
import { CARRIER_LAUNCH_CONFIG } from '../config/carriers.js';
import { AI_CONFIG } from './config.js';
import { SeededRng } from '../utils/rng.js';
import { calculateXpForLevel } from '../config/progression.js';
import { generateCaptain, createSubsystems, createLevelBonusState } from './progression.js';

/**
 * Apply range variance based on range policy and ship's trait seed.
 * Provides ±5% variance to weapon ranges when rangePolicy is 'v0.1.1-exp'.
 */
function applyRangeVariance(baseRange: number, traitSeed: number, weaponIndex = 0): number {
  if (AI_CONFIG.rangePolicy !== 'v0.1.1-exp') return baseRange;
  
  // Create a deterministic seed combining traitSeed and weapon index for consistency
  const rangeSeed = Math.abs((traitSeed ^ (weaponIndex * 7919)) >>> 0) || 1;
  const rng = new SeededRng(rangeSeed);
  
  // Apply ±5% variance
  const variance = 0.05;
  const modifier = 1 + (rng.next() * 2 - 1) * variance;
  
  return Math.round(baseRange * modifier);
}

export function spawnShip(state: GameState, blueprint: ShipBlueprint): ShipEntity {
  const stats = SHIP_STATS[blueprint.hull];
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), blueprint.heading);
  const position = blueprint.position.clone();

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(position.x, position.y, position.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  const body = state.physicsWorld.createRigidBody(bodyDesc);

  const colliderDesc = state.rapier.ColliderDesc.capsule(0.8, 0.6)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

  const aiState = createInitialAIState(state, blueprint.hull);
  
  const entity: ShipEntity = {
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position,
      rotation,
      scale: stats.scale,
    },
    ship: {
      team: blueprint.team,
      hull: blueprint.hull,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: stats.maxShield ?? Math.round(stats.maxHp * 0.6),
      maxShield: stats.maxShield ?? Math.round(stats.maxHp * 0.6),
      shieldRegen: stats.shieldRegen ?? 0,
      cooldown: stats.fireRate * state.rng.next(),
      fireRate: stats.fireRate,
      damage: stats.damage,
      projectileSpeed: stats.projectileSpeed,
      range: applyRangeVariance(stats.range, aiState.traitSeed, 0),
      speed: stats.speed,
      bulletType: stats.bulletType,
      parentCarrierId: blueprint.parentCarrierId,
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: stats.motion,
      
      xp: 0,
      level: 1,
      xpToNext: calculateXpForLevel(2),
      damageType: stats.damageType,
      levelBonuses: createLevelBonusState(),
      captain: generateCaptain(blueprint.hull, aiState.traitSeed + 1000),
      subsystems: createSubsystems(stats.maxHp),
      armor: stats.armor,
    },
    model: blueprint.hull,
    shieldRipples: [],
    turrets: (stats.turrets ?? []).map<TurretState>((t, idx) => ({
      offset: t.offset.clone(),
      damage: t.damage,
      fireRate: t.fireRate,
      projectileSpeed: t.projectileSpeed,
      range: applyRangeVariance(t.range, aiState.traitSeed, idx + 1),
      bulletType: t.bulletType,
      cooldown: t.fireRate * state.rng.next(),
    })),
    ai: aiState,
  };

  if (blueprint.hull === 'carrier') {
    entity.carrier = {
      launchCooldownRemaining: 0,
      activeFighterIds: [],
      launchIndex: 0,
      config: CARRIER_LAUNCH_CONFIG,
    };
  }

  const registered = state.world.add(entity) as ShipEntity;
  state.colliderLookup.set(collider.handle, registered);

  const turretSpecs = stats.turrets ?? [];
  turretSpecs.forEach((spec, idx) => {
    const tBodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    const tBody = state.physicsWorld.createRigidBody(tBodyDesc);
    const tColliderDesc = state.rapier.ColliderDesc.ball(0.05)
      .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
      .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL)
      .setSensor(true as unknown as boolean);
    const tCollider = state.physicsWorld.createCollider(tColliderDesc, tBody);

    const turretEntity = state.world.add({
      id: state.nextEntityId++,
      rigidBody: tBody,
      collider: tCollider,
      transform: {
        position: position.clone(),
        rotation: rotation.clone(),
        scale: 1,
      },
      turret: {
        parent: registered,
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
    state.colliderLookup.set(tCollider.handle, turretEntity);
    try {
      registerTurret(state, registered.id, turretEntity);
    } catch {
      // defensive: ignore map issues
    }
  });
  return registered;
}

export { SHIP_STATS } from '../data/shipStats.js';
export { createDefaultMotionStats } from '../utils/motionUtils.js';
