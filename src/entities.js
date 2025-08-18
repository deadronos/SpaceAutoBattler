import { srange } from './rng.js';

export const Team = { RED: 0, BLUE: 1 };

export class Bullet {
  constructor(x, y, vx, vy, team) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.team = team;
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
  constructor(team, x, y) {
    this.team = team; this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 10;
    this.maxSpeed = srange(70, 110);
    this.accel = 160;
    this.hpMax = srange(70, 120);
    this.hp = this.hpMax;
    this.cooldown = 0;
    this.reload = srange(0.28, 0.45);
    this.vision = 300;
    this.range = 190;
    this.id = Ship._id++;
    this.alive = true;
  }

  pickTarget(ships) {
    let best = null;
    let bd = Infinity;
    const v2 = this.vision * this.vision;
    for (const s of ships) {
      if (!s.alive || s.team === this.team) continue;
      const dx = s.x - this.x;
      const dy = s.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < v2 && d2 < bd) {
        bd = d2; best = s;
      }
    }
    return best;
  }

  damage(d) {
    this.hp -= d;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }
}
