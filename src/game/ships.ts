import { Quaternion, Vector3 } from 'three';
import type {
  AIState,
  GameState,
  MotionStats,
  ShipBlueprint,
  ShipEntity,
  ShipHull,
  ShipStats,
  TurretState,
  TurretEntity,
} from '../types/index.js';
import { registerTurret } from './turretRegistry.js';
import { getDefaultProfileId } from './aiProfiles.js';
import { generateTraitsFromSeed } from './aiTraits.js';
import { validateMotionStats } from './validation.js';
import { CARRIER_LAUNCH_CONFIG } from '../config/carriers.js';
import { AI_CONFIG } from './config.js';
import { SeededRng } from '../utils/rng.js';

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
  const modifier = 1 + (rng.next() * 2 - 1) * variance; // [-5%, +5%]
  
  return Math.round(baseRange * modifier);
}

/** Create default motion stats for testing and fallback scenarios. */
export function createDefaultMotionStats(): MotionStats {
  const stats: MotionStats = {
    mass: 1.0,
    maxSpeed: 10,
    maxReverseSpeed: 3,
    linearAcceleration: 20,
    linearDamping: 2.0,
    maxTurnRate: Math.PI,
    angularAcceleration: Math.PI * 2,
    angularDamping: 5.0,
    maxLateralAcceleration: 8,
    visualBankFactor: 16,
    maxBankDeg: 28,
    smoothing: {
      positionLerp: 0.18,
      rotationSlerp: 0.22,
      bankLerp: 0.18,
      teleportDistance: 40,
    },
  };
  validateMotionStats(stats);
  return stats;
}

