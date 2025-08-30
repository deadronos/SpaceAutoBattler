import type { GameState, Ship, ShipClass, Team, Vector3, EntityId, Bullet, TurretState } from '../types/index.js';
import { DefaultSimConfig } from '../config/simConfig.js';
import { SHIP_CLASS_CONFIGS, getShipClassConfig } from '../config/entitiesConfig.js';
import { createRNG } from '../utils/rng.js';
import { nextLevelXp, XP_PER_DAMAGE, XP_PER_KILL, applyLevelUps } from '../config/progression.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../config/behaviorConfig.js';
import { AIController } from './aiController.js';
import { FleetConfig } from '../config/fleetConfig.js';
import { PhysicsConfig } from '../config/physicsConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { CarrierSpawnConfig } from '../config/carrierSpawnConfig.js';
import { lookAt, getForwardVector, angleDifference, clampTurn } from '../utils/vector3.js';
import { SpatialGrid } from '../utils/spatialGrid.js';

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
    state.spatialGrid = new SpatialGrid(64, bounds);
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
    state.spatialGrid = new SpatialGrid(64, bounds);
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
  const turrets: TurretState[] = cfg.turrets.map((t, i) => ({ id: `${t.id}-${i}`, cooldownLeft: 0 }));
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

function findNearestEnemy(state: GameState, ship: Ship): Ship | undefined {
  let best: Ship | undefined; let bestD = Infinity;
  for (const s of state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const dx = s.pos.x - ship.pos.x; const dy = s.pos.y - ship.pos.y; const dz = s.pos.z - ship.pos.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 < bestD) { bestD = d2; best = s; }
  }
  return best;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Apply boundary physics to a ship based on simulation configuration
 * This handles bounce, wrap, and remove behaviors consistently across AI systems
 */
export function applyBoundaryPhysics(ship: Ship, state: GameState) {
  const bounds = state.simConfig.simBounds;
  const behavior = state.simConfig.boundaryBehavior.ships;

  if (behavior === 'bounce') {
    // Bounce off boundaries
    if (ship.pos.x < 0) { ship.pos.x = 0; ship.vel.x = -ship.vel.x; }
    else if (ship.pos.x > bounds.width) { ship.pos.x = bounds.width; ship.vel.x = -ship.vel.x; }
    if (ship.pos.y < 0) { ship.pos.y = 0; ship.vel.y = -ship.vel.y; }
    else if (ship.pos.y > bounds.height) { ship.pos.y = bounds.height; ship.vel.y = -ship.vel.y; }
    if (ship.pos.z < 0) { ship.pos.z = 0; ship.vel.z = -ship.vel.z; }
    else if (ship.pos.z > bounds.depth) { ship.pos.z = bounds.depth; ship.vel.z = -ship.vel.z; }
  } else if (behavior === 'wrap') {
    // Wrap around boundaries
    if (ship.pos.x < 0) ship.pos.x += bounds.width;
    else if (ship.pos.x > bounds.width) ship.pos.x -= bounds.width;
    if (ship.pos.y < 0) ship.pos.y += bounds.height;
    else if (ship.pos.y > bounds.height) ship.pos.y -= bounds.height;
    if (ship.pos.z < 0) ship.pos.z += bounds.depth;
    else if (ship.pos.z > bounds.depth) ship.pos.z -= bounds.depth;
  } else if (behavior === 'remove') {
    // Remove ships that go out of bounds
    if (ship.pos.x < 0 || ship.pos.x > bounds.width ||
        ship.pos.y < 0 || ship.pos.y > bounds.height ||
        ship.pos.z < 0 || ship.pos.z > bounds.depth) {
      ship.health = 0; // Mark for removal
    }
  }
}

function stepShipAI(state: GameState, ship: Ship, dt: number) {
  // Legacy AI: Use AIController with simple pursue behavior
  // This ensures all movement logic is unified through AIController
  
  // Initialize basic AI state if needed for AIController compatibility
  if (!ship.aiState) {
    ship.aiState = {
      currentIntent: 'pursue',
      intentEndTime: state.time + 1.0, // Short duration to re-evaluate frequently
      lastIntentReevaluation: 0,
      preferredRange: 100, // Basic range
      recentDamage: 0,
      lastDamageTime: 0
    };
  }

  // Acquire target using simple logic
  if (!ship.targetId || !state.ships.find(s => s.id === ship.targetId && s.health > 0)) {
    const t = findNearestEnemy(state, ship);
    ship.targetId = t?.id ?? null;
  }

  // Use AIController for all movement and physics
  // Create a temporary minimal behavior config for legacy mode
  const legacyBehaviorConfig = { 
    ...DEFAULT_BEHAVIOR_CONFIG,
    // Override to ensure simple behavior
    defaultPersonality: {
      ...DEFAULT_BEHAVIOR_CONFIG.defaultPersonality,
      mode: 'aggressive' as const, // Simple pursue mode
      intentReevaluationRate: 0.5,
      minIntentDuration: 0.5,
      maxIntentDuration: 1.0
    }
  };

  // Store original config and temporarily use legacy config
  const originalConfig = state.behaviorConfig;
  state.behaviorConfig = legacyBehaviorConfig;
  
  // Use AIController for unified movement logic
  // Reuse a single AIController instance to avoid per-tick allocations
  const aiController = state.aiController ?? (state.aiController = new AIController(state));
  
  // Force simple pursue intent for consistent legacy behavior
  ship.aiState.currentIntent = 'pursue';
  ship.aiState.intentEndTime = state.time + 0.5;
  
  // Delegate to AIController
  aiController.updateShipAI(ship, dt);
  
  // Restore original config
  state.behaviorConfig = originalConfig;

  // Regen shields (AIController doesn't handle this currently)
  ship.shield = clamp(ship.shield + ship.shieldRegen * dt, 0, ship.maxShield);
}

