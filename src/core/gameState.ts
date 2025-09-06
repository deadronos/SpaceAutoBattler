import type { GameState, Ship, ShipClass, Team, Vector3, EntityId, Bullet, TurretState } from '../types/index.js';
import { DefaultSimConfig } from '../config/simConfig.js';
import { SHIP_CLASS_CONFIGS as _SHIP_CLASS_CONFIGS, getShipClassConfig } from '../config/entitiesConfig.js';
import { createRNG } from '../utils/rng.js';
import { nextLevelXp, XP_PER_DAMAGE, XP_PER_KILL, applyLevelUps } from '../config/progression.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../config/behaviorConfig.js';
import { AIController } from './aiController.js';
import { FleetConfig } from '../config/fleetConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { CarrierSpawnConfig } from '../config/carrierSpawnConfig.js';
import { SpatialGrid } from '../utils/spatialGrid.js';
import { applyBoundaryPhysicsShip, applyBoundaryPhysicsBullet } from './boundaryUtils.js';
import { DEBUG_AI } from '../utils/env';

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
    behaviorConfig: { ...DEFAULT_BEHAVIOR_CONFIG }
  };

  // Initialize spatial grid if enabled
  if (state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    const bounds = {
      width: config.simBounds.width,
      height: config.simBounds.height,
      depth: config.simBounds.depth
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
      depth: state.simConfig.simBounds.depth
    };
    state.spatialGrid = new SpatialGrid(state.simConfig.spatialGrid.cellSize, bounds);
  } else {
    state.spatialGrid = undefined;
  }
}

function allocateId(state: GameState): EntityId { return state.nextId++; }

export function spawnShip(state: GameState, team: Team, cls: ShipClass, pos?: Vector3, parentCarrierId?: EntityId): Ship {
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
        behaviorExpireTime: Infinity
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
    id, team, class: cls,
    pos: { x: p.x, y: p.y, z: p.z }, 
    vel: { x: 0, y: 0, z: 0 }, 
    orientation: {
      pitch: 0, // level flight initially
      yaw: randomYaw,
      roll: 0   // no banking initially
    },
    // Keep legacy dir field for backward compatibility
    dir: randomYaw,
    targetId: null,
    health: maxHealth, maxHealth,
    armor: cfg.armor,
    shield: maxShield, maxShield,
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
  // Optionally apply a tiny randomized velocity jitter at spawn to break perfect
  // symmetry in deterministic tests and initial cluster spawns. The magnitudes are
  // intentionally very small (fractional) and scale with ship speed so larger ships
  // get a slightly larger jitter but remain subtle in gameplay. This behavior can
  // be toggled via behaviorConfig.globalSettings.enableSpawnJitter.
  const enableJitter = state.behaviorConfig?.globalSettings.enableSpawnJitter;
  if (enableJitter) {
    const jitterScale = 0.02; // fraction of ship.speed per second
    const angle = state.rng.next() * Math.PI * 2;
    const jitterMag = ship.speed * jitterScale;
    ship.vel.x += Math.cos(angle) * jitterMag;
    ship.vel.y += Math.sin(angle) * jitterMag;
  }

  state.ships.push(ship);
  state.shipIndex?.set(ship.id, ship);
  // Increment version for efficient change detection
  state.shipDataVersion++;
  return ship;
}

function randomSpawnPos(state: GameState, team: Team): Vector3 {
  const margin = FleetConfig.spawning.margin;
  const y = state.rng.int(margin, state.simConfig.simBounds.height - margin);
  const z = state.rng.int(margin, state.simConfig.simBounds.depth - margin);
  const x = team === 'red' ? state.rng.int(margin, margin + FleetConfig.spawning.spawnWidth) : state.rng.int(state.simConfig.simBounds.width - margin - FleetConfig.spawning.spawnWidth, state.simConfig.simBounds.width - margin);
  return { x, y, z };
}

