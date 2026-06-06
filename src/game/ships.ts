import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipBlueprint, ShipEntity } from '../types/index.js';
import { SHIP_STATS } from '../data/shipStats.js';
import { createInitialAIState } from './aiState.js';
import { CARRIER_LAUNCH_CONFIG } from '../config/carriers.js';
import { calculateXpForLevel } from '../config/progression.js';
import { generateCaptain, createSubsystems, createLevelBonusState } from './progression.js';
import { createKinematicBodyWithCollider, registerColliderHandle } from './utils/physicsFactory.js';
import { applyRangeVariance } from './utils/rangePolicy.js';
import { createTurretEntities } from './turretFactory.js';

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
  state.shipById.set(registered.id, registered);
  registerColliderHandle(state, collider, registered);

  const turretSpecs = stats.turrets ?? [];
  if (turretSpecs.length > 0) {
    createTurretEntities(state, registered, turretSpecs, position, rotation);
  }

  return registered;
}

export { SHIP_STATS } from '../data/shipStats.js';
export { createDefaultMotionStats } from '../utils/motionUtils.js';
