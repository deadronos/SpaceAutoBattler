import { srange, srangeInt } from './rng.js';

let _nextId = 1;
const _genId = () => _nextId++;

export const Team = { RED: 'red', BLUE: 'blue' };

/**
 * Create a ship (POJO) with gameplay defaults and attached helper methods.
 * @param {Object} opts optional overrides
 */
export function createShip(opts = {}) {
  const id = opts.id == null ? _genId() : opts.id;
  const hpMax = opts.maxHp != null ? opts.maxHp : (opts.hp != null ? opts.hp : 50);
  const shieldDefault = Math.round(hpMax * 0.6);
  const ship = {
    id,
    team: opts.team || Team.RED,
    type: opts.type || 'corvette',
    x: opts.x || 0,
    y: opts.y || 0,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    hp: opts.hp != null ? opts.hp : hpMax,
    maxHp: hpMax,
    armor: opts.armor != null ? opts.armor : 0,
    shield: opts.shield != null ? opts.shield : shieldDefault,
    maxShield: opts.maxShield != null ? opts.maxShield : shieldDefault,
    shieldRegen: opts.shieldRegen != null ? opts.shieldRegen : 0.5,
    dmg: opts.dmg != null ? opts.dmg : 5,
    radius: opts.radius != null ? opts.radius : 8,
    cannons: opts.cannons || [],
    isCarrier: !!opts.isCarrier,
    alive: true,
    level: opts.level || 1,
    xp: opts.xp || 0,
  };

  // Methods attached as closures to keep POJO core state
  ship.update = (dt, state) => {
    if (!ship.alive) return;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    // shield regen
    if (ship.shield < ship.maxShield) {
      ship.shield = Math.min(ship.maxShield, ship.shield + ship.shieldRegen * dt);
    }
  };

  ship.pickTarget = (ships) => {
    let best = null; let bestDist = Infinity;
    for (const s of ships) {
      if (!s || s.team === ship.team || !s.alive) continue;
      const dx = s.x - ship.x; const dy = s.y - ship.y;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  };

  ship.damage = (amount, source) => {
    const result = { shield: 0, hp: 0, killed: false };
    if (!ship.alive) return result;
    // Simple armor reduction: apply flat reduction then percent
    const flat = Math.max(0, ship.armor || 0);
    const afterArmor = Math.max(0, amount - flat);
    // no percent armor implemented yet; keep deterministic
    const shieldAbsorb = Math.min(ship.shield, afterArmor);
    ship.shield -= shieldAbsorb;
    result.shield = shieldAbsorb;
    const leftover = afterArmor - shieldAbsorb;
    if (leftover > 0) {
      const hpReduce = Math.min(ship.hp, leftover);
      ship.hp -= hpReduce;
      result.hp = hpReduce;
      if (ship.hp <= 0) {
        ship.alive = false;
        result.killed = true;
      }
    }
    return result;
  };

  ship.gainXp = (amount) => {
    ship.xp += amount;
    // simple level up: 100 xp per level
    while (ship.xp >= 100) {
      ship.xp -= 100;
      ship.level += 1;
      ship.maxHp += 10;
      ship.hp = ship.maxHp;
      ship.dmg += 1;
      ship.maxShield += 2;
      ship.shield = ship.maxShield;
    }
  };

  ship.applyLevel = (lvl) => {
    ship.level = lvl;
    ship.maxHp = 50 + (lvl - 1) * 10;
    ship.hp = ship.maxHp;
    ship.dmg = 5 + (lvl - 1) * 1;
    ship.maxShield = 10 + (lvl - 1) * 2;
    ship.shield = ship.maxShield;
  };

  return ship;
}

/**
 * Create a simple bullet object with update and alive checks.
 */
export function createBullet(opts = {}) {
  const id = opts.id == null ? _genId() : opts.id;
  const bullet = {
    id,
    x: opts.x || 0,
    y: opts.y || 0,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    dmg: opts.dmg != null ? opts.dmg : 6,
    team: opts.team || 'red',
    ownerId: opts.ownerId || null,
    ttl: opts.ttl != null ? opts.ttl : 2.0,
    radius: opts.radius != null ? opts.radius : 2,
  };

  bullet.update = (dt) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.ttl -= dt;
  };

  bullet.alive = (bounds) => {
    if (bullet.ttl <= 0) return false;
    if (!bounds) return true;
    if (bullet.x < 0 || bullet.x > bounds.W || bullet.y < 0 || bullet.y > bounds.H) return false;
    return true;
  };

  return bullet;
}

/**
 * Spawn a simple fleet of ships using the seeded RNG.
 */
export function spawnFleet(team, n, cx = 400, cy = 300) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const angle = srange(0, Math.PI * 2);
    const r = 30 + srange(0, 100);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    out.push(createShip({ team, x, y }));
  }
  return out;
}

export default { createShip, createBullet, spawnFleet, Team };
