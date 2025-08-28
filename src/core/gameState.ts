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

export function createInitialState(seed?: string): GameState {
  const config = { ...DefaultSimConfig };
  if (seed) {
    config.seed = seed;
  } else if (config.useTimeBasedSeed) {
    config.seed = `SPACE-${Date.now()}`;
  }

  const rng = createRNG(config.seed);
  return {
    time: 0,
    tick: 0,
    running: false,
    speedMultiplier: 1,
    rng,
    nextId: 1,
    simConfig: config,
    ships: [],
    bullets: [],
    score: { red: 0, blue: 0 },
    behaviorConfig: { ...DEFAULT_BEHAVIOR_CONFIG }
  };
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
  state.bullets = [];
  state.score = { red: 0, blue: 0 };
  // Reset behavior config to defaults
  state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
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
  const ship: Ship = {
    id, team, class: cls,
    pos: { x: p.x, y: p.y, z: p.z }, vel: { x: 0, y: 0, z: 0 }, dir: state.rng.next() * Math.PI * 2,
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
  state.ships.push(ship);
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

function stepShipAI(state: GameState, ship: Ship, dt: number) {
  // Acquire target
  if (!ship.targetId || !state.ships.find(s => s.id === ship.targetId && s.health > 0)) {
    const t = findNearestEnemy(state, ship);
    ship.targetId = t?.id ?? null;
  }
  const target = ship.targetId ? state.ships.find(s => s.id === ship.targetId!) : undefined;
  if (target) {
    const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dz = target.pos.z - ship.pos.z;
    const desired = Math.atan2(dy, dx); // Keep 2D direction for now, but could extend to 3D
    let diff = desired - ship.dir;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    const turn = clamp(diff, -ship.turnRate*dt, ship.turnRate*dt);
    ship.dir += turn;

    // Move towards target with simple acceleration (3D)
    const ax = Math.cos(ship.dir) * ship.speed * PhysicsConfig.acceleration.forwardMultiplier;
    const ay = Math.sin(ship.dir) * ship.speed * PhysicsConfig.acceleration.forwardMultiplier;
    const az = (target.pos.z - ship.pos.z) * PhysicsConfig.acceleration.zAxisMultiplier; // Simple z-axis movement towards target
    ship.vel.x += ax * dt;
    ship.vel.y += ay * dt;
    ship.vel.z += az * dt;
  }

  // Damp and clamp speed
  ship.vel.x *= PhysicsConfig.speed.dampingFactor;
  ship.vel.y *= PhysicsConfig.speed.dampingFactor;
  ship.vel.z *= PhysicsConfig.speed.dampingFactor;
  const maxV = ship.speed * PhysicsConfig.speed.maxSpeedMultiplier;
  const v = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
  if (v > maxV) {
    ship.vel.x = (ship.vel.x / v) * maxV;
    ship.vel.y = (ship.vel.y / v) * maxV;
    ship.vel.z = (ship.vel.z / v) * maxV;
  }

  // Integrate position
  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;
  ship.pos.z += ship.vel.z * dt;

  // Handle 3D boundary conditions
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

  // Regen shields
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
        if (s.shield > 0) {
          const absorb = Math.min(s.shield, dmgLeft);
          s.shield -= absorb;
          dmgLeft -= absorb;
          // Track shield hit for visual effects
          s.lastShieldHitTime = state.time;
        }
        if (dmgLeft > 0) {
          // Armor reduces damage
          const effective = Math.max(1, dmgLeft - s.armor * 0.3);
          s.health -= effective;
          // XP to owner
          const owner = state.ships.find(sh => sh.id === b.ownerShipId);
          if (owner) {
            owner.level.xp += effective * XP_PER_DAMAGE;
          }
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
      // Credit kill to last hitter unknown in this simple model; we can approximate via target linking
      const killer = state.ships.find(sh => sh.targetId === s.id && sh.team !== s.team);
      if (killer) {
        killer.kills += 1; killer.level.xp += XP_PER_KILL;
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
      const angle = s.dir + ((state.rng.next() - 0.5) * CarrierSpawnConfig.fighterSpawn.angleRandomization);
      const offset = { x: s.pos.x + Math.cos(angle) * CarrierSpawnConfig.fighterSpawn.offsetDistance, y: s.pos.y + Math.sin(angle) * CarrierSpawnConfig.fighterSpawn.offsetDistance, z: s.pos.z };
      const child = spawnShip(state, s.team, 'fighter', offset, s.id);
      child.vel.x = s.vel.x; child.vel.y = s.vel.y; child.vel.z = s.vel.z; child.vel.z = s.vel.z;
      s.spawnedFighters = (s.spawnedFighters ?? 0) + 1;
      s.fighterSpawnCdLeft = cfg.fighterSpawnCooldown ?? CarrierSpawnConfig.fighterSpawn.baseCooldown;
    }
  }
}

export function simulateStep(state: GameState, dt: number) {
  // Ship logic
  for (const s of state.ships) {
    if (s.health <= 0) continue;
    stepShipAI(state, s, dt);
    fireTurrets(state, s, dt);
  }
  // Bullets
  updateBullets(state, dt);
  // Deaths/XP
  processDeathsAndXP(state);
  handleLevelUps(state);
  // Carriers spawning
  carrierSpawnLogic(state, dt);
}
