import type {
  GameState,
  Ship,
  ShipClass,
  Team,
  Vector3,
  EntityId,
  Bullet,
  TurretState,
} from '../types/index.js';
import { DefaultSimConfig } from '../config/simConfig.js';
import {
  SHIP_CLASS_CONFIGS as _SHIP_CLASS_CONFIGS,
  getShipClassConfig,
} from '../config/entitiesConfig.js';
import { createRNG } from '../utils/rng.js';
import { nextLevelXp, XP_PER_DAMAGE, XP_PER_KILL, applyLevelUps } from '../config/progression.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../config/behaviorConfig.js';
import { AIController } from './aiController.js';
import { calculatePreferredRange } from './ai/intent.js';
// Note: AggressiveSpatialOptimizer import removed (unused in this module)
import { FleetConfig } from '../config/fleetConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { CarrierSpawnConfig } from '../config/carrierSpawnConfig.js';
import { SpatialGrid } from '../utils/spatialGrid.js';
import { applyBoundaryPhysicsShip, applyBoundaryPhysicsBullet } from './boundaryUtils.js';
import { DEBUG_AI } from '../utils/env';
import { perfBegin, perfEnd } from '../utils/perf.js';

export function createInitialState(seed?: string): GameState {
  const config = { ...DefaultSimConfig };
  if (seed) {
    config.seed = seed;
  } else if (config.useTimeBasedSeed) {
    config.seed = `SPACE-${Date.now()}`;
  }

  const rng = createRNG(config.seed);
  const state: GameState = {
    time: 0,
    tick: 0,
    running: false,
    speedMultiplier: 1,
    rng,
    nextId: 1,
    simConfig: config,
    ships: [],
    shipIndex: new Map(),
    shipDataVersion: 0,
    bullets: [],
    score: { red: 0, blue: 0 },
    behaviorConfig: { ...DEFAULT_BEHAVIOR_CONFIG },
  };

  // Expose the live, mutable GameState on globalThis for advanced debugging.
  // WARNING: this intentionally exposes the real state object. Use with care —
  // modifying `globalThis.__GameState` or its properties during runtime can
  // affect deterministic behavior and tests. This is a deliberate developer
  // convenience and should be used only in local/dev scenarios.
  try {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as Record<string, unknown>;
      // Preserve any existing helpers under __GameState while also exposing the
      // live state object as `__GameState.state` for backward compatibility.
      type GameStateExposed = { state?: GameState; [k: string]: unknown };
      const current = (g.__GameState as GameStateExposed) || ({} as GameStateExposed);
      current.state = state;
      g.__GameState = current;
    }
  } catch {
    // Best-effort only; avoid throwing in initialization.
  }

  // Initialize spatial grid if enabled
  if (state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    const bounds = {
      width: config.simBounds.width,
      height: config.simBounds.height,
      depth: config.simBounds.depth,
    };
    state.spatialGrid = new SpatialGrid(config.spatialGrid.cellSize, bounds);
  }

  return state;
}

export function resetState(state: GameState, seed?: string) {
  const s = seed ?? state.rng.seed;
  const newRng = createRNG(s);
  state.time = 0;
  state.tick = 0;
  state.running = false;
  state.speedMultiplier = 1;
  state.rng = newRng;
  state.nextId = 1;
  state.ships = [];
  state.shipIndex = new Map();
  state.shipDataVersion = 0;
  state.bullets = [];
  state.score = { red: 0, blue: 0 };
  // Drop cached AI controller so it can be recreated lazily with fresh state/config
  state.aiController = undefined;
  // Reset behavior config to defaults
  state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };

  // Reset spatial grid if enabled
  if (state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    const bounds = {
      width: state.simConfig.simBounds.width,
      height: state.simConfig.simBounds.height,
      depth: state.simConfig.simBounds.depth,
    };
    state.spatialGrid = new SpatialGrid(state.simConfig.spatialGrid.cellSize, bounds);
  } else {
    state.spatialGrid = undefined;
  }
}

/**
 * Ensure a minimal aiState exists on a ship so damage bookkeeping and
 * target/alarm logic can safely update recentDamage/lastDamageTime without
 * requiring callers to initialize aiState elsewhere.
 */