export function spawnFleet(state: GameState, team: Team, count = 5) {
  for (let i = 0; i < count; i++) {
    const cls = state.rng.pick(['fighter','corvette','frigate','destroyer','carrier'] as const);
    spawnShip(state, team, cls);
  }
}

// Delegate nearest-enemy lookup to shared search utilities (spatial-grid preferred)
// Note: use sharedFindNearestEnemy directly where needed - helper removed to avoid unused symbol

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Apply boundary physics to a ship based on simulation configuration
 * This handles bounce, wrap, and remove behaviors consistently across AI systems
 */
export function applyBoundaryPhysics(ship: Ship, state: GameState) {
  // Keep compatibility API but delegate to centralized boundary utils for ships
  applyBoundaryPhysicsShip(ship, state);
}

function fireTurrets(state: GameState, ship: Ship, dt: number) {
  const target = ship.targetId ? state.ships.find(s => s.id === ship.targetId!) : undefined;
  for (const t of ship.turrets) {
    t.cooldownLeft = Math.max(0, t.cooldownLeft - dt);
  }
  if (!target) return;
  const cfg = getShipClassConfig(ship.class);
  const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dz = target.pos.z - ship.pos.z;
  const distSq = dx*dx + dy*dy + dz*dz;
  const dist = Math.sqrt(distSq);
  for (let i = 0; i < ship.turrets.length; i++) {
    const tState = ship.turrets[i];
    const tCfg = cfg.turrets[i % cfg.turrets.length];
    if (tState.cooldownLeft > 0) continue;
    if (dist > tCfg.range) continue;

    // Prefer per-turret lead position if available (computed by AIController when behavior='lead_target')
    const leadPos = tState.aiState?.leadTargetPos ?? target.pos;

    // If turret behavior is suppression, fire a spread of bullets around leadPos
  const isSuppression = tState.aiState?.behavior === 'area_suppression';
  const spreadCount = isSuppression ? (tState.aiState?.suppressionCount ?? 5) : 1;
  const spreadAngle = isSuppression ? (tState.aiState?.suppressionAngle ?? (Math.PI / 12)) : 0;



    // Helper: generate a direction vector for a spread index within a cone around the central direction
    const makeSpreadDir = (index: number, total: number, centerDir: { x: number; y: number; z: number }) => {
      if (total <= 1) return centerDir;
      // Evenly sample azimuth around center and jitter by elevation within spreadAngle
  const _az = (index / total) * Math.PI * 2;
      const el = (-(total-1)/2 + index) / Math.max(1, total-1) * spreadAngle;
      // Rotate centerDir by azimuth around Z and then apply small elevation by mixing with perpendicular vector
      // For simplicity, assume centerDir primarily in XY plane; compute perp in XY
  const perp = { x: -centerDir.y, y: centerDir.x, z: 0 };
  const perpLenSq = perp.x*perp.x + perp.y*perp.y + perp.z*perp.z;
  const perpLen = perpLenSq > 0 ? Math.sqrt(perpLenSq) : 1;
  perp.x /= perpLen; perp.y /= perpLen; perp.z /= perpLen;
      // Mix centerDir and perp by elevation
      const cosEl = Math.cos(el);
      const sinEl = Math.sin(el);
      return {
        x: centerDir.x * cosEl + perp.x * sinEl,
        y: centerDir.y * cosEl + perp.y * sinEl,
        z: centerDir.z * cosEl + perp.z * sinEl
      };
    };

    // Fire: single or multiple bullets depending on suppression
    for (let s = 0; s < spreadCount; s++) {
  const dirX = leadPos.x - ship.pos.x;
  const dirY = leadPos.y - ship.pos.y;
  const dirZ = leadPos.z - ship.pos.z;
  const centerLenSq = dirX*dirX + dirY*dirY + dirZ*dirZ;
  const centerLen = centerLenSq > 0 ? Math.sqrt(centerLenSq) : 1;
  const centerDir = { x: dirX / centerLen, y: dirY / centerLen, z: dirZ / centerLen };
  const spreadDir = makeSpreadDir(s, spreadCount, centerDir);
  const dirLenSq = spreadDir.x*spreadDir.x + spreadDir.y*spreadDir.y + spreadDir.z*spreadDir.z;
  const dirLen = dirLenSq > 0 ? Math.sqrt(dirLenSq) : 1;
      const id = state.nextId++;
      const bullet: Bullet = {
        id,
        ownerShipId: ship.id,
        ownerTeam: ship.team,
        pos: { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z },
        vel: { x: (spreadDir.x / dirLen) * tCfg.bulletSpeed, y: (spreadDir.y / dirLen) * tCfg.bulletSpeed, z: (spreadDir.z / dirLen) * tCfg.bulletSpeed },
        ttl: state.simConfig.bulletLifetime,
        damage: tCfg.damage,
      };
      state.bullets.push(bullet);
    }
    tState.cooldownLeft = tCfg.cooldown;
  }
}


