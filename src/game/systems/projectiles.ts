import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity, TurretEntity } from '../../types/index.js';
import { clampToWorld, AI_CONFIG } from '../config.js';
import {
  PROJECTILE_CONFIG,
  DEFAULT_PROJECTILE_CONFIG,
  getProjectileCategory,
  getProjectileBeamConfig,
} from '../../config/projectiles.js';
import { getEffectiveStats } from '../progression.js';
import { enqueuePostPhysicsMutation } from '../simulationQueue.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../physics/safeKinematics.js';
import type { BeamRuntimeState, ProjectileCategory, DamageType } from '../../types/combat.js';
import { calculateEffectiveDamage, applySubsystemDamage, awardDamageXp } from '../progression.js';
import { SeededRng } from '../../utils/rng.js';
import { isCopilotDebugEnabled } from '../../utils/starDisk.js';

export const FORWARD = new Vector3(0, 0, 1);
export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();
const TEMP_BEAM_DIR = new Vector3();
const TEMP_BEAM_LOCAL_DIR = new Vector3();
const TEMP_INV_ROT = new Quaternion();
const TEMP_BEAM_ORIGIN = new Vector3();
const TEMP_BEAM_VECTOR = new Vector3();
const TEMP_BEAM_PERP = new Vector3();
const TEMP_IMPACT_DIR = new Vector3();
const TEMP_RIGHT = new Vector3();
const TEMP_UP = new Vector3();

/**
 * Perform instant hitscan raycast for beam weapons.
 * Returns the target ship and impact distance if a hit is detected.
 * `selfHitPadding` ignores hits within a small distance from the origin to
 * avoid immediate self-intersections when the muzzle starts inside a collider.
 */
function performBeamHitscan(
  state: GameState,
  origin: Vector3,
  direction: Vector3,
  beamWidth: number,
  maxRange: number,
  sourceTeam: string,
  sourceId: number | null,
  selfHitPadding = 0,
): { target: ShipEntity; distance: number } | null {
  const ships = state.queries.ships.entities as ShipEntity[];
  let closest: ShipEntity | null = null;
  let closestDistance = maxRange;

  for (const ship of ships) {
    // Skip ships on the same team and the source ship
    if (ship.ship.team === sourceTeam) continue;
    if (sourceId != null && ship.id === sourceId) continue;

    const toShip = TEMP_BEAM_VECTOR.copy(ship.transform.position).sub(origin);
    const along = toShip.dot(direction);
    if (along < 0 || along > maxRange) continue;
    if (along <= selfHitPadding) continue;

    const radial = TEMP_BEAM_PERP.copy(toShip).addScaledVector(direction, -along);
    const shipRadius = ship.transform.scale * 0.9;
    const combined = shipRadius + beamWidth * 0.5;

    if (radial.lengthSq() <= combined * combined) {
      if (along < closestDistance) {
        closestDistance = along;
        closest = ship;
      }
    }
  }

  return closest ? { target: closest, distance: closestDistance } : null;
}

/**
 * Apply instant beam damage to a target ship.
 */
function applyBeamDamage(
  state: GameState,
  target: ShipEntity,
  damage: number,
  damageType: string | undefined,
  impactPosition: Vector3,
  sourceId: number | null,
  bulletType: string | undefined,
): void {
  const effectiveDamageType: DamageType = (damageType as DamageType) ?? 'kinetic';
  const damageResult = calculateEffectiveDamage(
    damage,
    effectiveDamageType,
    target.ship.shield,
    target.ship.armor,
  );

  if (damageResult.shieldDamage > 0) {
    target.ship.shield -= damageResult.shieldDamage;
    const dir = TEMP_IMPACT_DIR.copy(impactPosition).sub(target.transform.position);
    if (dir.lengthSq() > 1e-5) dir.normalize();
    else dir.set(0, 0, 1);
    const strength = Math.min(1, damageResult.shieldDamage / Math.max(1, target.ship.maxShield));
    const ripple = { dir: dir.clone(), t0: state.time, amp: strength };
    const list = (target.shieldRipples ??= []);
    list.push(ripple);
    if (list.length > 64) list.shift();
  }

  if (damageResult.armorDamage > 0) {
    target.ship.armor = Math.max(0, target.ship.armor - damageResult.armorDamage * 0.1);
  }

  let hullDamage = 0;
  if (damageResult.hullDamage > 0) {
    const prevHp = target.ship.hp;
    target.ship.hp -= damageResult.hullDamage;
    hullDamage = Math.max(0, prevHp - target.ship.hp);
    // Use a stable seed for subsystem damage based on source and target IDs
    const seed = (sourceId ?? 0) * 8191 + target.id;
    applySubsystemDamage(target.ship, hullDamage, new SeededRng(seed));
  }

  const totalDamageDealt =
    damageResult.shieldDamage + damageResult.armorDamage + damageResult.hullDamage;
  if (totalDamageDealt > 0 && sourceId != null) {
    const ships = state.queries.ships.entities as ShipEntity[];
    const attacker = ships.find((s) => s.id === sourceId);
    if (attacker) {
      const damageSource = bulletType ?? 'Beam';
      awardDamageXp(attacker.ship, totalDamageDealt, state, attacker.id, damageSource);
    }
  }
}