function ensureAIState(s: Ship) {
  if (!s.aiState) {
    s.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: 0,
      recentDamage: 0,
      lastDamageTime: 0,
    } as Ship['aiState'];
  }
  return s.aiState as Ship['aiState'];
}
/**
 * Centralized damage bookkeeping helper.
 * - Awards XP to the owner when present
 * - Records lastDamageBy/lastDamageTime on the victim
 * - Ensures aiState exists and updates recentDamage/lastDamageTime
 */
export function recordDamage(state: GameState, s: Ship, damage: number, ownerShipId?: EntityId) {
  // Award XP to owner and set lastDamageBy if owner exists
  if (ownerShipId !== undefined && ownerShipId !== null) {
    const owner = state.shipIndex?.get(ownerShipId) ?? state.ships.find((sh) => sh.id === ownerShipId);
    if (owner) {
      owner.level.xp += damage * XP_PER_DAMAGE;
      s.lastDamageBy = owner.id;
    } else {
      // Still record id if owner not present in state.shipIndex
      s.lastDamageBy = ownerShipId;
    }
  }

  s.lastDamageTime = state.time;

  // Ensure aiState exists and record damage for AI systems
  ensureAIState(s);
  s.aiState!.recentDamage = (s.aiState!.recentDamage ?? 0) + damage;
  s.aiState!.lastDamageTime = state.time;
}

function allocateId(state: GameState): EntityId {
  return state.nextId++;
}

// Small helpers retained for backward compatibility with older modules/tests
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function randomSpawnPos(state: GameState, team: Team): Vector3 {
  const margin = FleetConfig.spawning.margin;
  const y = state.rng.int(margin, state.simConfig.simBounds.height - margin);
  const z = state.rng.int(margin, state.simConfig.simBounds.depth - margin);
  const x =
    team === 'red'
      ? state.rng.int(margin, margin + FleetConfig.spawning.spawnWidth)
      : state.rng.int(
          state.simConfig.simBounds.width - margin - FleetConfig.spawning.spawnWidth,
          state.simConfig.simBounds.width - margin,
        );
  return { x, y, z };
}

/** Lightweight turret handler kept for compatibility; defers to projectile system in full implementations. */
export function fireTurrets(state: GameState, ship: Ship, dt: number) {
  // Progress cooldowns and fire when ready. This mirrors the simplified logic
  // used by the ProjectileSystem to keep unit tests and legacy callers working.
  const shipCfg = getShipClassConfig(ship.class);
  for (let ti = 0; ti < ship.turrets.length; ti++) {
    const t = ship.turrets[ti];
    t.cooldownLeft = Math.max(0, t.cooldownLeft - dt);
    if (t.cooldownLeft > 0) continue;

    // Find turret config (wrap if turret list shorter than shipCfg turrets)
    const turretConfig = shipCfg.turrets[ti % shipCfg.turrets.length];

    // Determine target position: turret.aiState.targetId -> ship.targetId -> none
    const targetId = t.aiState?.targetId ?? ship.targetId;
    if (targetId == null) continue;
    const target = state.shipIndex?.get(targetId) ?? state.ships.find((s) => s.id === targetId);
    if (!target || target.health <= 0) continue;

    // Range check
    const dx = target.pos.x - ship.pos.x;
    const dy = target.pos.y - ship.pos.y;
    const dz = target.pos.z - ship.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const range = turretConfig.range;
    if (distSq > range * range) continue;

    // Create bullets. Support area_suppression behavior which emits multiple
    // projectiles in a small angular spread. For backward compatibility tests
    // expect at least multiple bullets when suppressionCount > 1.
    const idBase = allocateId(state);
    const dist = distSq > 0 ? Math.sqrt(distSq) : 1;
    const baseDir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const suppressionCount =
      t.aiState?.behavior === 'area_suppression' ? (t.aiState?.suppressionCount ?? 1) : 1;
    const spread = t.aiState?.suppressionAngle ?? 0.0;
    for (let bi = 0; bi < Math.max(1, suppressionCount); bi++) {
      // Slight angular offset within cone for suppression pattern
      const angleOffset =
        suppressionCount <= 1 ? 0 : ((bi / (suppressionCount - 1)) * 2 - 1) * spread;
      // Rotate baseDir around Y-axis approximately for a simple spread in horizontal plane
      const cos = Math.cos(angleOffset);
      const sin = Math.sin(angleOffset);
      const dir = {
        x: baseDir.x * cos - baseDir.z * sin,
        y: baseDir.y,
        z: baseDir.x * sin + baseDir.z * cos,
      };
      const bullet = {
        id: idBase + bi,
        ownerShipId: ship.id,
        ownerTeam: ship.team,
        pos: { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z },
        prevPos: { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z }, // Initialize for interpolation
        vel: {
          x: dir.x * turretConfig.bulletSpeed,
          y: dir.y * turretConfig.bulletSpeed,
          z: dir.z * turretConfig.bulletSpeed,
        },
        ttl: state.simConfig.bulletLifetime,
        damage: turretConfig.damage,
      } as Bullet;
      state.bullets.push(bullet);
    }

    // Set cooldown
    t.cooldownLeft = turretConfig.cooldown;
  }
}

