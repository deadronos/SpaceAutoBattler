var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/config/entitiesConfig.ts
var entitiesConfig_exports = {};
__export(entitiesConfig_exports, {
  BULLET_DEFAULTS: () => BULLET_DEFAULTS,
  PARTICLE_DEFAULTS: () => PARTICLE_DEFAULTS,
  ShipConfig: () => ShipConfig,
  bulletKindForRadius: () => bulletKindForRadius,
  default: () => entitiesConfig_default,
  getDefaultShipType: () => getDefaultShipType,
  getShipConfig: () => getShipConfig
});
function getShipConfig() {
  return ShipConfig;
}
function bulletKindForRadius(r) {
  if (r < 2) return "small";
  if (r < 2.5) return "medium";
  if (r < 3.5) return "large";
  return "heavy";
}
function getDefaultShipType() {
  return Object.keys(ShipConfig)[0] || "fighter";
}
var ShipConfig, BULLET_DEFAULTS, PARTICLE_DEFAULTS, entitiesConfig_default;
var init_entitiesConfig = __esm({
  "src/config/entitiesConfig.ts"() {
    "use strict";
    ShipConfig = {
      fighter: {
        maxHp: 15,
        armor: 0,
        maxShield: 8,
        shieldRegen: 1,
        dmg: 3,
        damage: 3,
        radius: 12,
        cannons: [
          {
            damage: 3,
            rate: 3,
            spread: 0.1,
            muzzleSpeed: 260,
            // was 300
            bulletRadius: 1.5,
            bulletTTL: 1.1
            // was 1.2
          }
        ],
        accel: 5,
        turnRate: 6,
        maxSpeed: 160
      },
      corvette: {
        maxHp: 50,
        armor: 0,
        maxShield: Math.round(50 * 0.6),
        shieldRegen: 0.5,
        dmg: 5,
        damage: 5,
        radius: 20,
        accel: 5,
        turnRate: 3.5,
        // was 3
        maxSpeed: 145,
        // was 140
        cannons: [
          {
            damage: 6,
            rate: 1.2,
            spread: 0.05,
            muzzleSpeed: 180,
            // was 220
            bulletRadius: 2,
            bulletTTL: 1.8
            // was 2.0
          }
        ]
      },
      frigate: {
        maxHp: 80,
        armor: 1,
        maxShield: Math.round(80 * 0.6),
        shieldRegen: 0.4,
        dmg: 8,
        damage: 8,
        radius: 24,
        cannons: [
          {
            damage: 8,
            rate: 1,
            spread: 0.06,
            muzzleSpeed: 180,
            // was 200
            bulletRadius: 2.5,
            bulletTTL: 2
            // was 2.2
          }
        ],
        accel: 5,
        turnRate: 2.5,
        // was 2.2
        maxSpeed: 125
        // was 120
      },
      destroyer: {
        maxHp: 120,
        armor: 2,
        maxShield: Math.round(120 * 0.6),
        shieldRegen: 0.3,
        dmg: 12,
        damage: 12,
        radius: 40,
        cannons: new Array(6).fill(0).map(() => ({
          damage: 6,
          rate: 0.8,
          spread: 0.08,
          muzzleSpeed: 160,
          // was 240
          bulletRadius: 2.5,
          bulletTTL: 1.8
          // was 2.4
        })),
        accel: 5,
        turnRate: 2,
        // was 1.6
        maxSpeed: 110,
        // was 100
        turrets: [
          {
            position: [1.2, 0.8],
            kind: "basic",
            targeting: "nearest",
            cooldown: 0.8
          },
          {
            position: [-1.2, 0.8],
            kind: "basic",
            targeting: "nearest",
            cooldown: 0.8
          },
          {
            position: [1.2, -0.8],
            kind: "basic",
            targeting: "nearest",
            cooldown: 0.8
          },
          {
            position: [-1.2, -0.8],
            kind: "basic",
            targeting: "nearest",
            cooldown: 0.8
          },
          {
            position: [0, 1.5],
            kind: "basic",
            targeting: "nearest",
            cooldown: 0.8
          },
          {
            position: [0, -1.5],
            kind: "basic",
            targeting: "nearest",
            cooldown: 0.8
          }
        ]
      },
      carrier: {
        maxHp: 200,
        armor: 3,
        maxShield: Math.round(200 * 0.6),
        shieldRegen: 0.2,
        dmg: 2,
        damage: 2,
        radius: 40,
        cannons: new Array(4).fill(0).map(() => ({
          damage: 4,
          rate: 0.6,
          spread: 0.12,
          muzzleSpeed: 140,
          // was 180
          bulletRadius: 3,
          bulletTTL: 2.2
          // was 2.8
        })),
        accel: 5,
        turnRate: 1.2,
        // was 0.8
        maxSpeed: 95,
        // was 80
        carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
        turrets: [
          {
            position: [2, 1.2],
            kind: "basic",
            targeting: "nearest",
            cooldown: 1
          },
          {
            position: [-2, 1.2],
            kind: "basic",
            targeting: "nearest",
            cooldown: 1
          },
          {
            position: [2, -1.2],
            kind: "basic",
            targeting: "nearest",
            cooldown: 1
          },
          {
            position: [-2, -1.2],
            kind: "basic",
            targeting: "nearest",
            cooldown: 1
          }
        ]
      }
    };
    BULLET_DEFAULTS = {
      damage: 1,
      ttl: 2,
      radius: 1.5,
      muzzleSpeed: 240
    };
    PARTICLE_DEFAULTS = {
      ttl: 1,
      color: "#fff",
      size: 2
    };
    entitiesConfig_default = ShipConfig;
  }
});