export const SHIP_STATS: Record<ShipHull, ShipStats> = {
  fighter: {
    hull: 'fighter',
    maxHp: 40,
    maxShield: 24,
    // hp per second
    shieldRegen: 4.0,
    damage: 8,
    fireRate: 0.9,
    projectileSpeed: 80,
    range: 220,
    speed: 40,
    scale: 1,
    bulletType: 'bullet:laser',
    turrets: [],
    motion: {
      mass: 1.0,
      maxSpeed: 40, // units/s - matches legacy speed
      maxReverseSpeed: 5,
      linearAcceleration: 34, // units/s² - high acceleration for agility
      linearDamping: 3.0, // moderate damping
      maxTurnRate: Math.PI * 1.5, // rad/s - very agile turning (270°/s)
      angularAcceleration: Math.PI * 4, // rad/s² - fast turn acceleration
      angularDamping: 8.0, // high damping for responsive turning
      maxLateralAcceleration: 12, // units/s² - good strafe ability
      visualBankFactor: 20,
      maxBankDeg: 35,
      smoothing: {
        positionLerp: 0.2,
        rotationSlerp: 0.28,
        bankLerp: 0.2,
        teleportDistance: 35,
      },
    },
  },
  corvette: {
    hull: 'corvette',
    maxHp: 75,
    maxShield: 45,
    shieldRegen: 5.0,
    damage: 12,
    fireRate: 1.2,
    projectileSpeed: 80,
    range: 220,
    speed: 15,
    scale: 1,
    bulletType: 'bullet:plasma',
    motion: {
      mass: 1.5,
      maxSpeed: 15, // units/s - matches legacy speed
      maxReverseSpeed: 4,
      linearAcceleration: 20, // units/s² - good acceleration
      linearDamping: 2.5, // moderate damping
      maxTurnRate: Math.PI * 1.2, // rad/s - good turning (216°/s)
      angularAcceleration: Math.PI * 3.2, // rad/s² - solid turn acceleration
      angularDamping: 6.5, // good damping
      maxLateralAcceleration: 9, // units/s² - decent strafe
      visualBankFactor: 16,
      maxBankDeg: 30,
      smoothing: {
        positionLerp: 0.18,
        rotationSlerp: 0.24,
        bankLerp: 0.18,
        teleportDistance: 38,
      },
    },
    turrets: [
      {
        offset: new Vector3(0.9, 0.2, 0.1),
        damage: 6,
        fireRate: 1.0,
        projectileSpeed: 80,
        range: 220,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.6,
        maxYaw: Math.PI * 0.6,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.4,
        priority: 'antiFighter',
      },
      {
        offset: new Vector3(-0.9, 0.2, 0.1),
        damage: 6,
        fireRate: 1.0,
        projectileSpeed: 80,
        range: 220,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.6,
        maxYaw: Math.PI * 0.6,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.4,
        priority: 'antiFighter',
      },
    ],
  },
  frigate: {
    hull: 'frigate',
    maxHp: 120,
    maxShield: 72,
    shieldRegen: 7.0,
    damage: 16,
    fireRate: 1.5,
    projectileSpeed: 80,
    range: 260,
    speed: 12,
    scale: 1,
    bulletType: 'bullet:plasma',
    motion: {
      mass: 2.5,
      maxSpeed: 12, // units/s - matches legacy speed
      maxReverseSpeed: 3,
      linearAcceleration: 15, // units/s² - moderate acceleration
      linearDamping: 2.0, // less damping for heavier ship
      maxTurnRate: Math.PI * 0.9, // rad/s - slower turning (162°/s)
      angularAcceleration: Math.PI * 2.4, // rad/s² - moderate turn acceleration
      angularDamping: 5.0, // moderate damping
      maxLateralAcceleration: 6, // units/s² - limited strafe
      visualBankFactor: 12,
      maxBankDeg: 26,
      smoothing: {
        positionLerp: 0.16,
        rotationSlerp: 0.22,
        bankLerp: 0.16,
        teleportDistance: 40,
      },
    },
    turrets: [
      {
        offset: new Vector3(1.2, 0.25, 0.0),
        damage: 8,
        fireRate: 1.2,
        projectileSpeed: 50,
        range: 260,
        bulletType: 'bullet:plasma',
        minYaw: -Math.PI * 0.5,
        maxYaw: Math.PI * 0.5,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.5,
        priority: 'any',
      },
      {
        offset: new Vector3(-1.2, 0.25, 0.0),
        damage: 8,
        fireRate: 1.2,
        projectileSpeed: 50,
        range: 260,
        bulletType: 'bullet:plasma',
        minYaw: -Math.PI * 0.5,
        maxYaw: Math.PI * 0.5,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.5,
        priority: 'any',
      },
      {
        offset: new Vector3(0.0, 0.25, -0.8),
        damage: 8,
        fireRate: 1.2,
        projectileSpeed: 80,
        range: 260,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.9,
        maxYaw: Math.PI * 0.9,
        minPitch: -Math.PI * 0.3,
        maxPitch: Math.PI * 0.4,
        priority: 'antiFighter',
      },
    ],
  },
  destroyer: {
    hull: 'destroyer',
    maxHp: 200,
    maxShield: 120,
    shieldRegen: 8.0,
    damage: 22,
    fireRate: 1.8,
    projectileSpeed: 50,
    range: 400,
    speed: 10,
    scale: 1,
    bulletType: 'bullet:heavy',
    motion: {
      mass: 4.0,
      maxSpeed: 10, // units/s - matches legacy speed
      maxReverseSpeed: 2.5,
      linearAcceleration: 10, // units/s² - slower acceleration
      linearDamping: 1.5, // low damping for heavy ship
      maxTurnRate: Math.PI * 0.6, // rad/s - slow turning (108°/s)
      angularAcceleration: Math.PI * 1.8, // rad/s² - slow turn acceleration
      angularDamping: 4.0, // moderate damping
      maxLateralAcceleration: 4, // units/s² - poor strafe
      visualBankFactor: 10,
      maxBankDeg: 22,
      smoothing: {
        positionLerp: 0.14,
        rotationSlerp: 0.18,
        bankLerp: 0.14,
        teleportDistance: 42,
      },
    },
    turrets: [
      {
        offset: new Vector3(1.6, 0.3, -0.2),
        damage: 10,
        fireRate: 1.4,
        projectileSpeed: 50,
        range: 380,
        bulletType: 'bullet:plasma',
        minYaw: -Math.PI * 0.6,
        maxYaw: Math.PI * 0.6,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.4,
        priority: 'antiCapital',
      },
      {
        offset: new Vector3(-1.6, 0.3, -0.2),
        damage: 10,
        fireRate: 1.4,
        projectileSpeed: 50,
        range: 380,
        bulletType: 'bullet:plasma',
        minYaw: -Math.PI * 0.6,
        maxYaw: Math.PI * 0.6,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.4,
        priority: 'antiCapital',
      },
      {
        offset: new Vector3(0.9, 0.3, 0.6),
        damage: 10,
        fireRate: 1.6,
        projectileSpeed: 80,
        range: 360,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.7,
        maxYaw: Math.PI * 0.7,
        minPitch: -Math.PI * 0.25,
        maxPitch: Math.PI * 0.45,
        priority: 'antiFighter',
      },
      {
        offset: new Vector3(-0.9, 0.3, 0.6),
        damage: 10,
        fireRate: 1.6,
        projectileSpeed: 80,
        range: 360,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.7,
        maxYaw: Math.PI * 0.7,
        minPitch: -Math.PI * 0.25,
        maxPitch: Math.PI * 0.45,
        priority: 'antiFighter',
      },
    ],
  },
  carrier: {
    hull: 'carrier',
    maxHp: 320,
    maxShield: 200,
    shieldRegen: 10.0,
    damage: 28,
    fireRate: 2.2,
    projectileSpeed: 50,
    range: 400,
    speed: 7,
    scale: 1,
    bulletType: 'bullet:ion',
    motion: {
      mass: 6.0,
      maxSpeed: 7, // units/s - matches legacy speed
      maxReverseSpeed: 2,
      linearAcceleration: 6, // units/s² - very slow acceleration
      linearDamping: 1.0, // minimal damping for massive ship
      maxTurnRate: Math.PI * 0.4, // rad/s - very slow turning (72°/s)
      angularAcceleration: Math.PI * 1.2, // rad/s² - very slow turn acceleration
      angularDamping: 3.0, // low damping
      maxLateralAcceleration: 2, // units/s² - minimal strafe
      visualBankFactor: 8,
      maxBankDeg: 18,
      smoothing: {
        positionLerp: 0.12,
        rotationSlerp: 0.16,
        bankLerp: 0.12,
        teleportDistance: 45,
      },
    },
    turrets: [
      {
        offset: new Vector3(2.0, 0.35, 0.0),
        damage: 9,
        fireRate: 1.3,
        projectileSpeed: 50,
        range: 360,
        bulletType: 'bullet:ion',
        minYaw: -Math.PI * 0.5,
        maxYaw: Math.PI * 0.5,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.45,
        priority: 'antiCapital',
      },
      {
        offset: new Vector3(-2.0, 0.35, 0.0),
        damage: 9,
        fireRate: 1.3,
        projectileSpeed: 50,
        range: 360,
        bulletType: 'bullet:ion',
        minYaw: -Math.PI * 0.5,
        maxYaw: Math.PI * 0.5,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.45,
        priority: 'antiCapital',
      },
      {
        offset: new Vector3(0.0, 0.35, 1.2),
        damage: 9,
        fireRate: 1.5,
        projectileSpeed: 80,
        range: 360,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.7,
        maxYaw: Math.PI * 0.7,
        minPitch: -Math.PI * 0.25,
        maxPitch: Math.PI * 0.5,
        priority: 'antiFighter',
      },
      {
        offset: new Vector3(0.0, 0.35, -1.2),
        damage: 9,
        fireRate: 1.5,
        projectileSpeed: 80,
        range: 360,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.7,
        maxYaw: Math.PI * 0.7,
        minPitch: -Math.PI * 0.25,
        maxPitch: Math.PI * 0.5,
        priority: 'antiFighter',
      },
    ],
  },
};