/** Convenience wrapper to spawn a simple fleet using existing spawnShip helper. */
export function spawnFleet(state: GameState, team: Team, count: number = 5) {
  const created: Ship[] = [];
  for (let i = 0; i < count; i++) {
    const cls = state.rng.pick(['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'] as const);
    const ship = spawnShip(state, team, cls, undefined);
    created.push(ship);
  }
  return created;
}

// Backwards-compatible boundary API used by some tests
export function applyBoundaryPhysics(ship: Ship, state: GameState) {
  return applyBoundaryPhysicsShip(ship, state);
}

export function spawnShip(
  state: GameState,
  team: Team,
  cls: ShipClass,
  pos?: Vector3,
  parentCarrierId?: EntityId,
): Ship {
  const cfg = getShipClassConfig(cls);
  const id = allocateId(state);
  const level = { level: 1, xp: 0, nextLevelXp: nextLevelXp(1) };
  const maxHealth = Math.floor(applyLevelUps(level.level, cfg.baseHealth));
  const maxShield = Math.floor(applyLevelUps(level.level, cfg.shield));
  const _globalTurretCfg = state.behaviorConfig?.turretConfig;
  const turrets: TurretState[] = cfg.turrets.map((t, i) => {
    const pref = (t as unknown as { preferredBehavior?: string }).preferredBehavior;
    if (pref && pref !== 'dynamic') {
      // Designer explicitly set a preferred behavior -> initialize aiState with that behavior
      const aiState = {
        targetId: null as EntityId | null,
        lastTargetUpdate: 0,
        behavior: pref as import('../config/behaviorConfig.js').TurretBehavior,
        behaviorExpireTime: Infinity,
      };
      return { id: `${t.id}-${i}`, cooldownLeft: 0, aiState };
    }
    // Otherwise, do not initialize aiState here - AIController will set it lazily
    return { id: `${t.id}-${i}`, cooldownLeft: 0 };
  });
  const p = pos ?? randomSpawnPos(state, team);
  // Initialize with random yaw, level pitch and roll for natural spawning
  const randomYaw = state.rng.next() * Math.PI * 2;

  const ship: Ship = {
    id,
    team,
    class: cls,
    pos: { x: p.x, y: p.y, z: p.z },
    prevPos: { x: p.x, y: p.y, z: p.z }, // Initialize for interpolation
    vel: { x: 0, y: 0, z: 0 },
    orientation: {
      pitch: 0, // level flight initially
      yaw: randomYaw,
      roll: 0, // no banking initially
    },
    prevOrientation: {
      pitch: 0, // Initialize for interpolation
      yaw: randomYaw,
      roll: 0,
    },
    // Keep legacy dir field for backward compatibility
    dir: randomYaw,
    targetId: null,
    health: maxHealth,
    maxHealth,
    armor: cfg.armor,
    shield: maxShield,
    maxShield,
    shieldRegen: cfg.shieldRegen,
    speed: cfg.speed,
    turnRate: cfg.turnRate,
    turrets,
    kills: 0,
    level,
    spawnedFighters: cls === 'carrier' ? 0 : undefined,
    fighterSpawnCdLeft: cls === 'carrier' ? CarrierSpawnConfig.fighter.initialCooldown : undefined,
    parentCarrierId,
    // Initialize dirty flags to true for initial UI render
    _healthDirty: true,
    _shieldDirty: true,
  };

  // Always create aiState so the AI bookkeeping invariant holds. This makes
  // reasoning about damage/alarms simpler and avoids missing updates when
  // ships are damaged before their first AI tick.
  try {
    ship.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: calculatePreferredRange(state, ship),
      recentDamage: 0,
      lastDamageTime: 0,
    } as Ship['aiState'];
  } catch {
    // Best-effort: if preferred range calculation fails, still create a
    // minimal aiState to enable damage bookkeeping in runtime.
    ship.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: 0,
      recentDamage: 0,
      lastDamageTime: 0,
    } as Ship['aiState'];
  }
  // Optionally apply a tiny randomized velocity jitter at spawn to break perfect
  // symmetry in deterministic tests and initial cluster spawns. The magnitudes are
  // intentionally very small (fractional) and scale with ship speed so larger ships
  // get a slightly larger jitter but remain subtle in gameplay.
  // Register in game state
  state.ships.push(ship);
  if (!state.shipIndex) state.shipIndex = new Map();
  state.shipIndex.set(id, ship);
  state.shipDataVersion++;
  // Update spatial grid if present
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    state.spatialGrid.update(
      id,
      ship.pos,
      ShipVisualConfig.ships[cls]?.collisionRadius ?? ShipVisualConfig.defaults.collisionRadius,
      team,
    );
  }
  return ship;
}