// src/config/progressionConfig.ts
var progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level) => 100 * Math.pow(1.25, level - 1),
  hpPercentPerLevel: (level) => Math.min(0.1, 0.05 + 0.05 / Math.sqrt(level)),
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06,
  speedPercentPerLevel: 0.03,
  regenPercentPerLevel: 0.04
};

// src/config/simConfig.ts
var boundaryBehavior = {
  ships: "wrap",
  bullets: "remove"
};

// src/rng.ts
var _seed = 1;
function srand(seed = 1) {
  _seed = seed >>> 0;
}
function mulberry32(a) {
  return function() {
    let t = (a += 1831565813) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function srandom() {
  const f = mulberry32(_seed);
  _seed = _seed + 2654435761 >>> 0;
  return f();
}
function srange(min, max) {
  return min + (max - min) * srandom();
}

// src/entities.ts
init_entitiesConfig();

// src/config/teamsConfig.ts
init_entitiesConfig();
var TeamsConfig = {
  teams: {
    red: { id: "red", color: "#ff4d4d", label: "Red" },
    blue: { id: "blue", color: "#4da6ff", label: "Blue" }
  },
  defaultFleet: {
    counts: (() => {
      const shipCfg = getShipConfig();
      const types = Object.keys(shipCfg || {});
      const defaultCounts = {};
      for (const t of types) {
        if (t === "fighter") defaultCounts[t] = 8;
        else if (t === "corvette") defaultCounts[t] = 3;
        else if (t === "frigate") defaultCounts[t] = 2;
        else if (t === "destroyer") defaultCounts[t] = 1;
        else if (t === "carrier") defaultCounts[t] = 1;
        else defaultCounts[t] = 1;
      }
      return defaultCounts;
    })(),
    spacing: 28,
    jitter: { x: 80, y: 120 }
  },
  // continuousReinforcement controls: enable/disable, scoreMargin is the
  // imbalance fraction (e.g. 0.12 means reinforce when weakest ratio < 0.38),
  // perTick is the maximum ships considered per reinforcement tick, and
  // shipTypes is an optional array of types to choose from randomly. If
  // omitted, keys from defaultFleet.counts are used.
  continuousReinforcement: {
    enabled: false,
    scoreMargin: 0.12,
    perTick: 1,
    interval: 5,
    shipTypes: void 0
  }
};
var TEAM_DEFAULT = "red";

// src/entities.ts
var nextId = 1;
function genId() {
  return nextId++;
}
function createBullet(x, y, vx, vy, team = TEAM_DEFAULT, ownerId = null, damage = 1, ttl = 2) {
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

// src/config/behaviorConfig.ts
var AI_THRESHOLDS = {
  decisionTimerMin: 0.5,
  decisionTimerMax: 2,
  hpEvadeThreshold: 0.35,
  randomLow: 0.15,
  randomHigh: 0.85
};

// src/behavior.ts
init_entitiesConfig();
function len2(vx, vy) {
  return vx * vx + vy * vy;
}
function clampSpeed(s, max) {
  const v2 = len2(s.vx || 0, s.vy || 0);
  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx = (s.vx || 0) * inv;
    s.vy = (s.vy || 0) * inv;
  }
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
  if (Array.isArray(ship.cannons) && ship.cannons.length > 0) {
    for (const c of ship.cannons) {
      if (typeof c.__cd !== "number") c.__cd = 0;
      c.__cd -= dt;
      if (c.__cd > 0) continue;
      const spread = typeof c.spread === "number" ? c.spread : 0;
      const dir = aimWithSpread(ship, target, spread);
      const speed = typeof c.muzzleSpeed === "number" ? c.muzzleSpeed : BULLET_DEFAULTS.muzzleSpeed;
      const dmg = typeof c.damage === "number" ? c.damage : typeof ship.damage === "number" ? ship.damage : typeof ship.dmg === "number" ? ship.dmg : BULLET_DEFAULTS.damage;
      const ttl = typeof c.bulletTTL === "number" ? c.bulletTTL : BULLET_DEFAULTS.ttl;
      const radius = typeof c.bulletRadius === "number" ? c.bulletRadius : BULLET_DEFAULTS.radius;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        createBullet(
          ship.x || 0,
          ship.y || 0,
          vx,
          vy,
          ship.team || TEAM_DEFAULT,
          ship.id || null,
          dmg,
          ttl
        ),
        { radius }
      );
      state2.bullets.push(b);
      const rate = typeof c.rate === "number" && c.rate > 0 ? c.rate : 1;
      c.__cd = 1 / rate;
    }
  }
  if (Array.isArray(ship.turrets) && ship.turrets.length > 0) {
    for (const [i, turret] of ship.turrets.entries()) {
      if (!turret) continue;
      if (typeof turret.__cd !== "number") turret.__cd = 0;
      turret.__cd -= dt;
      if (turret.__cd > 0) continue;
      let turretTarget = null;
      if (turret.targeting === "nearest") {
        const enemies = (state2.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        let minDist = Infinity;
        for (const enemy of enemies) {
          const dx = (enemy.x || 0) - (ship.x || 0);
          const dy = (enemy.y || 0) - (ship.y || 0);
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            turretTarget = enemy;
          }
        }
      } else if (turret.targeting === "random") {
        const enemies = (state2.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        if (enemies.length)
          turretTarget = enemies[Math.floor(srandom() * enemies.length)];
      } else if (turret.targeting === "focus") {
        if (ship.__ai && ship.__ai.targetId != null) {
          turretTarget = (state2.ships || []).find(
            (sh) => sh && sh.id === ship.__ai.targetId
          ) || null;
        }
      } else {
        const enemies = (state2.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        let minDist = Infinity;
        for (const enemy of enemies) {
          const dx = (enemy.x || 0) - (ship.x || 0);
          const dy = (enemy.y || 0) - (ship.y || 0);
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            turretTarget = enemy;
          }
        }
      }
      if (!turretTarget) continue;
      const spread = typeof turret.spread === "number" ? turret.spread : 0.05;
      const dir = aimWithSpread(ship, turretTarget, spread);
      const speed = typeof turret.muzzleSpeed === "number" ? turret.muzzleSpeed : BULLET_DEFAULTS.muzzleSpeed;
      const dmg = typeof turret.damage === "number" ? turret.damage : typeof ship.damage === "number" ? ship.damage : BULLET_DEFAULTS.damage;
      const ttl = typeof turret.bulletTTL === "number" ? turret.bulletTTL : BULLET_DEFAULTS.ttl;
      const radius = typeof turret.bulletRadius === "number" ? turret.bulletRadius : BULLET_DEFAULTS.radius;
      const angle = ship.angle || 0;
      const shipType = ship.type || "fighter";
      const shipCfg = (init_entitiesConfig(), __toCommonJS(entitiesConfig_exports)).getShipConfig()[shipType];
      const configRadius = shipCfg && typeof shipCfg.radius === "number" ? shipCfg.radius : ship.radius || 12;
      const [tx, ty] = turret.position || [0, 0];
      const turretX = (ship.x || 0) + Math.cos(angle) * tx * configRadius - Math.sin(angle) * ty * configRadius;
      const turretY = (ship.y || 0) + Math.sin(angle) * tx * configRadius + Math.cos(angle) * ty * configRadius;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        createBullet(
          turretX,
          turretY,
          vx,
          vy,
          ship.team || TEAM_DEFAULT,
          ship.id || null,
          dmg,
          ttl
        ),
        { radius }
      );
      state2.bullets.push(b);
      turret.__cd = typeof turret.cooldown === "number" && turret.cooldown > 0 ? turret.cooldown : 1;
    }
  }
}
function ensureShipAiState(s) {
  if (!s.__ai) {
    s.__ai = { state: "idle", decisionTimer: 0, targetId: null };
  }
  return s.__ai;
}
function chooseNewTarget(state2, ship) {
  const enemies = (state2.ships || []).filter(
    (sh) => sh && sh.team !== ship.team
  );
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}
function applySimpleAI(state2, dt, bounds2 = { W: 800, H: 600 }) {
  if (!state2 || !Array.isArray(state2.ships)) return;
  for (const s of state2.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);
    let target = null;
    if (ai.targetId != null)
      target = (state2.ships || []).find((sh) => sh && sh.id === ai.targetId) || null;
    if (!target) target = chooseNewTarget(state2, s);
    if (target) ai.targetId = target.id;
    const maxAccel = typeof s.accel === "number" ? s.accel : 100;
    const maxSpeed = typeof s.maxSpeed === "number" ? s.maxSpeed : 160;
    s.steering = typeof s.steering === "number" ? s.steering : 0;
    s.throttle = typeof s.throttle === "number" ? s.throttle : 0;
    if (!target) {
      s.throttle = 0;
      s.steering = 0;
      ai.state = "idle";
    } else {
      if (ai.decisionTimer <= 0) {
        const hpFrac = (s.hp || 0) / Math.max(1, s.maxHp || 1);
        const rnd = srandom();
        if (hpFrac < AI_THRESHOLDS.hpEvadeThreshold || rnd < AI_THRESHOLDS.randomLow) ai.state = "evade";
        else if (rnd < AI_THRESHOLDS.randomHigh) ai.state = "engage";
        else ai.state = "idle";
        ai.decisionTimer = AI_THRESHOLDS.decisionTimerMin + srandom() * (AI_THRESHOLDS.decisionTimerMax - AI_THRESHOLDS.decisionTimerMin);
      }
      const dx = (target.x || 0) - (s.x || 0);
      const dy = (target.y || 0) - (s.y || 0);
      const desiredAngle = Math.atan2(dy, dx);
      const currentAngle = typeof s.angle === "number" ? s.angle : 0;
      let da = desiredAngle - currentAngle;
      while (da < -Math.PI) da += Math.PI * 2;
      while (da > Math.PI) da -= Math.PI * 2;
      const steeringNorm = Math.PI / 2;
      const steering = Math.max(-1, Math.min(1, da / steeringNorm));
      if (ai.state === "engage") {
        s.throttle = 1;
        s.steering = steering;
        tryFire(state2, s, target, dt);
      } else if (ai.state === "evade") {
        s.throttle = 0.8;
        const awayAngle = Math.atan2(
          (s.y || 0) - (target.y || 0),
          (s.x || 0) - (target.x || 0)
        );
        let daAway = awayAngle - currentAngle;
        while (daAway < -Math.PI) daAway += Math.PI * 2;
        while (daAway > Math.PI) daAway -= Math.PI * 2;
        s.steering = Math.max(-1, Math.min(1, daAway / steeringNorm));
      } else {
        s.throttle = 0;
        s.steering = 0;
      }
    }
    clampSpeed(s, maxSpeed);
  }
}