function fireTurrets(state: GameState, ship: Ship, dt: number) {
  const target = ship.targetId ? state.ships.find(s => s.id === ship.targetId!) : undefined;
  for (const t of ship.turrets) {
    t.cooldownLeft = Math.max(0, t.cooldownLeft - dt);
  }
  if (!target) return;
  const cfg = getShipClassConfig(ship.class);
  const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dz = target.pos.z - ship.pos.z;
  const dist = Math.hypot(dx, dy, dz);
  for (let i = 0; i < ship.turrets.length; i++) {
    const tState = ship.turrets[i];
    const tCfg = cfg.turrets[i % cfg.turrets.length];
    if (tState.cooldownLeft > 0) continue;
    if (dist > tCfg.range) continue;
    // Fire: create bullet towards target
    const id = state.nextId++;
    const dir = Math.atan2(dy, dx);
    const speed = tCfg.bulletSpeed;
    const bullet: Bullet = {
      id,
      ownerShipId: ship.id,
      ownerTeam: ship.team,
      pos: { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z },
      vel: { x: Math.cos(dir) * speed, y: Math.sin(dir) * speed, z: 0 },
      ttl: 3,
      damage: tCfg.damage,
    };
    state.bullets.push(bullet);
    tState.cooldownLeft = tCfg.cooldown;
  }
}

function updateBullets(state: GameState, dt: number) {
  const { width, height, depth } = state.simConfig.simBounds;
  const behavior = state.simConfig.boundaryBehavior.bullets;

  for (const b of state.bullets) {
    b.ttl -= dt;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.pos.z += b.vel.z * dt;
  }

  // Handle bullet boundary conditions
  for (const b of state.bullets) {
    if (b.ttl <= 0) continue;

    let outOfBounds = false;
    if (behavior === 'bounce') {
      // Bounce off boundaries
      if (b.pos.x < 0) { b.pos.x = 0; b.vel.x = -b.vel.x; }
      else if (b.pos.x > width) { b.pos.x = width; b.vel.x = -b.vel.x; }
      if (b.pos.y < 0) { b.pos.y = 0; b.vel.y = -b.vel.y; }
      else if (b.pos.y > height) { b.pos.y = height; b.vel.y = -b.vel.y; }
      if (b.pos.z < 0) { b.pos.z = 0; b.vel.z = -b.vel.z; }
      else if (b.pos.z > depth) { b.pos.z = depth; b.vel.z = -b.vel.z; }
    } else if (behavior === 'wrap') {
      // Wrap around boundaries
      if (b.pos.x < 0) b.pos.x += width;
      else if (b.pos.x > width) b.pos.x -= width;
      if (b.pos.y < 0) b.pos.y += height;
      else if (b.pos.y > height) b.pos.y -= height;
      if (b.pos.z < 0) b.pos.z += depth;
      else if (b.pos.z > depth) b.pos.z -= depth;
    } else if (behavior === 'remove') {
      // Remove bullets that go out of bounds
      if (b.pos.x < 0 || b.pos.x > width ||
          b.pos.y < 0 || b.pos.y > height ||
          b.pos.z < 0 || b.pos.z > depth) {
        outOfBounds = true;
      }
    }

    if (outOfBounds) {
      b.ttl = 0;
      continue;
    }

    // Collisions (simple radius approx)
    for (const s of state.ships) {
      if (s.team === b.ownerTeam || s.health <= 0) continue;
      const dx = s.pos.x - b.pos.x; const dy = s.pos.y - b.pos.y; const dz = s.pos.z - b.pos.z;
      const d = Math.hypot(dx, dy, dz);
      const hitR = ShipVisualConfig.ships[s.class]?.collisionRadius ?? 16;
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
  // Ship AI logic
  if (state.behaviorConfig?.globalSettings.aiEnabled) {
    // Use new AIController for advanced behavior
    // Lazily create and reuse AIController instance
    const aiController = state.aiController ?? (state.aiController = new AIController(state));
    aiController.updateAllShips(dt);
  } else {
    // Use simple AI for backward compatibility
    for (const s of state.ships) {
      if (s.health <= 0) continue;
      stepShipAI(state, s, dt);
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