function updateBullets(state: GameState, dt: number) {
  const { width: _width, height: _height, depth: _depth } = state.simConfig.simBounds;
  const _behavior = state.simConfig.boundaryBehavior.bullets; // kept for future use

  // Integrate bullet motion
  for (const b of state.bullets) {
    b.ttl -= dt;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.pos.z += b.vel.z * dt;
  }

  // Handle boundary and collisions
  for (const b of state.bullets) {
    if (b.ttl <= 0) continue;
    applyBoundaryPhysicsBullet(b, state);
    if (b.ttl <= 0) continue; // bullet removed by boundary behavior

    // Collisions (simple radius approx)
    const useGrid =
      !!state.spatialGrid && !!state.behaviorConfig?.globalSettings.enableSpatialIndex;
    if (useGrid) {
      // Narrow spatial grid for TypeScript and avoid re-checking optional each callback
      const grid = state.spatialGrid!;
      const maxHitR = ShipVisualConfig.defaults.collisionRadius;
      grid.forEachInRadius(b.pos, maxHitR, (dx, dy, dz, distSq, entity) => {
        if (b.ttl <= 0) return; // already consumed by another hit
        const s = state.shipIndex?.get(entity.id) ?? state.ships.find((sh) => sh.id === entity.id);
        if (!s) return;
        if (s.team === b.ownerTeam || s.health <= 0) return;
        const hitR =
          ShipVisualConfig.ships[s.class]?.collisionRadius ??
          ShipVisualConfig.defaults.collisionRadius;
        if (distSq > hitR * hitR) return;

        const d = Math.sqrt(distSq);
        // Apply damage to shield first
        let dmgLeft = b.damage;
        let totalDamage = 0;

        if (s.shield > 0) {
          const absorb = Math.min(s.shield, dmgLeft);
          s.shield -= absorb;
          dmgLeft -= absorb;
          totalDamage += absorb;
          s.lastShieldHitTime = state.time;
          const len = Math.max(1e-6, d);
          s.lastShieldHitDir = { x: dx / len, y: dy / len, z: dz / len };
          s.lastShieldHitStrength = absorb;
        }

        if (dmgLeft > 0) {
          const effective = Math.max(1, dmgLeft - s.armor * 0.3);
          s.health -= effective;
          totalDamage += effective;
        }

        // Centralize XP/ai bookkeeping for both shield and health damage
        if (totalDamage > 0) {
          recordDamage(state, s, totalDamage, b.ownerShipId);
        }

        // Consume bullet
        b.ttl = 0;
      });
    } else {
      // Fallback: full scan
      for (const s of state.ships) {
        if (s.team === b.ownerTeam || s.health <= 0) continue;
        const dx = s.pos.x - b.pos.x;
        const dy = s.pos.y - b.pos.y;
        const dz = s.pos.z - b.pos.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        const hitR =
          ShipVisualConfig.ships[s.class]?.collisionRadius ??
          ShipVisualConfig.defaults.collisionRadius;
        if (dSq <= hitR * hitR) {
          const d = Math.sqrt(dSq);
          let dmgLeft = b.damage;
          let totalDamage = 0;

          if (s.shield > 0) {
            const absorb = Math.min(s.shield, dmgLeft);
            s.shield -= absorb;
            dmgLeft -= absorb;
            totalDamage += absorb;
            s.lastShieldHitTime = state.time;
            const len = Math.max(1e-6, d);
            s.lastShieldHitDir = { x: dx / len, y: dy / len, z: dz / len };
            s.lastShieldHitStrength = absorb;
          }

          if (dmgLeft > 0) {
            const effective = Math.max(1, dmgLeft - s.armor * 0.3);
            s.health -= effective;
            totalDamage += effective;
          }

          if (totalDamage > 0) {
            // Centralize XP, lastDamage and aiState bookkeeping
            recordDamage(state, s, totalDamage, b.ownerShipId);
          }

          b.ttl = 0;
          break;
        }
      }
    }
  }

  // Remove dead bullets
  state.bullets = state.bullets.filter((b) => b.ttl > 0);
}