// src/gamemanager.ts
init_entitiesConfig();

// src/config/gamemanagerConfig.ts
var SHIELD = {
  ttl: 0.4,
  particleCount: 6,
  particleTTL: 0.5,
  particleColor: "#88ccff",
  particleSize: 2,
  // arcWidth (radians) for shield hit visual/particle spread centered on hitAngle
  // NOTE: Used in assetsConfig.ts visualStateDefaults and renderer logic. If not consumed, consider removing.
  arcWidth: Math.PI / 6
  // TODO: Ensure renderer/particle logic uses this or remove if redundant
};
var HEALTH = {
  ttl: 0.6,
  particleCount: 8,
  particleTTL: 0.6,
  particleColor: "#ffb3b3",
  particleSize: 2.5
};
var EXPLOSION = {
  particleCount: 30,
  particleTTL: 1.2,
  particleColor: "#ffaa33",
  particleSize: 3,
  minSpeed: 20,
  maxSpeed: 140
  // TODO: Unify particle effect configs with assetsConfig.ts animations for maintainability
};
var STARS = { twinkle: true, redrawInterval: 500, count: 140 };

// src/gamemanager.ts
init_entitiesConfig();
var particles = [];
var flashes = [];
var shieldFlashes = [];
var healthFlashes = [];
var particlePool = [];
var bulletPool = [];
var explosionPool = [];
var shieldHitPool = [];
var healthHitPool = [];
function releaseBullet(b) {
  if (!b.alive) return;
  b.alive = false;
  bulletPool.push(b);
}
function acquireExplosion(opts = {}) {
  let e;
  if (explosionPool.length) {
    e = explosionPool.pop();
    Object.assign(e, opts);
    e.alive = true;
    e._pooled = false;
  } else {
    e = { ...opts, alive: true, _pooled: false };
  }
  flashes.push(e);
  return e;
}
function releaseExplosion(e) {
  if (e._pooled) return;
  if (!e.alive) return;
  e.alive = false;
  e._pooled = true;
  explosionPool.push(e);
}
function acquireShieldHit(opts = {}) {
  let sh = null;
  if (shieldHitPool.length) {
    sh = shieldHitPool.pop();
    Object.assign(sh, opts);
    sh.alive = true;
    sh._pooled = false;
  } else {
    sh = { ...opts, alive: true, _pooled: false };
  }
  shieldFlashes.push(sh);
  return sh;
}
function releaseShieldHit(sh) {
  if (sh._pooled) return;
  const i = shieldFlashes.indexOf(sh);
  if (i !== -1) shieldFlashes.splice(i, 1);
  sh.alive = false;
  sh._pooled = true;
  shieldHitPool.push(sh);
}
function acquireHealthHit(opts = {}) {
  let hh = null;
  if (healthHitPool.length) {
    hh = healthHitPool.pop();
    Object.assign(hh, opts);
    hh.alive = true;
    hh._pooled = false;
  } else {
    hh = { ...opts, alive: true, _pooled: false };
  }
  healthFlashes.push(hh);
  return hh;
}
function releaseHealthHit(hh) {
  if (hh._pooled) return;
  const i = healthFlashes.indexOf(hh);
  if (i !== -1) healthFlashes.splice(i, 1);
  hh.alive = false;
  hh._pooled = true;
  healthHitPool.push(hh);
}
var config = {
  shield: { ...SHIELD },
  health: { ...HEALTH },
  explosion: { ...EXPLOSION },
  stars: { ...STARS }
};
var _reinforcementInterval = TeamsConfig.continuousReinforcement?.interval ?? 5;
function releaseParticle(p) {
  if (!p._pooled) {
    p._pooled = true;
    p.alive = false;
    const idx = particles.indexOf(p);
    if (idx !== -1) {
      particles.splice(idx, 1);
    }
    particlePool.push(p);
  }
}