export function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const ships = state.queries.ships.entities as ShipEntity[];
  const turrets = state.queries.turrets.entities as TurretEntity[];
  for (const projectile of projectiles) {
    const component = projectile.projectile;
    if (!component.armed) {
      const armingTime = component.armingTime ?? 0;
      if (armingTime <= 0 || state.time - component.spawnTime >= armingTime) {
        component.armed = true;
      }
    }

    const homing = component.homing;
    if (homing && component.targetId != null) {
      const target = ships.find((ship) => ship.id === component.targetId);
      if (target) {
        const desired = TEMP_DIR.copy(target.transform.position).sub(projectile.transform.position);
        if (desired.lengthSq() > 1e-6) {
          desired.normalize();
          const currentDir = projectile.direction;
          const dot = Math.max(-1, Math.min(1, currentDir.dot(desired)));
          const angle = Math.acos(dot);
          const maxTurn = Math.max(0, homing.turnRate) * delta;
          if (angle > 1e-5 && maxTurn > 0) {
            const t = Math.min(1, maxTurn / angle);
            currentDir.lerp(desired, t).normalize();
            projectile.transform.rotation.setFromUnitVectors(FORWARD, currentDir);
          }
        }
      }
    }

    if (component.category === 'beam') {
      const beamState = component.beam;
      if (component.sourceId != null && beamState) {
        const source = ships.find((ship) => ship.id === component.sourceId);
        if (source) {
          let worldOrigin: Vector3 | null = null;

          if (beamState.sourceTurretId != null) {
            const turret = turrets.find((t) => t.id === beamState.sourceTurretId);
            if (turret) {
              worldOrigin = TEMP_BEAM_ORIGIN.copy(turret.transform.position);
            }
          }

          if (!worldOrigin && beamState.sourceTurretIndex != null) {
            const embedded = source.turrets?.[beamState.sourceTurretIndex];
            if (embedded) {
              worldOrigin = TEMP_BEAM_ORIGIN.copy(embedded.offset)
                .multiplyScalar(source.transform.scale)
                .applyQuaternion(source.transform.rotation)
                .add(source.transform.position);
            }
          }

          if (!worldOrigin && beamState.localOrigin) {
            worldOrigin = TEMP_BEAM_ORIGIN.copy(beamState.localOrigin)
              .multiplyScalar(source.transform.scale)
              .applyQuaternion(source.transform.rotation)
              .add(source.transform.position);
          }

          if (!worldOrigin) {
            worldOrigin = TEMP_BEAM_ORIGIN.copy(source.transform.position);
          }

          clampToWorld(worldOrigin);
          projectile.transform.position.copy(worldOrigin);
          deferSetNextKinematicTranslation(
            state,
            projectile.rigidBody as unknown as KinematicBody,
            worldOrigin.x,
            worldOrigin.y,
            worldOrigin.z,
          );

          let worldDirection: Vector3 | null = null;
          let localDirectionWorld: Vector3 | null = null;

          if (beamState.localDirection && beamState.localDirection.lengthSq() > 1e-6) {
            localDirectionWorld = TEMP_BEAM_LOCAL_DIR.copy(beamState.localDirection)
              .applyQuaternion(source.transform.rotation)
              .normalize();
          }
          if (beamState.sourceTurretId != null) {
            const turret = turrets.find((t) => t.id === beamState.sourceTurretId);
            if (turret?.direction && turret.direction.lengthSq() > 1e-6) {
              worldDirection = TEMP_BEAM_DIR.copy(turret.direction).normalize();
            } else if (
              turret?.turret?.aimDirection &&
              turret.turret.aimDirection.lengthSq() > 1e-6
            ) {
              worldDirection = TEMP_BEAM_DIR.copy(turret.turret.aimDirection).normalize();
            }
          }

          if (!worldDirection && beamState.sourceTurretIndex != null) {
            const embedded = source.turrets?.[beamState.sourceTurretIndex];
            if (embedded?.aimDirection && embedded.aimDirection.lengthSq() > 1e-6) {
              worldDirection = TEMP_BEAM_DIR.copy(embedded.aimDirection).normalize();
            }
          }

          if (!worldDirection && localDirectionWorld) {
            worldDirection = localDirectionWorld;
          }

          if (worldDirection) {
            projectile.direction.copy(worldDirection);
            projectile.transform.rotation.setFromUnitVectors(FORWARD, worldDirection);
            const invRotation = TEMP_INV_ROT.copy(source.transform.rotation).invert();
            if (beamState.localDirection) {
              if (worldDirection !== localDirectionWorld) {
                beamState.localDirection
                  .copy(worldDirection)
                  .applyQuaternion(invRotation)
                  .normalize();
              }
            } else {
              beamState.localDirection = worldDirection
                .clone()
                .applyQuaternion(invRotation)
                .normalize();
            }
          }
        }
      }
      continue;
    }

    const move = component.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    deferSetNextKinematicTranslation(
      state,
      projectile.rigidBody as unknown as KinematicBody,
      next.x,
      next.y,
      next.z,
    );
  }
}

