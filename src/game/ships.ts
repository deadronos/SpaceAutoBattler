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
import { calculateXpForLevel } from '../config/progression.js';
import { generateCaptain, createSubsystems, createLevelBonusState } from './progression.js';
import { createKinematicBodyWithCollider, registerColliderHandle } from './utils/physicsFactory.js';
import { applyRangeVariance } from './utils/rangePolicy.js';

export function spawnShip(state: GameState, blueprint: ShipBlueprint): ShipEntity {
  const stats = SHIP_STATS[blueprint.hull];
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), blueprint.heading);
  const position = blueprint.position.clone();

  const { body, collider } = createKinematicBodyWithCollider(state, {
    position,
    rotation,
    collider: { type: 'capsule', halfHeight: 0.8, radius: 0.6 },
    ccd: stats.motion.visual?.enableCcd ?? false,
  });

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
      sensor: { ...stats.sensor },
      stealth: stats.stealth ?? 0,
      sensorSignature: stats.sensorSignature ?? 1,

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
  registerColliderHandle(state, collider, registered);

  const turretSpecs = stats.turrets ?? [];
  turretSpecs.forEach((spec, idx) => {
    const { body: tBody, collider: tCollider } = createKinematicBodyWithCollider(state, {
      position,
      rotation,
      collider: { type: 'ball', radius: 0.05 },
      sensor: true,
    });

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
    registerColliderHandle(state, tCollider, turretEntity);
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