// src/simulate.ts
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function simulateStep(state2, dtSeconds, bounds2) {
  pruneAll(state2, dtSeconds, bounds2);
  state2.t = (state2.t || 0) + dtSeconds;
  for (let i = (state2.bullets || []).length - 1; i >= 0; i--) {
    const b = state2.bullets[i];
    b.x += (b.vx || 0) * dtSeconds;
    b.y += (b.vy || 0) * dtSeconds;
    b.ttl = (b.ttl || 0) - dtSeconds;
    let outX = b.x < 0 || b.x >= bounds2.W;
    let outY = b.y < 0 || b.y >= bounds2.H;
    let outOfBounds = outX || outY;
    let remove = false;
    if (b.ttl <= 0) remove = true;
    else if (outOfBounds) {
      switch (boundaryBehavior.bullets) {
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (b.x < 0) b.x += bounds2.W;
          if (b.x >= bounds2.W) b.x -= bounds2.W;
          if (b.y < 0) b.y += bounds2.H;
          if (b.y >= bounds2.H) b.y -= bounds2.H;
          break;
        case "bounce":
          if (outX) {
            b.vx = -(b.vx || 0);
            b.x = Math.max(0, Math.min(bounds2.W, b.x));
          }
          if (outY) {
            b.vy = -(b.vy || 0);
            b.y = Math.max(0, Math.min(bounds2.H, b.y));
          }
          break;
      }
    }
    if (remove) releaseBullet(b);
  }
  function pruneAll(state3, dtSeconds2, bounds3) {
    state3.particles = state3.particles || [];
    state3.explosions = state3.explosions || [];
    state3.shieldHits = state3.shieldHits || [];
    state3.healthHits = state3.healthHits || [];
    let writeBullet = 0;
    for (let read = 0; read < state3.bullets.length; read++) {
      const b = state3.bullets[read];
      b.x += (b.vx || 0) * dtSeconds2;
      b.y += (b.vy || 0) * dtSeconds2;
      b.ttl = (b.ttl || 0) - dtSeconds2;
      let outX = b.x < 0 || b.x >= bounds3.W;
      let outY = b.y < 0 || b.y >= bounds3.H;
      let outOfBounds = outX || outY;
      let remove = false;
      if (b.ttl <= 0) remove = true;
      else if (outOfBounds) {
        switch (boundaryBehavior.bullets) {
          case "remove":
            remove = true;
            break;
          case "wrap":
            if (b.x < 0) b.x += bounds3.W;
            if (b.x >= bounds3.W) b.x -= bounds3.W;
            if (b.y < 0) b.y += bounds3.H;
            if (b.y >= bounds3.H) b.y -= bounds3.H;
            break;
          case "bounce":
            if (outX) {
              b.vx = -(b.vx || 0);
              b.x = Math.max(0, Math.min(bounds3.W, b.x));
            }
            if (outY) {
              b.vy = -(b.vy || 0);
              b.y = Math.max(0, Math.min(bounds3.H, b.y));
            }
            break;
        }
      }
      if (!remove) {
        state3.bullets[writeBullet++] = b;
      } else {
        releaseBullet(b);
      }
    }
    state3.bullets.length = writeBullet;
    let writeParticle = 0;
    for (let read = 0; read < state3.particles.length; read++) {
      const p = state3.particles[read];
      p.life = (p.life || p.ttl || 0) - dtSeconds2;
      if (p.life > 0) {
        state3.particles[writeParticle++] = p;
      } else {
        releaseParticle(p);
      }
    }
    state3.particles.length = writeParticle;
    let writeExplosion = 0;
    for (let read = 0; read < state3.explosions.length; read++) {
      const e = state3.explosions[read];
      e.life = (e.life || e.ttl || 0) - dtSeconds2;
      if (e.life > 0) {
        state3.explosions[writeExplosion++] = e;
      } else {
        releaseExplosion(e);
      }
    }
    state3.explosions.length = writeExplosion;
    let writeShield = 0;
    for (let read = 0; read < state3.shieldHits.length; read++) {
      const sh = state3.shieldHits[read];
      if (typeof sh.x === "number" && typeof sh.y === "number" && sh.x >= 0 && sh.x < bounds3.W && sh.y >= 0 && sh.y < bounds3.H) {
        state3.shieldHits[writeShield++] = sh;
      } else {
        releaseShieldHit(sh);
      }
    }
    state3.shieldHits.length = writeShield;
    let writeHealth = 0;
    for (let read = 0; read < state3.healthHits.length; read++) {
      const hh = state3.healthHits[read];
      if (typeof hh.x === "number" && typeof hh.y === "number" && hh.x >= 0 && hh.x < bounds3.W && hh.y >= 0 && hh.y < bounds3.H) {
        state3.healthHits[writeHealth++] = hh;
      } else {
        releaseHealthHit(hh);
      }
    }
    state3.healthHits.length = writeHealth;
  }
  for (let si = (state2.ships || []).length - 1; si >= 0; si--) {
    const s = state2.ships[si];
    const throttle = typeof s.throttle === "number" ? s.throttle : 0;
    const steering = typeof s.steering === "number" ? s.steering : 0;
    const accel = typeof s.accel === "number" ? s.accel : 0;
    const turnRate = typeof s.turnRate === "number" ? s.turnRate : 3;
    const maxSpeed = typeof s.maxSpeed === "number" ? s.maxSpeed : 160;
    const angle = typeof s.angle === "number" ? s.angle : 0;
    const maxTurn = turnRate * Math.abs(steering) * dtSeconds;
    if (steering !== 0) {
      let a = angle + Math.sign(steering) * maxTurn;
      while (a < -Math.PI) a += Math.PI * 2;
      while (a > Math.PI) a -= Math.PI * 2;
      s.angle = a;
    }
    const actualAccel = accel * throttle;
    if (actualAccel > 0) {
      s.vx = (s.vx || 0) + Math.cos(s.angle || 0) * actualAccel * dtSeconds;
      s.vy = (s.vy || 0) + Math.sin(s.angle || 0) * actualAccel * dtSeconds;
    }
    const friction = typeof s.friction === "number" ? s.friction : 0.98;
    s.vx = (s.vx || 0) * friction;
    s.vy = (s.vy || 0) * friction;
    clampSpeed(s, maxSpeed);
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    const r = typeof s.radius === "number" ? s.radius : 12;
    let outX = s.x < -r || s.x > bounds2.W + r;
    let outY = s.y < -r || s.y > bounds2.H + r;
    let outOfBounds = outX || outY;
    let remove = false;
    if (outOfBounds) {
      switch (boundaryBehavior.ships) {
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (s.x < -r) s.x += bounds2.W + r * 2;
          if (s.x > bounds2.W + r) s.x -= bounds2.W + r * 2;
          if (s.y < -r) s.y += bounds2.H + r * 2;
          if (s.y > bounds2.H + r) s.y -= bounds2.H + r * 2;
          break;
        case "bounce":
          if (outX) {
            s.vx = -(s.vx || 0);
            s.x = Math.max(-r, Math.min(bounds2.W + r, s.x));
          }
          if (outY) {
            s.vy = -(s.vy || 0);
            s.y = Math.max(-r, Math.min(bounds2.H + r, s.y));
          }
          break;
      }
    }
    if (remove) state2.ships.splice(si, 1);
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
          const hitAngle = Math.atan2(
            (b.y || 0) - (s.y || 0),
            (b.x || 0) - (s.x || 0)
          );
          (state2.shieldHits ||= []).push(acquireShieldHit({
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: absorbed,
            hitAngle
          }));
          (state2.damageEvents ||= []).push({
            id: s.id,
            type: "shield",
            amount: absorbed,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id
          });
          const remaining = (b.damage || 0) - absorbed;
          if (remaining > 0) {
            s.hp -= remaining;
            (state2.healthHits ||= []).push(acquireHealthHit({
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: remaining
            }));
            (state2.damageEvents ||= []).push({
              id: s.id,
              type: "hp",
              amount: remaining,
              x: b.x,
              y: b.y,
              team: s.team,
              attackerId: attacker && attacker.id
            });
          }
          dealtToShield = absorbed;
          dealtToHealth = Math.max(0, (b.damage || 0) - absorbed);
        } else {
          s.hp -= b.damage || 0;
          (state2.healthHits ||= []).push(acquireHealthHit({
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: b.damage || 0
          }));
          (state2.damageEvents ||= []).push({
            id: s.id,
            type: "hp",
            amount: b.damage || 0,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id
          });
          dealtToHealth = b.damage || 0;
        }
        s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
        s.shieldPercent = typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
        if (attacker) {
          attacker.xp = (attacker.xp || 0) + (dealtToShield + dealtToHealth) * (progression.xpPerDamage || 0);
          while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
            attacker.xp -= progression.xpToLevel(attacker.level || 1);
            attacker.level = (attacker.level || 1) + 1;
            const resolveScalar = (s2, lvl2) => typeof s2 === "function" ? s2(lvl2) : s2 || 0;
            const lvl = attacker.level || 1;
            const hpScalar = resolveScalar(
              progression.hpPercentPerLevel,
              lvl
            );
            const shScalar = resolveScalar(
              progression.shieldPercentPerLevel,
              lvl
            );
            const dmgScalar = resolveScalar(
              progression.dmgPercentPerLevel,
              lvl
            );
            const speedScalar = resolveScalar(
              progression.speedPercentPerLevel,
              lvl
            );
            const regenScalar = resolveScalar(
              progression.regenPercentPerLevel,
              lvl
            );
            const hpMul = 1 + hpScalar;
            const shMul = 1 + shScalar;
            const dmgMul = 1 + dmgScalar;
            attacker.maxHp = (attacker.maxHp || 0) * hpMul;
            attacker.hp = Math.min(attacker.maxHp, (attacker.hp || 0) * hpMul);
            if (typeof attacker.maxShield === "number") {
              attacker.maxShield = (attacker.maxShield || 0) * shMul;
              attacker.shield = Math.min(
                attacker.maxShield,
                (attacker.shield || 0) * shMul
              );
            }
            if (Array.isArray(attacker.cannons)) {
              for (const c of attacker.cannons) {
                if (typeof c.damage === "number") c.damage *= dmgMul;
              }
            }
            if (typeof speedScalar === "number" && typeof attacker.accel === "number")
              attacker.accel = attacker.accel * (1 + speedScalar);
            if (typeof regenScalar === "number" && typeof attacker.shieldRegen === "number")
              attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
          }
        }
        state2.bullets.splice(bi, 1);
        if (s.hp <= 0) {
          console.log(
            "DEBUG: KILL BRANCH, attacker",
            attacker && attacker.id,
            "xp before",
            attacker && attacker.xp
          );
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progression.xpPerKill || 0);
            console.log(
              "DEBUG: KILL XP AWARDED, attacker",
              attacker.id,
              "xp after",
              attacker.xp
            );
            while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
              attacker.xp -= progression.xpToLevel(attacker.level || 1);
              attacker.level = (attacker.level || 1) + 1;
              const resolveScalar = (s2, lvl2) => typeof s2 === "function" ? s2(lvl2) : s2 || 0;
              const lvl = attacker.level || 1;
              const hpScalar = resolveScalar(
                progression.hpPercentPerLevel,
                lvl
              );
              const shScalar = resolveScalar(
                progression.shieldPercentPerLevel,
                lvl
              );
              const dmgScalar = resolveScalar(
                progression.dmgPercentPerLevel,
                lvl
              );
              const speedScalar = resolveScalar(
                progression.speedPercentPerLevel,
                lvl
              );
              const regenScalar = resolveScalar(
                progression.regenPercentPerLevel,
                lvl
              );
              const hpMul = 1 + hpScalar;
              const shMul = 1 + shScalar;
              const dmgMul = 1 + dmgScalar;
              attacker.maxHp = (attacker.maxHp || 0) * hpMul;
              attacker.hp = Math.min(
                attacker.maxHp,
                (attacker.hp || 0) * hpMul
              );
              if (typeof attacker.maxShield === "number") {
                attacker.maxShield = (attacker.maxShield || 0) * shMul;
                attacker.shield = Math.min(
                  attacker.maxShield,
                  (attacker.shield || 0) * shMul
                );
              }
              if (Array.isArray(attacker.cannons)) {
                for (const c of attacker.cannons) {
                  if (typeof c.damage === "number") c.damage *= dmgMul;
                }
              }
              if (typeof speedScalar === "number" && typeof attacker.accel === "number")
                attacker.accel = attacker.accel * (1 + speedScalar);
              if (typeof regenScalar === "number" && typeof attacker.shieldRegen === "number")
                attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
            }
          }
          (state2.explosions ||= []).push(acquireExplosion({ x: s.x, y: s.y, team: s.team, life: 0.5, ttl: 0.5 }));
          state2.ships.splice(si, 1);
        }
        break;
      }
    }
  }
  for (const s of state2.ships || []) {
    if (s.maxShield)
      s.shield = Math.min(
        s.maxShield,
        (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds
      );
  }
  for (const s of state2.ships || []) {
    s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
    s.shieldPercent = typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
  }
  return state2;
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
    try {
      clearTransientEvents(state);
    } catch (e) {
    }
  } catch (e) {
  }
}
function clearTransientEvents(s) {
  if (!s || typeof s !== "object") return;
  try {
    if (Array.isArray(s.explosions)) s.explosions.length = 0;
    if (Array.isArray(s.shieldHits)) s.shieldHits.length = 0;
    if (Array.isArray(s.healthHits)) s.healthHits.length = 0;
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
  clearTransientEvents,
  simWorker_default as default
};
//# sourceMappingURL=simWorker.js.map
