import { srange, srangeInt } from './rng.js';
import {
  XP_BASE,
  XP_GROWTH,
  HP_PERCENT_PER_LEVEL,
  DMG_PERCENT_PER_LEVEL,
  SHIELD_PERCENT_PER_LEVEL,
  SHIELD_REGEN_PERCENT,
  SHIELD_REGEN_MIN,
} from './progressionConfig.js';

export const Team = { RED: 0, BLUE: 1 };

// Helper: build per-type numeric config only for the requested type.
// This localizes seeded-RNG draws (srange) to the chosen type and avoids
// advancing the RNG for every type on each Ship construction.
function getClassConfig(t) {
  switch (t) {
    case 'frigate':
      return {
        radius: 10,
        maxSpeed: srange(90, 120),
        accel: 200,
        hp: srange(80, 120),
        reload: srange(0.24, 0.4),
        vision: 280,
        range: 180,
      };
    case 'destroyer':
      return {
        radius: 14,
        maxSpeed: srange(60, 90),
        accel: 150,
        hp: srange(150, 220),
        reload: srange(0.4, 0.7),
        vision: 320,
        range: 220,
      };
    case 'carrier':
      return {
        radius: 18,
        maxSpeed: srange(40, 70),
        accel: 90,
        hp: srange(220, 300),
        reload: srange(0.6, 1.2),
        vision: 360,
        range: 260,
        launchBase: srange(3.5, 6.0),
      };
    case 'fighter':
      return {
        radius: 6,
        maxSpeed: srange(160, 220),
        accel: 300,
        hp: srange(18, 32),
        reload: srange(0.12, 0.22),
        vision: 180,
        range: 120,
      };
    case 'corvette':
    default:
      return {
        radius: 8,
        maxSpeed: srange(120, 160),
        accel: 240,
        hp: srange(40, 70),
        reload: srange(0.18, 0.28),
        vision: 220,
        range: 140,
      };
  }
}

export class Bullet {
  constructor(x, y, vx, vy, team, ownerId = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.team = team;
    // ownerId is optional and may be undefined if unknown
    this.ownerId = ownerId === null ? undefined : ownerId;
    this.life = 2.5;
    this.radius = 2.2;
    this.dmg = srange(8, 14);
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  alive(bounds = null) {
    if (this.life <= 0) return false;
    if (!bounds) return true;
    const { W, H } = bounds;
    return this.x > -50 && this.x < W + 50 && this.y > -50 && this.y < H + 50;
  }
}

export class Ship {
  static _id = 1;
  constructor(team, x, y, type = 'corvette') {
    this.team = team; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.angle = 0;
    this.type = type; // 'corvette'|'frigate'|'destroyer'|'carrier'|'fighter'

    // Use the module-level getClassConfig to compute numeric values only for
    // the requested ship type. This ensures seeded RNG draws are localized
    // and predictable.
    const cfg = getClassConfig(type || 'corvette');
    this.radius = cfg.radius;
    this.maxSpeed = cfg.maxSpeed;
    this.accel = cfg.accel;
    this.turn = 4.5;

    this.hpMax = cfg.hp;
    this.hp = this.hpMax;
    this.cooldown = 0;
    this.reload = cfg.reload;

    this.vision = cfg.vision;
    this.range = cfg.range;
    this.id = Ship._id++;

    this.kills = 0;
    this.alive = true;
    this._exploded = false;

    // Per-battle progression (default)
    this.level = 1;
    this.xp = 0;
    this.baseHpMax = this.hpMax; // remember base for scaling
    this.baseDmg = 10; // baseline bullet damage multiplier reference

    // Shields: secondary health that depletes before HP and regenerates over time
    this.shieldMax = Math.round(this.hpMax * 0.6);
    this.shield = this.shieldMax;
    this.shieldRegen = Math.max(SHIELD_REGEN_MIN, this.shieldMax * SHIELD_REGEN_PERCENT);

    if (type === 'carrier') {
      this.isCarrier = true;
      this.launchCooldown = cfg.launchBase * srange(0.8, 1.4);
      this.launchAmount = Math.max(1, Math.floor(srange(1, 3)));
    } else {
      this.isCarrier = false;
      this.launchCooldown = 0;
    }
  }

  xpToNext(base = XP_BASE, growth = XP_GROWTH) {
    return Math.floor(base * Math.pow(growth, Math.max(0, this.level - 1)));
  }

  // Percent gains per level (multiplicative on base)
  applyLevel() {
  const dScale = DMG_PERCENT_PER_LEVEL; // damage per level
  const hScale = HP_PERCENT_PER_LEVEL; // hp per level
  const shScale = SHIELD_PERCENT_PER_LEVEL; // shield per level
    // recompute hpMax and shieldMax based on base values
    this.hpMax = Math.round(this.baseHpMax * (1 + hScale * (this.level - 1)));
    // scale shield relative to baseHpMax as well
    const baseShield = Math.round(this.baseHpMax * 0.6);
    this.shieldMax = Math.round(baseShield * (1 + shScale * (this.level - 1)));
    // ensure current hp/shield not exceed new max
    this.hp = Math.min(this.hp, this.hpMax);
    this.shield = Math.min(this.shield, this.shieldMax);
  }

