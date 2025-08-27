import type { GameState, Ship, ShipClass, Team, Vector2, EntityId, Bullet, TurretState } from '../types/index.js';
import { DefaultConfig } from '../config/simConfig.js';
import { createRNG } from '../utils/rng.js';
import { nextLevelXp, XP_PER_DAMAGE, XP_PER_KILL, applyLevelUps } from '../config/progression.js';

export function createInitialState(seed = 'SPACE-001'): GameState {
  const rng = createRNG(seed);
  return {
    time: 0,
    tick: 0,
    running: false,
    speedMultiplier: 1,
    rng,
    nextId: 1,
    config: DefaultConfig,
    ships: [],
    bullets: [],
    score: { red: 0, blue: 0 },
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
}

function allocateId(state: GameState): EntityId { return state.nextId++; }

export function spawnShip(state: GameState, team: Team, cls: ShipClass, pos?: Vector2, parentCarrierId?: EntityId): Ship {
  const cfg = state.config.classes[cls];
  const id = allocateId(state);
  const level = { level: 1, xp: 0, nextLevelXp: nextLevelXp(1) };
  const maxHealth = Math.floor(applyLevelUps(level.level, cfg.baseHealth));
  const maxShield = Math.floor(applyLevelUps(level.level, cfg.shield));
  const turrets: TurretState[] = cfg.turrets.map((t, i) => ({ id: `${t.id}-${i}`, cooldownLeft: 0 }));
  const p = pos ?? randomSpawnPos(state, team);
  const ship: Ship = {
    id, team, class: cls,
  pos: { x: p.x, y: p.y }, vel: { x: 0, y: 0 }, dir: state.rng.next() * Math.PI * 2,
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
    fighterSpawnCdLeft: cls === 'carrier' ? 1.0 : undefined,
    parentCarrierId,
  };
  state.ships.push(ship);
  return ship;
}

function randomSpawnPos(state: GameState, team: Team): Vector2 {
  const margin = 200;
  const y = state.rng.int(margin, state.config.simBounds.height - margin);
  const x = team === 'red' ? state.rng.int(margin, margin + 200) : state.rng.int(state.config.simBounds.width - margin - 200, state.config.simBounds.width - margin);
  return { x, y };
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
    const dx = s.pos.x - ship.pos.x; const dy = s.pos.y - ship.pos.y;
    const d2 = dx*dx + dy*dy;
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
    const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y;
    const desired = Math.atan2(dy, dx);
    let diff = desired - ship.dir;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    const turn = clamp(diff, -ship.turnRate*dt, ship.turnRate*dt);
    ship.dir += turn;

    // Move towards target with simple acceleration
    const ax = Math.cos(ship.dir) * ship.speed * 0.5;
    const ay = Math.sin(ship.dir) * ship.speed * 0.5;
    ship.vel.x += ax * dt;
    ship.vel.y += ay * dt;
  }

  // Damp and clamp speed
  ship.vel.x *= 0.98; ship.vel.y *= 0.98;
  const maxV = ship.speed;
  const v = Math.hypot(ship.vel.x, ship.vel.y);
  if (v > maxV) { ship.vel.x = (ship.vel.x / v) * maxV; ship.vel.y = (ship.vel.y / v) * maxV; }

  // Integrate position
  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;

  // Keep within bounds
  const { width, height } = state.config.simBounds;
  ship.pos.x = clamp(ship.pos.x, 0, width);
  ship.pos.y = clamp(ship.pos.y, 0, height);

  // Regen shields
  ship.shield = clamp(ship.shield + ship.shieldRegen * dt, 0, ship.maxShield);
}

function fireTurrets(state: GameState, ship: Ship, dt: number) {
  const target = ship.targetId ? state.ships.find(s => s.id === ship.targetId!) : undefined;
  for (const t of ship.turrets) {
    t.cooldownLeft = Math.max(0, t.cooldownLeft - dt);
  }
  if (!target) return;
  const cfg = state.config.classes[ship.class];
  const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dist = Math.hypot(dx, dy);
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
      pos: { x: ship.pos.x, y: ship.pos.y },
      vel: { x: Math.cos(dir) * speed, y: Math.sin(dir) * speed },
      ttl: 3,
      damage: tCfg.damage,
    };
    state.bullets.push(bullet);
    tState.cooldownLeft = tCfg.cooldown;
  }
}

function updateBullets(state: GameState, dt: number) {
  const { width, height } = state.config.simBounds;
  for (const b of state.bullets) {
    b.ttl -= dt;
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
  }
  // Collisions (simple radius approx)
  for (const b of state.bullets) {
    if (b.ttl <= 0) continue;
    for (const s of state.ships) {
      if (s.team === b.ownerTeam || s.health <= 0) continue;
      const dx = s.pos.x - b.pos.x; const dy = s.pos.y - b.pos.y; const d = Math.hypot(dx, dy);
      const hitR = 16 + (s.class === 'destroyer' || s.class === 'carrier' ? 20 : 10);
      if (d < hitR) {
        // Apply damage to shield first
        let dmgLeft = b.damage;
        if (s.shield > 0) {
          const absorb = Math.min(s.shield, dmgLeft);
          s.shield -= absorb;
          dmgLeft -= absorb;
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
    // Out of bounds
    if (b.pos.x < 0 || b.pos.x > width || b.pos.y < 0 || b.pos.y > height) b.ttl = 0;
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
      const cfg = state.config.classes[s.class];
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
    const cfg = state.config.classes['carrier'];
    if ((s.spawnedFighters ?? 0) < (cfg.maxFighters ?? 0) && s.fighterSpawnCdLeft === 0) {
      const angle = s.dir + ((state.rng.next() - 0.5) * 0.6);
      const offset = { x: s.pos.x + Math.cos(angle) * 24, y: s.pos.y + Math.sin(angle) * 24 };
      const child = spawnShip(state, s.team, 'fighter', offset, s.id);
      child.vel.x = s.vel.x; child.vel.y = s.vel.y;
      s.spawnedFighters = (s.spawnedFighters ?? 0) + 1;
      s.fighterSpawnCdLeft = cfg.fighterSpawnCooldown ?? 6;
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
