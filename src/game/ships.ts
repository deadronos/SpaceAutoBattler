import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipBlueprint, ShipEntity, ShipHull, ShipStats, TurretState, TurretEntity } from '../types/index.js';

export const SHIP_STATS: Record<ShipHull, ShipStats> = {
  fighter: {
    hull: 'fighter',
    maxHp: 40,
    maxShield: 24,
    damage: 8,
    fireRate: 0.9,
    projectileSpeed: 28,
    range: 18,
    speed: 14,
    scale: 1,
    bulletType: 'bullet:laser',
    turrets: []
  },
  corvette: {
    hull: 'corvette',
    maxHp: 75,
    maxShield: 45,
    damage: 12,
    fireRate: 1.2,
    projectileSpeed: 24,
    range: 22,
    speed: 11,
    scale: 1,
    bulletType: 'bullet:plasma',
    turrets: [
      {
        offset: new Vector3(0.9, 0.2, 0.1),
        damage: 6,
        fireRate: 1.0,
        projectileSpeed: 24,
        range: 18,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.6,
        maxYaw: Math.PI * 0.6,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.4,
        priority: 'antiFighter'
      },
      {
        offset: new Vector3(-0.9, 0.2, 0.1),
        damage: 6,
        fireRate: 1.0,
        projectileSpeed: 24,
        range: 18,
        bulletType: 'bullet:laser',
        minYaw: -Math.PI * 0.6,
        maxYaw: Math.PI * 0.6,
        minPitch: -Math.PI * 0.2,
        maxPitch: Math.PI * 0.4,
        priority: 'antiFighter'
      }
    ]
  },
  frigate: {
    hull: 'frigate',
    maxHp: 120,
    maxShield: 72,
    damage: 16,
    fireRate: 1.5,
    projectileSpeed: 22,
    range: 26,
    speed: 9,
    scale: 1,
    bulletType: 'bullet:plasma',
    turrets: [
      { offset: new Vector3(1.2, 0.25, 0.0), damage: 8, fireRate: 1.2, projectileSpeed: 22, range: 22, bulletType: 'bullet:plasma', minYaw: -Math.PI * 0.5, maxYaw: Math.PI * 0.5, minPitch: -Math.PI * 0.2, maxPitch: Math.PI * 0.5, priority: 'any' },
      { offset: new Vector3(-1.2, 0.25, 0.0), damage: 8, fireRate: 1.2, projectileSpeed: 22, range: 22, bulletType: 'bullet:plasma', minYaw: -Math.PI * 0.5, maxYaw: Math.PI * 0.5, minPitch: -Math.PI * 0.2, maxPitch: Math.PI * 0.5, priority: 'any' },
      { offset: new Vector3(0.0, 0.25, -0.8), damage: 8, fireRate: 1.2, projectileSpeed: 22, range: 22, bulletType: 'bullet:laser', minYaw: -Math.PI * 0.9, maxYaw: Math.PI * 0.9, minPitch: -Math.PI * 0.3, maxPitch: Math.PI * 0.4, priority: 'antiFighter' }
    ]
  },
  destroyer: {
    hull: 'destroyer',
    maxHp: 200,
    maxShield: 120,
    damage: 22,
    fireRate: 1.8,
    projectileSpeed: 20,
    range: 30,
    speed: 7,
    scale: 1,
    bulletType: 'bullet:heavy',
    turrets: [
      { offset: new Vector3(1.6, 0.3, -0.2), damage: 10, fireRate: 1.4, projectileSpeed: 20, range: 26, bulletType: 'bullet:plasma', minYaw: -Math.PI * 0.6, maxYaw: Math.PI * 0.6, minPitch: -Math.PI * 0.2, maxPitch: Math.PI * 0.4, priority: 'antiCapital' },
      { offset: new Vector3(-1.6, 0.3, -0.2), damage: 10, fireRate: 1.4, projectileSpeed: 20, range: 26, bulletType: 'bullet:plasma', minYaw: -Math.PI * 0.6, maxYaw: Math.PI * 0.6, minPitch: -Math.PI * 0.2, maxPitch: Math.PI * 0.4, priority: 'antiCapital' },
      { offset: new Vector3(0.9, 0.3, 0.6), damage: 10, fireRate: 1.6, projectileSpeed: 20, range: 26, bulletType: 'bullet:laser', minYaw: -Math.PI * 0.7, maxYaw: Math.PI * 0.7, minPitch: -Math.PI * 0.25, maxPitch: Math.PI * 0.45, priority: 'antiFighter' },
      { offset: new Vector3(-0.9, 0.3, 0.6), damage: 10, fireRate: 1.6, projectileSpeed: 20, range: 26, bulletType: 'bullet:laser', minYaw: -Math.PI * 0.7, maxYaw: Math.PI * 0.7, minPitch: -Math.PI * 0.25, maxPitch: Math.PI * 0.45, priority: 'antiFighter' }
    ]
  },
  carrier: {
    hull: 'carrier',
    maxHp: 320,
    maxShield: 200,
    damage: 28,
    fireRate: 2.2,
    projectileSpeed: 18,
    range: 34,
    speed: 5,
    scale: 1,
    bulletType: 'bullet:ion',
    turrets: [
      { offset: new Vector3(2.0, 0.35, 0.0), damage: 9, fireRate: 1.3, projectileSpeed: 18, range: 28, bulletType: 'bullet:ion', minYaw: -Math.PI * 0.5, maxYaw: Math.PI * 0.5, minPitch: -Math.PI * 0.2, maxPitch: Math.PI * 0.45, priority: 'antiCapital' },
      { offset: new Vector3(-2.0, 0.35, 0.0), damage: 9, fireRate: 1.3, projectileSpeed: 18, range: 28, bulletType: 'bullet:ion', minYaw: -Math.PI * 0.5, maxYaw: Math.PI * 0.5, minPitch: -Math.PI * 0.2, maxPitch: Math.PI * 0.45, priority: 'antiCapital' },
      { offset: new Vector3(0.0, 0.35, 1.2), damage: 9, fireRate: 1.5, projectileSpeed: 18, range: 28, bulletType: 'bullet:laser', minYaw: -Math.PI * 0.7, maxYaw: Math.PI * 0.7, minPitch: -Math.PI * 0.25, maxPitch: Math.PI * 0.5, priority: 'antiFighter' },
      { offset: new Vector3(0.0, 0.35, -1.2), damage: 9, fireRate: 1.5, projectileSpeed: 18, range: 28, bulletType: 'bullet:laser', minYaw: -Math.PI * 0.7, maxYaw: Math.PI * 0.7, minPitch: -Math.PI * 0.25, maxPitch: Math.PI * 0.5, priority: 'antiFighter' }
    ]
  }
};

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

  const entity: ShipEntity = {
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position,
      rotation,
      scale: stats.scale
    },
    ship: {
      team: blueprint.team,
      hull: blueprint.hull,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: stats.maxShield ?? Math.round(stats.maxHp * 0.6),
      maxShield: stats.maxShield ?? Math.round(stats.maxHp * 0.6),
      cooldown: stats.fireRate * state.rng.next(),
      fireRate: stats.fireRate,
      damage: stats.damage,
      projectileSpeed: stats.projectileSpeed,
      range: stats.range,
      speed: stats.speed,
      bulletType: stats.bulletType
    },
    model: blueprint.hull,
    shieldRipples: [],
    turrets: (stats.turrets ?? []).map<TurretState>((t) => ({
      offset: t.offset.clone(),
      damage: t.damage,
      fireRate: t.fireRate,
      projectileSpeed: t.projectileSpeed,
      range: t.range,
      bulletType: t.bulletType,
      cooldown: t.fireRate * state.rng.next()
    }))
  };

  const registered = state.world.createEntity(entity) as ShipEntity;
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

    const turretEntity = state.world.createEntity({
      id: state.nextEntityId++,
      rigidBody: tBody,
      collider: tCollider,
      transform: {
        position: position.clone(),
        rotation: rotation.clone(),
        scale: 1
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
        priority: spec.priority ?? 'any'
      }
    }) as TurretEntity;
    state.colliderLookup.set(tCollider.handle, turretEntity);
  });
  return registered;
}