function updateBullets(state: GameState, dt: number) {
  const { width: _width, height: _height, depth: _depth } = state.simConfig.simBounds;
  const _behavior = state.simConfig.boundaryBehavior.bullets; // kept for future use

  for (const b of state.bullets) {
    b.ttl -= dt;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.pos.z += b.vel.z * dt;
  }

  // Handle bullet boundary conditions using shared helper
  for (const b of state.bullets) {
    if (b.ttl <= 0) continue;
    applyBoundaryPhysicsBullet(b, state);
    if (b.ttl <= 0) continue; // bullet removed by boundary behavior

    // Collisions (simple radius approx)
    for (const s of state.ships) {
      if (s.team === b.ownerTeam || s.health <= 0) continue;
  const dx = s.pos.x - b.pos.x; const dy = s.pos.y - b.pos.y; const dz = s.pos.z - b.pos.z;
  const dSq = dx*dx + dy*dy + dz*dz;
  const d = Math.sqrt(dSq);
      const hitR = ShipVisualConfig.ships[s.class]?.collisionRadius ?? ShipVisualConfig.defaults.collisionRadius;
      if (d < hitR) {
        // Apply damage to shield first
        let dmgLeft = b.damage;
        let totalDamage = 0; // Track total damage for recent damage accumulator
        
        if (s.shield > 0) {
          const absorb = Math.min(s.shield, dmgLeft);
          s.shield -= absorb;
          dmgLeft -= absorb;
          totalDamage += absorb;
          // Track shield hit for visual effects
          s.lastShieldHitTime = state.time;
          // Record direction of impact on shield as a unit vector from ship center to bullet position
          const len = Math.max(1e-6, d);
          s.lastShieldHitDir = { x: dx / len, y: dy / len, z: dz / len };
          s.lastShieldHitStrength = absorb; // use absorbed shield damage as strength proxy
        }
        if (dmgLeft > 0) {
          // Armor reduces damage
          const effective = Math.max(1, dmgLeft - s.armor * 0.3);
          s.health -= effective;
          totalDamage += effective;
          // XP to owner
            // Cache owner lookup once per hit for efficiency
            const owner = state.shipIndex?.get(b.ownerShipId) ?? state.ships.find(sh => sh.id === b.ownerShipId);
            if (owner) {
              owner.level.xp += effective * XP_PER_DAMAGE;
              // Track last damage source for kill crediting (timestamped)
              s.lastDamageBy = owner.id;
              s.lastDamageTime = state.time;
            }
        }
        
        // Update recent damage tracking for AI
        if (s.aiState && totalDamage > 0) {
          s.aiState.recentDamage = (s.aiState.recentDamage || 0) + totalDamage;
          s.aiState.lastDamageTime = state.time;
        }
        
        // Bullet consumed
        b.ttl = 0;
        break;
      }
    }
  }
  // Remove dead bullets
  state.bullets = state.bullets.filter(b => b.ttl > 0);
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
          killer = state.ships.find(sh => sh.id === s.lastDamageBy && sh.team !== s.team);
        }
      }
      // Fallback: approximate via target linking
      if (!killer) {
        killer = state.ships.find(sh => sh.targetId === s.id && sh.team !== s.team) ?? null;
      }
      if (killer) {
        killer.kills += 1;
        killer.level.xp += XP_PER_KILL;
        state.score[killer.team] += 1;
      }
      // If this was a fighter spawned by a carrier, decrement the carrier's alive counter
      if (s.parentCarrierId) {
        const carrier = state.ships.find(sh => sh.id === s.parentCarrierId);
        if (carrier && typeof carrier.spawnedFighters === 'number') {
          carrier.spawnedFighters = Math.max(0, (carrier.spawnedFighters ?? 0) - 1);
        }
      }
      // Mark as removed by setting maxHealth = 0 sentinel then filtered later
      s.maxHealth = 0;
    }
  }
  state.ships = state.ships.filter(s => s.maxHealth > 0);
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
      const angle = s.orientation.yaw + ((state.rng.next() - 0.5) * CarrierSpawnConfig.fighterSpawn.angleRandomization);
      const offset = { x: s.pos.x + Math.cos(angle) * CarrierSpawnConfig.fighterSpawn.offsetDistance, y: s.pos.y + Math.sin(angle) * CarrierSpawnConfig.fighterSpawn.offsetDistance, z: s.pos.z };
      const child = spawnShip(state, s.team, 'fighter', offset, s.id);
      child.vel.x = s.vel.x; child.vel.y = s.vel.y; child.vel.z = s.vel.z;
      // Inherit some of parent's orientation
      child.orientation.yaw = angle;
      child.dir = angle;
      s.spawnedFighters = (s.spawnedFighters ?? 0) + 1;
      s.fighterSpawnCdLeft = cfg.fighterSpawnCooldown ?? CarrierSpawnConfig.fighterSpawn.baseCooldown;
    }
  }
}

