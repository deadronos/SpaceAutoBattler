// src/config/progressionConfig.ts
var progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level) => 100 + level * 50,
  hpPercentPerLevel: 0.1,
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06
};

// src/simulate.ts
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function simulateStep(state2, dtSeconds, bounds2) {
  state2.t = (state2.t || 0) + dtSeconds;
  for (let i = (state2.bullets || []).length - 1; i >= 0; i--) {
    const b = state2.bullets[i];
    b.x += (b.vx || 0) * dtSeconds;
    b.y += (b.vy || 0) * dtSeconds;
    b.ttl = (b.ttl || 0) - dtSeconds;
    if (b.ttl <= 0) state2.bullets.splice(i, 1);
  }
  for (const s of state2.ships || []) {
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    if (s.x < 0) s.x += bounds2.W;
    if (s.x > bounds2.W) s.x -= bounds2.W;
    if (s.y < 0) s.y += bounds2.H;
    if (s.y > bounds2.H) s.y -= bounds2.H;
  }
  for (let bi = (state2.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state2.bullets[bi];
    for (let si = (state2.ships || []).length - 1; si >= 0; si--) {
      const s = state2.ships[si];
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      if (dist2(b, s) <= r * r) {
        const attacker = typeof b.ownerId === "number" || typeof b.ownerId === "string" ? (state2.ships || []).find((sh) => sh.id === b.ownerId) : void 0;
        let dealtToShield = 0;
        let dealtToHealth = 0;
        const shield = s.shield || 0;
        if (shield > 0) {
          const absorbed = Math.min(shield, b.damage || 0);
          s.shield = shield - absorbed;
          (state2.shieldHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: absorbed });
          const remaining = (b.damage || 0) - absorbed;
          if (remaining > 0) {
            s.hp -= remaining;
            (state2.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: remaining });
          }
          dealtToShield = absorbed;
          dealtToHealth = Math.max(0, (b.damage || 0) - absorbed);
        } else {
          s.hp -= b.damage || 0;
          (state2.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: b.damage || 0 });
          dealtToHealth = b.damage || 0;
        }
        if (attacker) {
          attacker.xp = (attacker.xp || 0) + (dealtToShield + dealtToHealth) * (progression.xpPerDamage || 0);
          while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
            attacker.xp -= progression.xpToLevel(attacker.level || 1);
            attacker.level = (attacker.level || 1) + 1;
            const hpMul = 1 + (progression.hpPercentPerLevel || 0);
            const shMul = 1 + (progression.shieldPercentPerLevel || 0);
            const dmgMul = 1 + (progression.dmgPercentPerLevel || 0);
            attacker.maxHp = (attacker.maxHp || 0) * hpMul;
            attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
            if (typeof attacker.maxShield === "number") {
              attacker.maxShield = (attacker.maxShield || 0) * shMul;
              attacker.shield = Math.min(attacker.maxShield, (attacker.shield || 0) * shMul);
            }
            if (Array.isArray(attacker.cannons)) {
              for (const c of attacker.cannons) {
                if (typeof c.damage === "number") c.damage *= dmgMul;
              }
            }
          }
        }
        state2.bullets.splice(bi, 1);
        if (s.hp <= 0) {
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progression.xpPerKill || 0);
            while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
              attacker.xp -= progression.xpToLevel(attacker.level || 1);
              attacker.level = (attacker.level || 1) + 1;
              const hpMul = 1 + (progression.hpPercentPerLevel || 0);
              const shMul = 1 + (progression.shieldPercentPerLevel || 0);
              const dmgMul = 1 + (progression.dmgPercentPerLevel || 0);
              attacker.maxHp = (attacker.maxHp || 0) * hpMul;
              attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
              if (typeof attacker.maxShield === "number") {
                attacker.maxShield = (attacker.maxShield || 0) * shMul;
                attacker.shield = Math.min(attacker.maxShield, (attacker.shield || 0) * shMul);
              }
              if (Array.isArray(attacker.cannons)) {
                for (const c of attacker.cannons) {
                  if (typeof c.damage === "number") c.damage *= dmgMul;
                }
              }
            }
          }
          (state2.explosions ||= []).push({ x: s.x, y: s.y, team: s.team });
          state2.ships.splice(si, 1);
        }
        break;
      }
    }
  }
  for (const s of state2.ships || []) {
    if (s.maxShield) s.shield = Math.min(s.maxShield, (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds);
  }
  return state2;
}

