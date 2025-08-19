import { srange, srangeInt } from './rng.js';
import { EVASIVE_DURATION, TURN_RATES, EVASIVE_THRUST_MULT, SEPARATION_MULT } from './behaviorConfig.js';
import { XP_BASE, XP_GROWTH, HP_PERCENT_PER_LEVEL, DMG_PERCENT_PER_LEVEL, SHIELD_PERCENT_PER_LEVEL, SHIELD_REGEN_PERCENT, SHIELD_REGEN_MIN } from './progressionConfig.js';

export const Team = { RED: 0, BLUE: 1 };

export class Bullet {
  constructor(x, y, vx, vy, team, ownerId = null) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.team = team;
    this.ownerId = ownerId; // optional id of ship that fired
    this.life = 2.5; this.radius = 2.2; this.dmg = srange(8, 14);
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
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

    const classes = {
  // turn rates are radians per second and tuned per class
  corvette: { radius: 8, maxSpeed: srange(120,160), accel: 240, turn: 6.5, hp: srange(40,70), reload: srange(0.18,0.28), vision: 220, range: 140 },
  frigate:  { radius: 10, maxSpeed: srange(90,120), accel: 200, turn: 5.0, hp: srange(80,120), reload: srange(0.24,0.4), vision: 280, range: 180 },
  destroyer:{ radius: 14, maxSpeed: srange(60,90), accel: 150, turn: 3.2, hp: srange(150,220), reload: srange(0.4,0.7), vision: 320, range: 220 },
  carrier:  { radius: 18, maxSpeed: srange(40,70), accel: 90, turn: 2.0, hp: srange(220,300), reload: srange(0.6,1.2), vision: 360, range: 260, launchBase: srange(3.5,6.0) },
  fighter:  { radius: 6, maxSpeed: srange(160,220), accel: 300, turn: 8.0, hp: srange(18,32), reload: srange(0.12,0.22), vision: 180, range: 120 }
    };

    const cfg = classes[type] || classes.corvette;
  this.radius = cfg.radius; this.maxSpeed = cfg.maxSpeed; this.accel = cfg.accel; 
  // per-type turn (radians/sec) - allow different maneuverability per class
  this.turn = cfg.turn || TURN_RATES[type] || 4.5;
    this.hpMax = cfg.hp; this.hp = this.hpMax; this.cooldown = 0; this.reload = cfg.reload;
    this.vision = cfg.vision; this.range = cfg.range; this.id = Ship._id++;
    this.kills = 0; this.alive = true; this._exploded = false;
  // Per-battle progression (default)
  this.level = 1;
  this.xp = 0;
  this.baseHpMax = this.hpMax; // remember base for scaling
  this.baseDmg = 10; // baseline bullet damage multiplier reference (bullets still pick own dmg)

  // Shields: secondary health that depletes before HP and regenerates over time
  // Initialize shield as a fraction of hpMax (tweakable)
  this.shieldMax = Math.round(this.hpMax * 0.6);
  this.shield = this.shieldMax;
  // shieldRegen is amount of shield restored per second (use percentage of shieldMax)
  this.shieldRegen = Math.max(SHIELD_REGEN_MIN, this.shieldMax * SHIELD_REGEN_PERCENT);

  // recentHitTimer counts seconds remaining where the ship will prefer evasive behaviour
  this.recentHitTimer = 0;