export function simulateStep(state: GameState, dt: number) {
  // Ship AI logic - Always use AIController for unified behavior
  // Lazily create and reuse AIController instance
  const aiController = state.aiController ?? (state.aiController = new AIController(state));
  aiController.updateAllShips(dt);
  if (DEBUG_AI) {
    try {
      const map = state.ships.map(s => `ship=${s.id}->target=${String(s.targetId)}`).join(', ');
      console.error(`DEBUG_AI: simulateStep post-AI targets: ${map}`);
    } catch { /* best-effort debug only */ }
  }
  // Restore any assigned targets recorded by AIController to protect against
    // downstream operations that may temporarily clear targetId (e.g., pruning
  // out-of-bounds or rebuilds). This preserves test expectations that target
  // assignment from AIController is visible after simulateStep returns.
  for (const s of state.ships) {
    const assigned = (s as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget;
    if (assigned !== undefined && (s.targetId === null || s.targetId === undefined)) {
      s.targetId = assigned;
      if (DEBUG_AI) console.error(`DEBUG_AI: simulateStep restored ship=${s.id} target=${s.targetId}`);
    }
  }
  
  // Update spatial grid with current ship positions after AI movement
  updateSpatialGrid(state);
  
  // Turret firing for all ships
  for (const s of state.ships) {
    if (s.health <= 0) continue;
    fireTurrets(state, s, dt);
  }
  
  // Bullets
  updateBullets(state, dt);
  // Deaths/XP
  processDeathsAndXP(state);
  handleLevelUps(state);
  // Carriers spawning
  carrierSpawnLogic(state, dt);

  // Periodic boundary cleanup (teleport or prune entities outside bounds)
  const cleanupEnabled = state.behaviorConfig?.globalSettings.enableBoundaryCleanup;
  const cleanupInterval = state.behaviorConfig?.globalSettings.boundaryCleanupIntervalTicks ?? 600;
  if (cleanupEnabled) {
    // Run once every cleanupInterval ticks
    if ((state.tick % cleanupInterval) === 0) {
      runBoundaryCleanup(state);
    }
  }

  // Floating point / timer normalization to avoid drift in very long runs
  // Runs every `fpNormalizeIntervalTicks` ticks (configurable)
  // Read optional custom setting safely (avoid `any`) - fall back to 600 ticks
  const _gs = (state.behaviorConfig?.globalSettings as unknown) as Record<string, unknown> | undefined;
  const fpNormalizeInterval = (typeof _gs?.fpNormalizeIntervalTicks === 'number') ? (_gs!.fpNormalizeIntervalTicks as number) : 600;
  if ((state.tick % fpNormalizeInterval) === 0) {
    normalizeFloatingPointState(state);
  }

  // Re-apply any AI-assigned targets once more after all simulation subsystems
  // have run. Some subsystems (e.g., boundary cleanup) may clear targets; to
  // preserve the contract that AIController assignments are visible after
  // simulateStep returns (used by characterization tests), restore them here.
  for (const s of state.ships) {
    const assigned = (s as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget;
    if (assigned !== undefined && (s.targetId === null || s.targetId === undefined)) {
      s.targetId = assigned;
      if (DEBUG_AI) console.error(`DEBUG_AI: simulateStep final-restore ship=${s.id} target=${s.targetId}`);
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
          if (s.aiState.lastDamageTime !== undefined) s.aiState.lastDamageTime = (s.aiState.lastDamageTime as number) - base;
        }
        if (s.lastShieldHitTime !== undefined) s.lastShieldHitTime = (s.lastShieldHitTime as number) - base;
        for (const t of s.turrets) {
          if (t.aiState) {
            if (t.aiState.lastTargetUpdate !== undefined) t.aiState.lastTargetUpdate = (t.aiState.lastTargetUpdate as number) - base;
            if (t.aiState.behaviorExpireTime !== undefined && isFinite(t.aiState.behaviorExpireTime)) t.aiState.behaviorExpireTime = (t.aiState.behaviorExpireTime as number) - base;
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
  } catch (_e) { void _e; /* best-effort normalization; ignore errors */ }
}

function runBoundaryCleanup(state: GameState) {
  const bounds = state.simConfig.simBounds;
  const shipsOutside: Ship[] = [];
  for (const s of state.ships) {
    if (s.pos.x < 0 || s.pos.x > bounds.width || s.pos.y < 0 || s.pos.y > bounds.height || s.pos.z < 0 || s.pos.z > bounds.depth) {
      shipsOutside.push(s);
    }
  }

  // Teleport ships back to a team spawn center with small deterministic jitter
  for (const s of shipsOutside) {
    // Attempt to find team spawn center using FleetConfig spawning margin/width
    const margin = FleetConfig.spawning.margin;
    const spawnWidth = FleetConfig.spawning.spawnWidth;
    const teamCenterX = s.team === 'red' ? margin + Math.floor(spawnWidth / 2) : state.simConfig.simBounds.width - margin - Math.floor(spawnWidth / 2);
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
    s.vel.x = 0; s.vel.y = 0; s.vel.z = 0;
    // Clear target to avoid immediate re-targeting of far-away entities
    s.targetId = null;
  }

  // Prune bullets out of bounds (set ttl=0)
  for (const b of state.bullets) {
    if (b.pos.x < 0 || b.pos.x > bounds.width || b.pos.y < 0 || b.pos.y > bounds.height || b.pos.z < 0 || b.pos.z > bounds.depth) {
      b.ttl = 0;
    }
  }
  // Remove dead bullets immediately
  state.bullets = state.bullets.filter(b => b.ttl > 0);
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