Object.values(SHIP_STATS).forEach((stats) => validateMotionStats(stats.motion));

// Note: each ShipStats entry may include `bulletType` which is a material/key string
// used by the renderer to pick a projectile visual (e.g. 'bullet:laser'). When a ship
// fires, its ShipComponent.bulletType is copied into the ProjectileComponent so the
// `Projectile` renderer can choose the correct material per-projectile.

export function spawnShip(state: GameState, blueprint: ShipBlueprint): ShipEntity {
  const stats = SHIP_STATS[blueprint.hull];
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), blueprint.heading);
  const position = blueprint.position.clone();

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(position.x, position.y, position.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  const body = state.physicsWorld.createRigidBody(bodyDesc);

  // Collider tuned for models authored at 1:1 scale; adjust if individual GLBs vary.
  const colliderDesc = state.rapier.ColliderDesc.capsule(0.8, 0.6)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

  // Create AI state first to get traitSeed for deterministic variance  
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
      range: applyRangeVariance(stats.range, aiState.traitSeed, 0), // Apply variance to main weapon
      speed: stats.speed,
      bulletType: stats.bulletType,
      parentCarrierId: blueprint.parentCarrierId,
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: stats.motion,
    },
    model: blueprint.hull,
    shieldRipples: [],
    turrets: (stats.turrets ?? []).map<TurretState>((t, idx) => ({
      offset: t.offset.clone(),
      damage: t.damage,
      fireRate: t.fireRate,
      projectileSpeed: t.projectileSpeed,
      range: applyRangeVariance(t.range, aiState.traitSeed, idx + 1), // Apply variance to turret weapons
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

  // Spawn turret entities for each turret spec
  const turretSpecs = stats.turrets ?? [];
  turretSpecs.forEach((spec, idx) => {
    const tBodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    const tBody = state.physicsWorld.createRigidBody(tBodyDesc);
    // Tiny sensor collider just to integrate consistently in physics world; not used for collisions
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
        // Use provided arcs/priority if present; otherwise generous defaults
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
    // Register turret entity in the turretsByShip map for fast cascade removal.
    try {
      registerTurret(state, registered.id, turretEntity);
    } catch {
      // defensive: ignore map issues
    }
  });
  return registered;
}

function createInitialAIState(state: GameState, hull: ShipHull): AIState {
  const profileId = getDefaultProfileId(hull);
  const heading = new Vector3(0, 0, 1);
  const tickInterval = state.ai.tickInterval || 0.1;
  const traitSeed = Math.max(1, Math.floor(state.rng.next() * 0x7fffffff));
  return {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: {
      dodgeAt: 0,
      burstAt: 0,
    },
    lod: 1,
    traitSeed,
    traits: generateTraitsFromSeed(traitSeed),
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    command: {
      heading,
      thrust: 0,
      firePrimary: false,
      ttl: tickInterval,
    },
  };
}