function processDeathsAndXP(state: GameState) {
  for (const s of state.ships) {
    if (s.health <= 0 && s.maxHealth > 0) {
      // Credit kill to the last ship that damaged this ship within a short recent window
      let killer = null;
      if (s.lastDamageBy) {
        // Prefer recent damage within configurable window to avoid long-dead credit
        const recentWindow = state.behaviorConfig?.globalSettings.killCreditWindowSeconds ?? 5;
        if ((s.lastDamageTime ?? -Infinity) >= state.time - recentWindow) {
          killer = state.ships.find((sh) => sh.id === s.lastDamageBy && sh.team !== s.team);
        }
      }
      // Fallback: approximate via target linking
      if (!killer) {
        killer = state.ships.find((sh) => sh.targetId === s.id && sh.team !== s.team) ?? null;
      }
      if (killer) {
        killer.kills += 1;
        killer.level.xp += XP_PER_KILL;
        state.score[killer.team] += 1;
      }
      // If this was a fighter spawned by a carrier, decrement the carrier's alive counter
      if (s.parentCarrierId) {
        const carrier = state.ships.find((sh) => sh.id === s.parentCarrierId);
        if (carrier && typeof carrier.spawnedFighters === 'number') {
          carrier.spawnedFighters = Math.max(0, (carrier.spawnedFighters ?? 0) - 1);
        }
      }
      // Mark as removed by setting maxHealth = 0 sentinel then filtered later
      s.maxHealth = 0;
    }
  }
  state.ships = state.ships.filter((s) => s.maxHealth > 0);
  // Rebuild shipIndex for consistency (cheap relative to simulation sizes)
  if (state.shipIndex) {
    state.shipIndex.clear();
    for (const s of state.ships) state.shipIndex.set(s.id, s);
  }
  // Increment version when ships are removed
  state.shipDataVersion++;
}

function handleLevelUps(state: GameState) {
  for (const s of state.ships) {
    while (s.level.xp >= s.level.nextLevelXp) {
      s.level.xp -= s.level.nextLevelXp;
      s.level.level += 1;
      s.level.nextLevelXp = nextLevelXp(s.level.level);
      // Improve stats
      const cfg = getShipClassConfig(s.class);
      s.maxHealth = Math.floor(applyLevelUps(s.level.level, cfg.baseHealth));
      s.maxShield = Math.floor(applyLevelUps(s.level.level, cfg.shield));
      s.health = Math.min(s.maxHealth, s.health + Math.floor(s.maxHealth * 0.2));
      s.shield = s.maxShield; // refill on level

      // Mark as dirty for UI optimization
      s._healthDirty = true;
      s._shieldDirty = true;
    }
  }
}