  gainXp(amount) {
    if (amount <= 0) return;
    this.xp += amount;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      this.applyLevel();
    }
  }

  pickTarget(ships) {
    let best = null; let bd = Infinity; const v2 = this.vision * this.vision;
    for (const s of ships) {
      if (!s.alive || s.team === this.team) continue;
      const dx = s.x - this.x; const dy = s.y - this.y; const d2 = dx*dx + dy*dy;
      if (d2 < v2 && d2 < bd) { bd = d2; best = s; }
    }
    return best;
  }

  update(dt, ships) {
  if (!this.alive) return;
    const target = this.pickTarget(ships);
    let ax=0, ay=0;
    if (target){
      const dx = target.x - this.x, dy = target.y - this.y; const dist = Math.hypot(dx,dy) || 1;
      const lead = Math.max(0, Math.min(1.2, dist/240));
      const tx = target.x + (target.vx||0)*lead, ty = target.y + (target.vy||0)*lead;
      const sx = tx - this.x, sy = ty - this.y; const sl = Math.hypot(sx,sy) || 1;
      ax += (sx/sl) * this.accel; ay += (sy/sl) * this.accel;
      if (dist < this.range){
        const facing = ((this.vx||1)*dx + (this.vy||1)*dy) / (Math.hypot(this.vx,this.vy)+1);
        if (this.cooldown <= 0 && facing > 0){
          const spd = 300 + srange(-20,20);
          const bdx = dx/dist, bdy = dy/dist;
          // Only push bullets if caller provided a bullets array as third argument
          if (arguments.length >= 3 && Array.isArray(arguments[2])) {
            const bullets = arguments[2];
            const bullet = new Bullet(this.x + bdx*12, this.y + bdy*12, bdx*spd + this.vx*0.2, bdy*spd + this.vy*0.2, this.team, this.id);
            // Apply damage-scaling by level: bullet.dmg *= (1 + DMG_PERCENT_PER_LEVEL * (this.level - 1))
            bullet.dmg *= (1 + DMG_PERCENT_PER_LEVEL * (this.level - 1));
            bullets.push(bullet);
          }
          this.cooldown = this.reload;
        }
      }
    } else {
      ax += Math.cos(this.angle) * (this.accel*0.3);
      ay += Math.sin(this.angle) * (this.accel*0.3);
    }

    // Separation
    let sx=0, sy=0, n=0; const sepR=26;
    for (const s of ships){ if (!s.alive || s===this || s.team!==this.team) continue; const dx = this.x - s.x, dy = this.y - s.y; const d2 = dx*dx + dy*dy; if (d2 < sepR*sepR && d2 > 1){ const d = Math.sqrt(d2); sx += dx/d; sy += dy/d; n++; } }
    if (n>0){ ax += (sx/n) * this.accel*0.9; ay += (sy/n) * this.accel*0.9; }

    this.vx += ax*dt; this.vy += ay*dt;
    const sp = Math.hypot(this.vx,this.vy);
    if (sp > this.maxSpeed){ const k = this.maxSpeed / sp; this.vx *= k; this.vy *= k; }
    this.x += this.vx*dt; this.y += this.vy*dt; this.angle = Math.atan2(this.vy, this.vx);

    // soft bounds handled by renderer if desired

  this.cooldown -= dt;
  // Shield regeneration
  if (this.shield < this.shieldMax) {
    this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * dt);
  }

  // Carrier launch handling moved to simulateStep to centralize time-based events
  }

  damage(d){
    // Shields absorb damage first
    if (this.shield > 0 && d > 0) {
      const sTake = Math.min(this.shield, d);
      this.shield -= sTake;
      d -= sTake;
    }
    if (d > 0) {
      this.hp -= d;
    }
    if (this.hp <= 0 && this.alive){ this.alive = false; this._exploded = true; return { x: this.x, y: this.y, team: this.team }; }
    return null;
  }
}

export function spawnFleet(team, n, x, y, spread = 80) {
  const ships = [];
  for (let i = 0; i < n; i++) {
    const ox = (i % 6) * 20 + srange(-10, 10);
    const oy = Math.floor(i / 6) * 20 + srange(-10, 10);
    const r = srange(0, 1);
    let type = 'corvette';
    if (r < 0.45) type = 'corvette';
    else if (r < 0.75) type = 'frigate';
    else if (r < 0.92) type = 'destroyer';
    else type = 'carrier';
    ships.push(new Ship(team, x + (team === Team.RED ? -ox : ox), y + oy, type));
  }
  return ships;
}