export function fireProjectile(
  state: GameState,
  origin: ShipEntity,
  direction: Vector3,
  opts?: {
    originPosition?: Vector3;
    override?: Partial<
      Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType' | 'damageType'>
    >;
    targetId?: number;
    projectileCategory?: ProjectileCategory;
    sourceTurretId?: number;
    sourceTurretIndex?: number;
  },
): void {
  const muzzleOffset = origin.transform.scale * 1.6;
  const startPosition = opts?.originPosition
    ? opts.originPosition.clone()
    : origin.transform.position.clone().addScaledVector(direction, muzzleOffset);
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);
  const beamWorldOffset = startPosition.clone().sub(origin.transform.position);

  const bulletKey = opts?.override?.bulletType ?? origin.ship.bulletType ?? '';
  const cfg = PROJECTILE_CONFIG[bulletKey] ?? DEFAULT_PROJECTILE_CONFIG;
  const category = opts?.projectileCategory ?? cfg.category ?? getProjectileCategory(bulletKey);
  const visualScale = cfg.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale;
  const colliderRadius = cfg.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  const speedOverrides = opts?.override?.projectileSpeed;
  let speed = speedOverrides ?? origin.ship.projectileSpeed;
  if (category === 'beam') {
    speed = 0;
  }
  if (AI_CONFIG.rangePolicy === 'v0.1.1-exp' && !speedOverrides) {
    if (origin.ship.hull === 'destroyer' || origin.ship.hull === 'carrier') {
      speed *= 1.05;
    } else if (origin.ship.hull === 'fighter') {
      speed *= 1.02;
    } else if (origin.ship.hull === 'corvette') {
      speed *= 0.98;
    } else if (origin.ship.hull === 'frigate') {
      speed *= 0.96;
    }

    const speedAdjustments: Record<string, number> = {
      'bullet:laser': 0.97,
      'bullet:heavy': 1.03,
      'bullet:ion': 1.03,
    };
    const adjustment = speedAdjustments[bulletKey];
    if (adjustment != null) {
      speed *= adjustment;
    }
  }
  const damageType = opts?.override?.damageType ?? origin.ship.damageType;
  const damage =
    (opts?.override?.damage ?? origin.ship.damage) *
    getEffectiveStats(origin.ship).damageMultiplier;
  const range = opts?.override?.range ?? origin.ship.range;
  const resolvedRange = Number.isFinite(range ?? NaN) ? Math.max(range as number, 0) : 0;
  const beamConfig = category === 'beam' ? getProjectileBeamConfig(bulletKey) : undefined;
  const lifetime =
    category === 'beam'
      ? Math.min(beamConfig?.ttl ?? 0.1, 0.5)
      : Math.min(range / Math.max(1e-3, speed), 30);

  // Handle beam weapons: instant hitscan for damage + visual-only beam entity
  if (category === 'beam' && beamConfig) {
    const beamWidth = beamConfig.width;
    const beamLength = beamConfig.length;
    const beamTtl = beamConfig.ttl;
    const muzzleClearance = startPosition.distanceTo(origin.transform.position);
    const selfHitPadding = Math.max(0.1, beamWidth * 0.5, muzzleClearance * 0.25);

    // Perform instant hitscan raycast
    const hitResult = performBeamHitscan(
      state,
      startPosition,
      direction,
      beamWidth,
      range,
      origin.ship.team,
      origin.id,
      selfHitPadding,
    );

    // Apply damage instantly if we hit a target
    let actualLength = beamLength;
    let targetId: number | undefined;
    let impactPosition: Vector3 | undefined;
    let visualWorldDirection: Vector3 | null = null;
    let debugConeAngleRad: number | null = null;
    if (hitResult) {
      actualLength = hitResult.distance;
      impactPosition = startPosition.clone().addScaledVector(direction, actualLength);
      targetId = hitResult.target.id;
      applyBeamDamage(
        state,
        hitResult.target,
        damage,
        damageType,
        impactPosition,
        origin.id,
        bulletKey,
      );
      // For hits, force the visual direction to "look at" the impact position to avoid any disparity
      visualWorldDirection = impactPosition.clone().sub(startPosition).normalize();
    }

    const maxLength = Math.max(beamLength, actualLength, resolvedRange);
    if (actualLength > maxLength) {
      actualLength = maxLength;
    }

    const invRotation = TEMP_INV_ROT.copy(origin.transform.rotation).invert();
    const localOrigin = startPosition
      .clone()
      .sub(origin.transform.position)
      .applyQuaternion(invRotation);
    const scale = origin.transform.scale;
    if (Math.abs(scale) > 1e-5) {
      localOrigin.divideScalar(scale);
    }
    // Decide the visual direction: exact impact for hits, jittered miss within a cone for misses
    // Base cone is ~8.6 degrees; scale by captain accuracy so better crews "miss less".
    const BASE_MISS_CONE_ANGLE = 0.15; // radians (~8.6°)
    const MIN_MISS_CONE_ANGLE = 0.04; // radians (~2.3°) hard lower bound to keep some spread
    const MAX_MISS_CONE_ANGLE = 0.30; // radians (~17.2°) upper bound to avoid wild visuals
    if (!visualWorldDirection) {
      // Compute intended direction to target if known, else use incoming fire direction
      let intended = direction.clone();
      if (opts?.targetId != null) {
        const ships = state.queries.ships.entities as ShipEntity[];
        const tgt = ships.find((s) => s.id === opts.targetId);
        if (tgt) {
          intended.copy(tgt.transform.position).sub(startPosition);
        }
      }
      if (intended.lengthSq() > 1e-6) intended.normalize();
      else intended.set(0, 0, 1);

      // Seeded RNG for deterministic jitter
      const seed = origin.id * 8191 + (opts?.targetId ?? 0) * 131 + state.nextEntityId;
      const rng = new SeededRng(seed);

      // Compute effective accuracy multiplier (captain accuracy × morale accuracy boost if active)
      let acc = origin.ship.captain?.accuracy ?? 1.0;
      const morale = origin.ship.captain?.moraleAbility;
      if (morale?.isActive && morale.effect === 'accuracy_boost') {
        // Description says: "Increases hit chance by 25%" — apply as a 1.25x accuracy multiplier
        acc *= 1.25;
      }
      // Map accuracy to a cone angle: higher accuracy → tighter cone, lower accuracy → wider cone
      // Scale the base angle by the inverse of accuracy so better crews have tighter spread
      const missConeAngle = Math.min(
        MAX_MISS_CONE_ANGLE,
        Math.max(MIN_MISS_CONE_ANGLE, BASE_MISS_CONE_ANGLE * (2.0 / (1.0 + acc))),
      );
      debugConeAngleRad = missConeAngle;

      // Build an orthonormal basis around intended
      const safeUp = Math.abs(intended.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      TEMP_RIGHT.copy(intended).cross(safeUp);
      if (TEMP_RIGHT.lengthSq() < 1e-6) {
        TEMP_RIGHT.set(1, 0, 0).cross(intended);
      }
      TEMP_RIGHT.normalize();
      TEMP_UP.copy(TEMP_RIGHT).cross(intended).normalize();

  const u = rng.next();
  const v = rng.next();
      const cosMax = Math.cos(missConeAngle);
      const cosTheta = (1 - u) + u * cosMax; // uniform over spherical cap
      const theta = Math.acos(Math.min(1, Math.max(-1, cosTheta)));
      const phi = 2 * Math.PI * v;
      const sinTheta = Math.sin(theta);
      visualWorldDirection = new Vector3()
        .copy(intended)
        .multiplyScalar(Math.cos(theta))
        .addScaledVector(TEMP_RIGHT, Math.cos(phi) * sinTheta)
        .addScaledVector(TEMP_UP, Math.sin(phi) * sinTheta)
        .normalize();
    }

    // Derive localDirection from the final visual world direction
    const localDirection = visualWorldDirection.clone().applyQuaternion(invRotation);
    if (localDirection.lengthSq() > 1e-6) localDirection.normalize();
    else localDirection.set(0, 0, 1);

    // Spawn visual-only beam entity (no physics body)
    enqueuePostPhysicsMutation(state, () => {
      const debug = isCopilotDebugEnabled();
      if (debug) {
        // Log beam spawn details for diagnostics
        try {
          console.debug('[BeamDebug] spawn', {
            id: state.nextEntityId,
            time: state.time.toFixed(3),
            team: origin.ship.team,
            bulletType: bulletKey,
            sourceId: origin.id,
            sourceTurretId: opts?.sourceTurretId,
            sourceTurretIndex: opts?.sourceTurretIndex,
            origin: { x: +startPosition.x.toFixed(2), y: +startPosition.y.toFixed(2), z: +startPosition.z.toFixed(2) },
            direction: { x: +visualWorldDirection.x.toFixed(3), y: +visualWorldDirection.y.toFixed(3), z: +visualWorldDirection.z.toFixed(3) },
            width: +beamWidth.toFixed(2),
            length: +actualLength.toFixed(2),
            maxLength: +maxLength.toFixed(2),
            ttl: +beamTtl.toFixed(2),
            targetId: targetId ?? null,
            targetPos: impactPosition
              ? { x: +impactPosition.x.toFixed(2), y: +impactPosition.y.toFixed(2), z: +impactPosition.z.toFixed(2) }
              : null,
            coneAngleRad: targetId ? null : debugConeAngleRad != null ? +debugConeAngleRad.toFixed(3) : null,
            localOrigin: { x: +localOrigin.x.toFixed(3), y: +localOrigin.y.toFixed(3), z: +localOrigin.z.toFixed(3) },
            localDirection: { x: +localDirection.x.toFixed(3), y: +localDirection.y.toFixed(3), z: +localDirection.z.toFixed(3) },
          });
        } catch {}
      }
      state.world.add({
        id: state.nextEntityId++,
        transform: {
          position: startPosition.clone(),
          rotation: new Quaternion().setFromUnitVectors(FORWARD, visualWorldDirection),
          scale: visualScale,
        },
        direction: visualWorldDirection.clone(),
        beamVisual: {
          team: origin.ship.team,
          ttl: beamTtl,
          maxTtl: beamTtl,
          width: beamWidth,
          length: actualLength,
          maxLength,
          fade: beamConfig.fade,
          bulletType: bulletKey,
          sourceId: origin.id,
          sourceTurretId: opts?.sourceTurretId,
          sourceTurretIndex: opts?.sourceTurretIndex,
          spawnTime: state.time,
          localOrigin,
          worldOffset: beamWorldOffset.clone(),
          localDirection,
          targetId,
          impactPosition: impactPosition ? impactPosition.clone() : undefined,
        },
      });
    });

    return; // Early return for beam weapons
  }

  // Non-beam projectiles: continue with normal physics-based projectile creation
  let beamState: BeamRuntimeState | undefined;
  if (beamConfig) {
    beamState = {
      ttl: beamConfig.ttl,
      width: beamConfig.width,
      length: beamConfig.length,
      maxLength: Math.max(beamConfig.length, resolvedRange),
      fade: beamConfig.fade,
      worldOffset: beamWorldOffset.clone(),
    };

    const shipRotation = origin.transform.rotation;
    const invRotation =
      typeof (shipRotation as Quaternion).clone === 'function'
        ? (shipRotation as Quaternion).clone().invert()
        : new Quaternion(
            (shipRotation as Quaternion).x ?? 0,
            (shipRotation as Quaternion).y ?? 0,
            (shipRotation as Quaternion).z ?? 0,
            (shipRotation as Quaternion).w ?? 1,
          ).invert();
    const localOrigin = startPosition
      .clone()
      .sub(origin.transform.position)
      .applyQuaternion(invRotation);
    const scale = origin.transform.scale;
    if (Math.abs(scale) > 1e-5) {
      localOrigin.divideScalar(scale);
    }
    beamState.localOrigin = localOrigin;

    const localDirection = direction.clone().applyQuaternion(invRotation).normalize();
    beamState.localDirection = localDirection;
    if (opts?.sourceTurretId != null) {
      beamState.sourceTurretId = opts.sourceTurretId;
    }
    if (opts?.sourceTurretIndex != null) {
      beamState.sourceTurretIndex = opts.sourceTurretIndex;
    }
  }

  const spawnDirection = direction.clone();
  const rotationComponents = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
  const positionComponents = { x: startPosition.x, y: startPosition.y, z: startPosition.z };
  const projectileData = {
    team: origin.ship.team,
    damage,
    ttl: lifetime,
    speed,
    bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
    damageType,
    sourceId: origin.id,
    category,
    targetId: opts?.targetId,
    homing: cfg.homing,
    armingTime: cfg.armingTime,
    armed: cfg.armingTime ? cfg.armingTime <= 0 : true,
    aoeRadius: cfg.aoeRadius,
    spawnTime: state.time,
    beam: beamState,
    range,
  };

  enqueuePostPhysicsMutation(state, () => {
    const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(positionComponents.x, positionComponents.y, positionComponents.z)
      .setRotation(rotationComponents);
    const body = state.physicsWorld.createRigidBody(bodyDesc);

    const colliderDesc = state.rapier.ColliderDesc.ball(colliderRadius)
      .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
      .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
    const collider = state.physicsWorld.createCollider(colliderDesc, body);

    const projectile = state.world.add({
      id: state.nextEntityId++,
      rigidBody: body,
      collider,
      transform: {
        position: new Vector3(positionComponents.x, positionComponents.y, positionComponents.z),
        rotation: new Quaternion(
          rotationComponents.x,
          rotationComponents.y,
          rotationComponents.z,
          rotationComponents.w,
        ),
        scale: visualScale,
      },
      projectile: {
        team: projectileData.team,
        damage: projectileData.damage,
        ttl: projectileData.ttl,
        maxTtl: projectileData.ttl,
        speed: projectileData.speed,
        bulletType: projectileData.bulletType,
        damageType: projectileData.damageType,
        sourceId: projectileData.sourceId,
        category: projectileData.category,
        targetId: projectileData.targetId,
        homing: projectileData.homing,
        armingTime: projectileData.armingTime,
        armed: projectileData.armed,
        aoeRadius: projectileData.aoeRadius,
        spawnTime: projectileData.spawnTime,
        beam: projectileData.beam,
        range: projectileData.range,
      },
      direction: spawnDirection.clone(),
    });

    if (collider?.handle != null) {
      state.colliderLookup.set(collider.handle, projectile);
    }
  });
}