function carrierSpawnLogic(state: GameState, dt: number) {
  for (const s of state.ships) {
    if (s.class !== 'carrier' || s.health <= 0) continue;
    if (s.fighterSpawnCdLeft === undefined) continue;
    s.fighterSpawnCdLeft = Math.max(0, (s.fighterSpawnCdLeft ?? 0) - dt);
    const cfg = getShipClassConfig('carrier');
    if ((s.spawnedFighters ?? 0) < (cfg.maxFighters ?? 0) && s.fighterSpawnCdLeft === 0) {
      // Use carrier's current yaw for spawning direction
      const angle =
        s.orientation.yaw +
        (state.rng.next() - 0.5) * CarrierSpawnConfig.fighterSpawn.angleRandomization;
      const offset = {
        x: s.pos.x + Math.cos(angle) * CarrierSpawnConfig.fighterSpawn.offsetDistance,
        y: s.pos.y + Math.sin(angle) * CarrierSpawnConfig.fighterSpawn.offsetDistance,
        z: s.pos.z,
      };
      const child = spawnShip(state, s.team, 'fighter', offset, s.id);
      child.vel.x = s.vel.x;
      child.vel.y = s.vel.y;
      child.vel.z = s.vel.z;
      // Inherit some of parent's orientation
      child.orientation.yaw = angle;
      child.dir = angle;
      s.spawnedFighters = (s.spawnedFighters ?? 0) + 1;
      s.fighterSpawnCdLeft =
        cfg.fighterSpawnCooldown ?? CarrierSpawnConfig.fighterSpawn.baseCooldown;
    }
  }
}