// src/rng.ts
var _state = null;
function srand(seed) {
  if (typeof seed === "number") {
    _state = seed >>> 0 || 1;
  } else {
    _state = null;
  }
}
function _next() {
  if (_state === null) _state = 1;
  _state = Math.imul(1664525, _state) + 1013904223 >>> 0;
  return _state;
}
function srandom() {
  if (_state === null) return Math.random();
  const v = _next();
  return v / 4294967296;
}
function srange(min, max) {
  return min + srandom() * (max - min);
}

// src/config/entitiesConfig.ts
var ShipConfig = {
  fighter: {
    maxHp: 15,
    armor: 0,
    maxShield: 8,
    shieldRegen: 1,
    dmg: 3,
    radius: 4,
    cannons: [{ damage: 3, rate: 3, spread: 0.1, muzzleSpeed: 300, bulletRadius: 1.5, bulletTTL: 1.2 }],
    accel: 600,
    turnRate: 6
  },
  corvette: {
    maxHp: 50,
    armor: 0,
    maxShield: Math.round(50 * 0.6),
    shieldRegen: 0.5,
    dmg: 5,
    radius: 8,
    accel: 200,
    turnRate: 3,
    cannons: [{ damage: 6, rate: 1.2, spread: 0.05, muzzleSpeed: 220, bulletRadius: 2, bulletTTL: 2 }]
  },
  frigate: {
    maxHp: 80,
    armor: 1,
    maxShield: Math.round(80 * 0.6),
    shieldRegen: 0.4,
    dmg: 8,
    radius: 12,
    cannons: [{ damage: 8, rate: 1, spread: 0.06, muzzleSpeed: 200, bulletRadius: 2.5, bulletTTL: 2.2 }],
    accel: 120,
    turnRate: 2.2
  },
  destroyer: {
    maxHp: 120,
    armor: 2,
    maxShield: Math.round(120 * 0.6),
    shieldRegen: 0.3,
    dmg: 12,
    radius: 16,
    cannons: new Array(6).fill(0).map(() => ({ damage: 6, rate: 0.8, spread: 0.08, muzzleSpeed: 240, bulletRadius: 2.5, bulletTTL: 2.4 })),
    accel: 80,
    turnRate: 1.6
  },
  carrier: {
    maxHp: 200,
    armor: 3,
    maxShield: Math.round(200 * 0.6),
    shieldRegen: 0.2,
    dmg: 2,
    radius: 24,
    cannons: new Array(4).fill(0).map(() => ({ damage: 4, rate: 0.6, spread: 0.12, muzzleSpeed: 180, bulletRadius: 3, bulletTTL: 2.8 })),
    accel: 40,
    turnRate: 0.8,
    carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 }
  }
};

// src/entities.ts
var nextId = 1;
function genId() {
  return nextId++;
}
function createBullet(x, y, vx, vy, team = "red", ownerId = null, damage = 1, ttl = 2) {
  return {
    id: genId(),
    x,
    y,
    vx,
    vy,
    team,
    ownerId,
    damage,
    ttl
  };
}