    if (type === 'carrier'){
      this.isCarrier = true;
      this.launchCooldown = cfg.launchBase * srange(0.8, 1.4);
      this.launchAmount = Math.max(1, Math.floor(srange(1,3)));
  // carrier-specific launch pool: maximum fighters it can have active at once
  this.maxFighters = 6;
  // track active fighter ids owned by this carrier
  this.activeFighters = [];
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

    // determine desired behaviour: offensive (pursue) or evasive (flee) if recently hit
  const isEvasive = this.recentHitTimer > 0;

    // desired vector (unit)
    let desX = 0, desY = 0; let dist = 1;
    if (target && !isEvasive) {
      const dx = target.x - this.x, dy = target.y - this.y; dist = Math.hypot(dx,dy) || 1;
      const lead = Math.max(0, Math.min(1.2, dist/240));
      const tx = target.x + (target.vx||0)*lead, ty = target.y + (target.vy||0)*lead;
      desX = tx - this.x; desY = ty - this.y; const sl = Math.hypot(desX, desY) || 1; desX /= sl; desY /= sl;
    } else if (target && isEvasive) {
      // flee from nearest enemy: move opposite direction from target (avoidance)
      const dx = target.x - this.x, dy = target.y - this.y; dist = Math.hypot(dx,dy) || 1;
      desX = -(dx/dist); desY = -(dy/dist);
    } else {
      // no target: gentle forward thrust
      desX = Math.cos(this.angle); desY = Math.sin(this.angle);
    }

    // separation vector from friendly ships (avoid crowding)
    let sepX = 0, sepY = 0, n = 0; const sepR = 26;
    for (const s of ships) {
      if (!s.alive || s === this || s.team !== this.team) continue;
      const dx = this.x - s.x, dy = this.y - s.y; const d2 = dx*dx + dy*dy;
      if (d2 < sepR*sepR && d2 > 1) {
        const d = Math.sqrt(d2);
        sepX += dx / d; sepY += dy / d; n++;
      }
    }
    if (n > 0) { sepX /= n; sepY /= n; }

    // Compute desired heading angle and apply turn-rate limit
    const desiredAngle = Math.atan2(desY, desX);
    let delta = desiredAngle - this.angle;
    // normalize delta to [-PI, PI]
    while (delta > Math.PI) delta -= 2*Math.PI;
    while (delta < -Math.PI) delta += 2*Math.PI;
    const maxTurn = this.turn * dt; // turn is radians per second
    if (delta > maxTurn) delta = maxTurn; else if (delta < -maxTurn) delta = -maxTurn;
    this.angle += delta;

    // Forward thrust depends on behaviour
  const thrustBase = isEvasive ? this.accel * EVASIVE_THRUST_MULT : this.accel;
    // apply forward thrust in facing direction
    this.vx += Math.cos(this.angle) * thrustBase * dt;
    this.vy += Math.sin(this.angle) * thrustBase * dt;
    // apply a smaller velocity change for separation
    if (n > 0) {
      this.vx += sepX * (this.accel * SEPARATION_MULT) * dt;
      this.vy += sepY * (this.accel * SEPARATION_MULT) * dt;
    }

    // enforce speed cap
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.maxSpeed) { const k = this.maxSpeed / sp; this.vx *= k; this.vy *= k; }

    this.x += this.vx * dt; this.y += this.vy * dt;

    // Update facing-based firing: only fire when roughly facing target and in range
    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y; const distToTarget = Math.hypot(dx,dy) || 1;
      if (distToTarget < this.range) {
        const facing = Math.cos(this.angle) * (dx/distToTarget) + Math.sin(this.angle) * (dy/distToTarget);
        if (this.cooldown <= 0 && facing > 0.2) {
          const spd = 300 + srange(-20,20);
          const bdx = dx/distToTarget, bdy = dy/distToTarget;
          if (arguments.length >= 3 && Array.isArray(arguments[2])) {
            const bullets = arguments[2];
            bullets.push(new Bullet(this.x + bdx*12, this.y + bdy*12, bdx*spd + this.vx*0.2, bdy*spd + this.vy*0.2, this.team, this.id));
          }
          this.cooldown = this.reload;
        }
      }
    }

    // soft bounds handled by renderer if desired

  this.cooldown -= dt;
  // Shield regeneration
  if (this.shield < this.shieldMax) {
    this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * dt);
  }

  // decay recent hit timer
  if (this.recentHitTimer > 0) this.recentHitTimer = Math.max(0, this.recentHitTimer - dt);

  // Carrier launch handling moved to simulateStep to centralize time-based events
  }

  damage(d){
    // Shields absorb damage first
    let origD = d;
    let sTake = 0;
    if (this.shield > 0 && d > 0) {
      sTake = Math.min(this.shield, d);
      this.shield -= sTake;
      d -= sTake;
    }
    if (d > 0) {
      this.hp -= d;
    }
    // mark as recently hit so behaviour becomes evasive for a short duration
    if (sTake > 0 || (origD > 0 && d > 0)) {
      this.recentHitTimer = Math.max(this.recentHitTimer, EVASIVE_DURATION);
    }
    if (this.hp <= 0 && this.alive){
      // if this is a fighter owned by a carrier, deregister from that carrier's active list
      if (this.type === 'fighter' && typeof this.ownerCarrier === 'number') {
        // find carrier in global scope not available here; simulateStep will handle cleaning when it detects dead ships
        // mark ownerCarrier on the fighter so simulateStep can clean up owner state
      }
      this.alive = false; this._exploded = true; return { x: this.x, y: this.y, team: this.team, id: this.id, type: this.type, ownerCarrier: this.ownerCarrier };
    }
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