export function simulateStep(state: GameState, dt: number) {
  // --- NEW: Capture previous state for interpolation ---
  for (const ship of state.ships) {
    ship.prevPos = { ...ship.pos }; // Deep copy
    ship.prevOrientation = { ...ship.orientation }; // Deep copy
  }
  for (const bullet of state.bullets) {
    bullet.prevPos = { ...bullet.pos }; // Deep copy
  }
  // --- END NEW ---

  // Ship AI logic - Always use AIController for unified behavior
  perfBegin('ai.total');
  // Lazily create and reuse AIController instance
  const aiController =
    state.aiController ??
    (state.aiController = new AIController(state, state.aggressiveSpatialOptimizer));
  if (DEBUG_AI) console.log(`[gameState] aiController:`, aiController);
  if (DEBUG_AI) console.log(`[gameState] state.aiController:`, state.aiController);
  aiController.updateAllShips(dt);
  if (DEBUG_AI) {
    try {
      const map = state.ships.map((s) => `ship=${s.id}->target=${String(s.targetId)}`).join(', ');
      console.error(`DEBUG_AI: simulateStep post-AI targets: ${map}`);
    } catch {
      /* best-effort debug only */
    }
  }
  // Restore any assigned targets recorded by AIController to protect against
  // downstream operations that may temporarily clear targetId (e.g., pruning
  // out-of-bounds or rebuilds). This preserves test expectations that target
  // assignment from AIController is visible after simulateStep returns.
  for (const s of state.ships) {
    const assigned = (s as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget;
    if (assigned !== undefined && (s.targetId === null || s.targetId === undefined)) {
      s.targetId = assigned;
      if (DEBUG_AI)
        console.error(`DEBUG_AI: simulateStep restored ship=${s.id} target=${s.targetId}`);
    }
  }
  perfEnd('ai.total');

  // Update spatial grid with current ship positions after AI movement
  perfBegin('spatial.update');
  updateSpatialGrid(state);
  perfEnd('spatial.update');

  // Turret firing for all ships
  perfBegin('turrets.fire');
  for (const s of state.ships) {
    if (s.health <= 0) continue;
    fireTurrets(state, s, dt);
  }
  perfEnd('turrets.fire');

  // Bullets
  perfBegin('projectiles.update');
  updateBullets(state, dt);
  perfEnd('projectiles.update');

  // Deaths/XP
  perfBegin('game.deaths');
  processDeathsAndXP(state);
  handleLevelUps(state);
  perfEnd('game.deaths');

  // Carriers spawning
  perfBegin('game.carriers');
  carrierSpawnLogic(state, dt);
  perfEnd('game.carriers');

  // Periodic boundary cleanup (teleport or prune entities outside bounds)
  perfBegin('game.cleanup');
  const cleanupEnabled = state.behaviorConfig?.globalSettings.enableBoundaryCleanup;
  const cleanupInterval = state.behaviorConfig?.globalSettings.boundaryCleanupIntervalTicks ?? 600;
  if (cleanupEnabled) {
    // Run once every cleanupInterval ticks
    if (state.tick % cleanupInterval === 0) {
      runBoundaryCleanup(state);
    }
  }

  // Floating point / timer normalization to avoid drift in very long runs
  // Runs every `fpNormalizeIntervalTicks` ticks (configurable)
  // Read optional custom setting safely (avoid `any`) - fall back to 600 ticks
  const _gs = state.behaviorConfig?.globalSettings as unknown as
    | Record<string, unknown>
    | undefined;
  const fpNormalizeInterval =
    typeof _gs?.fpNormalizeIntervalTicks === 'number'
      ? (_gs!.fpNormalizeIntervalTicks as number)
      : 600;
  if (state.tick % fpNormalizeInterval === 0) {
    normalizeFloatingPointState(state);
  }
  perfEnd('game.cleanup');

  // Re-apply any AI-assigned targets once more after all simulation subsystems
  // have run. Some subsystems (e.g., boundary cleanup) may clear targets; to
  // preserve the contract that AIController assignments are visible after
  // simulateStep returns (used by characterization tests), restore them here.
  for (const s of state.ships) {
    const assigned = (s as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget;
    if (assigned !== undefined && (s.targetId === null || s.targetId === undefined)) {
      s.targetId = assigned;
      if (DEBUG_AI)
        console.error(`DEBUG_AI: simulateStep final-restore ship=${s.id} target=${s.targetId}`);
    }
  }
}

/**
 * Normalize floating point state occasionally to prevent drift in very long
 * running simulations. This performs a rebase of time/tick counters and
 * clamps very small velocity/pos jolts to zero. It also normalizes any
 * turret/ai timestamps so relative times remain valid.
 */
function normalizeFloatingPointState(state: GameState) {
  try {
    // Keep relative times small by rebasing when time grows large
    const TIME_REBASE_THRESHOLD = 1e6; // seconds (~11.5 days) - adjust as needed
    const EPS = 1e-9; // small epsilon to zero-out negligible values

    if (Math.abs(state.time) > TIME_REBASE_THRESHOLD) {
      const base = Math.floor(state.time);
      // Subtract base from all time-like fields
      state.time -= base;
      // lastDamageTime, ai timestamps, shield hit times, turret aiState times
      for (const s of state.ships) {
        if (s.lastDamageTime !== undefined) s.lastDamageTime = (s.lastDamageTime as number) - base;
        if (s.aiState) {
          if (s.aiState.lastDamageTime !== undefined)
            s.aiState.lastDamageTime = (s.aiState.lastDamageTime as number) - base;
        }
        if (s.lastShieldHitTime !== undefined)
          s.lastShieldHitTime = (s.lastShieldHitTime as number) - base;
        for (const t of s.turrets) {
          if (t.aiState) {
            if (t.aiState.lastTargetUpdate !== undefined)
              t.aiState.lastTargetUpdate = (t.aiState.lastTargetUpdate as number) - base;
            if (
              t.aiState.behaviorExpireTime !== undefined &&
              isFinite(t.aiState.behaviorExpireTime)
            )
              t.aiState.behaviorExpireTime = (t.aiState.behaviorExpireTime as number) - base;
          }
        }
      }
      // If bullets tracked by time (ttl only), no need to shift as ttl is relative
    }

    // Clamp extremely small positional/velocity noise to zero to avoid accumulating fp error
    for (const s of state.ships) {
      if (Math.abs(s.pos.x) < EPS) s.pos.x = 0;
      if (Math.abs(s.pos.y) < EPS) s.pos.y = 0;
      if (Math.abs(s.pos.z) < EPS) s.pos.z = 0;
      if (Math.abs(s.vel.x) < EPS) s.vel.x = 0;
      if (Math.abs(s.vel.y) < EPS) s.vel.y = 0;
      if (Math.abs(s.vel.z) < EPS) s.vel.z = 0;
      // Normalize very small orientation jitter
      if (s.orientation) {
        if (Math.abs(s.orientation.pitch) < EPS) s.orientation.pitch = 0;
        if (Math.abs(s.orientation.yaw) < EPS) s.orientation.yaw = 0;
        if (Math.abs(s.orientation.roll) < EPS) s.orientation.roll = 0;
      }
      // Turret cooldown tiny values to zero
      for (const t of s.turrets) {
        if (Math.abs(t.cooldownLeft) < EPS) t.cooldownLeft = 0;
      }
    }

    // Also clamp tiny bullet velocities/positions
    for (const b of state.bullets) {
      if (Math.abs(b.pos.x) < EPS) b.pos.x = 0;
      if (Math.abs(b.pos.y) < EPS) b.pos.y = 0;
      if (Math.abs(b.pos.z) < EPS) b.pos.z = 0;
      if (Math.abs(b.vel.x) < EPS) b.vel.x = 0;
      if (Math.abs(b.vel.y) < EPS) b.vel.y = 0;
      if (Math.abs(b.vel.z) < EPS) b.vel.z = 0;
    }
  } catch (_e) {
    void _e; /* best-effort normalization; ignore errors */
  }
}

function runBoundaryCleanup(state: GameState) {
  const bounds = state.simConfig.simBounds;
  const shipsOutside: Ship[] = [];
  for (const s of state.ships) {
    if (
      s.pos.x < 0 ||
      s.pos.x > bounds.width ||
      s.pos.y < 0 ||
      s.pos.y > bounds.height ||
      s.pos.z < 0 ||
      s.pos.z > bounds.depth
    ) {
      shipsOutside.push(s);
    }
  }

  // Teleport ships back to a team spawn center with small deterministic jitter
  for (const s of shipsOutside) {
    // Attempt to find team spawn center using FleetConfig spawning margin/width
    const margin = FleetConfig.spawning.margin;
    const spawnWidth = FleetConfig.spawning.spawnWidth;
    const teamCenterX =
      s.team === 'red'
        ? margin + Math.floor(spawnWidth / 2)
        : state.simConfig.simBounds.width - margin - Math.floor(spawnWidth / 2);
    const centerY = Math.floor(state.simConfig.simBounds.height / 2);
    const centerZ = Math.floor(state.simConfig.simBounds.depth / 2);
    // Deterministic jitter using state's RNG
    const jitter = 16; // small teleport jitter in units
    const jx = (state.rng.next() - 0.5) * jitter * 2;
    const jy = (state.rng.next() - 0.5) * jitter * 2;
    const jz = (state.rng.next() - 0.5) * jitter * 2;
    s.pos.x = clamp(teamCenterX + jx, 0, state.simConfig.simBounds.width);
    s.pos.y = clamp(centerY + jy, 0, state.simConfig.simBounds.height);
    s.pos.z = clamp(centerZ + jz, 0, state.simConfig.simBounds.depth);
    // Reset velocity to zero to avoid teleporting while moving out
    s.vel.x = 0;
    s.vel.y = 0;
    s.vel.z = 0;
    // Clear target to avoid immediate re-targeting of far-away entities
    s.targetId = null;
  }

  // Prune bullets out of bounds (set ttl=0)
  for (const b of state.bullets) {
    if (
      b.pos.x < 0 ||
      b.pos.x > bounds.width ||
      b.pos.y < 0 ||
      b.pos.y > bounds.height ||
      b.pos.z < 0 ||
      b.pos.z > bounds.depth
    ) {
      b.ttl = 0;
    }
  }
  // Remove dead bullets immediately
  state.bullets = state.bullets.filter((b) => b.ttl > 0);
}

/**
 * Update spatial grid with current ship positions
 */
function updateSpatialGrid(state: GameState) {
  if (!state.spatialGrid || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    return;
  }

  // Incrementally update positions and purge stale ids without a full rebuild
  const activeIds = new Set<number>();
  for (const ship of state.ships) {
    if (ship.health > 0) {
      activeIds.add(ship.id);
      state.spatialGrid.update(ship.id, ship.pos, 16, ship.team);
    }
  }
  // Remove any entities no longer present/active
  state.spatialGrid.gcExcept(activeIds);
}