// src/behavior.ts
function len2(vx, vy) {
  return vx * vx + vy * vy;
}
function clampSpeed(s, max) {
  const v2 = len2(s.vx || 0, s.vy || 0);
  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx *= inv;
    s.vy *= inv;
  }
}
function findNearestEnemy(state2, ship) {
  let best = null;
  let bestD2 = Infinity;
  for (const other of state2.ships) {
    if (other === ship) continue;
    if (other.team === ship.team) continue;
    const dx = (other.x || 0) - (ship.x || 0);
    const dy = (other.y || 0) - (ship.y || 0);
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = other;
    }
  }
  return best;
}
function aimWithSpread(from, to, spread = 0) {
  let dx = (to.x || 0) - (from.x || 0);
  let dy = (to.y || 0) - (from.y || 0);
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  if (spread > 0) {
    const ang = Math.atan2(dy, dx);
    const jitter = srange(-spread, spread);
    const na = ang + jitter;
    return { x: Math.cos(na), y: Math.sin(na) };
  }
  return { x: dx, y: dy };
}
function tryFire(state2, ship, target, dt) {
  const cannons = Array.isArray(ship.cannons) ? ship.cannons : [];
  for (const c of cannons) {
    if (typeof c.__cd !== "number") c.__cd = 0;
    c.__cd -= dt;
    if (c.__cd > 0) continue;
    const spread = typeof c.spread === "number" ? c.spread : 0;
    const dir = aimWithSpread(ship, target, spread);
    const speed = typeof c.muzzleSpeed === "number" ? c.muzzleSpeed : 240;
    const dmg = typeof c.damage === "number" ? c.damage : 3;
    const ttl = typeof c.bulletTTL === "number" ? c.bulletTTL : 2;
    const radius = typeof c.bulletRadius === "number" ? c.bulletRadius : 1.5;
    const vx = dir.x * speed;
    const vy = dir.y * speed;
    const b = Object.assign(
      createBullet(ship.x, ship.y, vx, vy, ship.team, ship.id, dmg, ttl),
      { radius }
    );
    state2.bullets.push(b);
    const rate = typeof c.rate === "number" && c.rate > 0 ? c.rate : 1;
    c.__cd = 1 / rate;
  }
}
function applySimpleAI(state2, dt, _bounds = { W: 800, H: 600 }) {
  if (!state2 || !Array.isArray(state2.ships)) return;
  for (const s of state2.ships) {
    const enemy = findNearestEnemy(state2, s);
    if (enemy) {
      const accel = typeof s.accel === "number" ? s.accel : 100;
      const aim = aimWithSpread(s, enemy, 0);
      s.vx = (s.vx || 0) + aim.x * accel * dt;
      s.vy = (s.vy || 0) + aim.y * accel * dt;
      tryFire(state2, s, enemy, dt);
    } else {
      s.vx = (s.vx || 0) + srange(-1, 1) * 8 * dt;
      s.vy = (s.vy || 0) + srange(-1, 1) * 8 * dt;
    }
    clampSpeed(s, 160);
  }
}

// src/simWorker.ts
var state = null;
var bounds = { W: 800, H: 600 };
var simDtMs = 16;
var running = false;
var acc = 0;
var last = 0;
function postSnapshot() {
  try {
    postMessage({ type: "snapshot", state });
  } catch (e) {
  }
}
function tick() {
  if (!running) return;
  const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  if (!last) last = now;
  acc += now - last;
  last = now;
  if (acc > 250) acc = 250;
  while (acc >= simDtMs) {
    try {
      applySimpleAI(state, simDtMs / 1e3, bounds);
      simulateStep(state, simDtMs / 1e3, bounds);
    } catch (e) {
      const errAny = e;
      const stack = errAny && errAny.stack ? errAny.stack : "";
      postMessage({ type: "error", message: String(e), stack });
    }
    acc -= simDtMs;
  }
  postSnapshot();
  setTimeout(tick, 0);
}
self.onmessage = (ev) => {
  const msg = ev.data;
  try {
    switch (msg && msg.type) {
      case "init":
        if (typeof msg.seed === "number") srand(msg.seed);
        if (msg.bounds) bounds = msg.bounds;
        if (typeof msg.simDtMs === "number") simDtMs = msg.simDtMs;
        if (msg.state) state = msg.state;
        postMessage({ type: "ready" });
        break;
      case "start":
        if (!state) {
          postMessage({ type: "error", message: "no state" });
          break;
        }
        running = true;
        acc = 0;
        last = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        tick();
        break;
      case "stop":
        running = false;
        break;
      case "snapshotRequest":
        postSnapshot();
        break;
      case "setSeed":
        if (typeof msg.seed === "number") {
          srand(msg.seed);
        }
        break;
      case "command":
        if (msg.cmd === "spawnShip" && state) {
          state.ships.push(msg.args.ship);
        } else if (msg.cmd === "spawnShipBullet" && state) {
          state.bullets.push(msg.args.bullet);
        } else if (msg.cmd === "setState") {
          state = msg.args.state;
        }
        break;
      default:
        break;
    }
  } catch (err) {
    const stack = err && err.stack ? err.stack : "";
    postMessage({ type: "error", message: String(err), stack });
  }
};
var simWorker_default = null;
export {
  simWorker_default as default
};
//# sourceMappingURL=simWorker.js.map
