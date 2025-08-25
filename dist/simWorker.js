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
  SIZE_DEFAULTS: () => SIZE_DEFAULTS,
  ShipConfig: () => ShipConfig,
  bulletKindForRadius: () => bulletKindForRadius,
  default: () => entitiesConfig_default,
  getDefaultShipType: () => getDefaultShipType,
  getShipConfig: () => getShipConfig,
  getSizeDefaults: () => getSizeDefaults,
  setAllSizeDefaults: () => setAllSizeDefaults,
  setSizeDefaults: () => setSizeDefaults
});
function getSizeDefaults(size) {
  return SIZE_DEFAULTS[size] || SIZE_DEFAULTS.small;
}
function setSizeDefaults(size, patch) {
  SIZE_DEFAULTS[size] = Object.assign({}, SIZE_DEFAULTS[size], patch);
}
function setAllSizeDefaults(patch) {
  SIZE_DEFAULTS.small = Object.assign({}, SIZE_DEFAULTS.small, patch);
  SIZE_DEFAULTS.medium = Object.assign({}, SIZE_DEFAULTS.medium, patch);
  SIZE_DEFAULTS.large = Object.assign({}, SIZE_DEFAULTS.large, patch);
}
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
var ShipConfig, SIZE_DEFAULTS, BULLET_DEFAULTS, PARTICLE_DEFAULTS, entitiesConfig_default;
var init_entitiesConfig = __esm({
  "src/config/entitiesConfig.ts"() {
    "use strict";
    ShipConfig = {
      fighter: {
        maxHp: 15,
        // size classification used for armor/shield tuning
        size: "small",
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
            // reduced back (/10)
            bulletRadius: 1.5,
            bulletTTL: 1.1
            // was 1.2
          }
        ],
        // Refined tuning: slightly higher accel and a moderate maxSpeed for clearer motion
        accel: 100,
        // ~10x accel
        turnRate: 6,
        maxSpeed: 2200
        // ~10x maxSpeed
      },
      corvette: {
        maxHp: 50,
        size: "medium",
        armor: 0,
        maxShield: Math.round(50 * 0.6),
        shieldRegen: 0.5,
        dmg: 5,
        damage: 5,
        radius: 20,
        accel: 80,
        turnRate: 3.5,
        // was 3
        maxSpeed: 1800,
        // ~10x increased
        cannons: [
          {
            damage: 6,
            rate: 1.2,
            spread: 0.05,
            muzzleSpeed: 180,
            // reduced back (/10)
            bulletRadius: 2,
            bulletTTL: 1.8
            // was 2.0
          }
        ]
      },
      frigate: {
        maxHp: 80,
        size: "medium",
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
            // reduced back (/10)
            bulletRadius: 2.5,
            bulletTTL: 2
            // was 2.2
          }
        ],
        accel: 70,
        turnRate: 2.5,
        // was 2.2
        maxSpeed: 1500
        // ~10x increased
      },
      destroyer: {
        maxHp: 120,
        size: "large",
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
          // reduced back (/10)
          bulletRadius: 2.5,
          bulletTTL: 1.8
          // was 2.4
        })),
        accel: 60,
        turnRate: 2,
        // was 1.6
        maxSpeed: 1300,
        // ~10x increased
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
        size: "large",
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
          // reduced back (/10)
          bulletRadius: 3,
          bulletTTL: 2.2
          // was 2.8
        })),
        accel: 55,
        turnRate: 1.2,
        // was 0.8
        maxSpeed: 1100,
        // ~10x increased
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
    SIZE_DEFAULTS = {
      small: {
        armor: 0,
        maxShield: 8,
        shieldRegen: 1,
        radius: 12,
        turnRate: 6,
        accel: 100,
        maxSpeed: 2200
      },
      medium: {
        armor: 1,
        maxShield: 40,
        shieldRegen: 0.5,
        radius: 24,
        turnRate: 3.5,
        accel: 80,
        maxSpeed: 1800
      },
      large: {
        armor: 2,
        maxShield: 120,
        shieldRegen: 0.25,
        radius: 40,
        turnRate: 2,
        accel: 60,
        maxSpeed: 1300
      }
    };
    BULLET_DEFAULTS = {
      damage: 1,
      ttl: 2,
      radius: 1.5,
      muzzleSpeed: 24
    };
    PARTICLE_DEFAULTS = {
      ttl: 1,
      color: "#fff",
      size: 2
    };
    entitiesConfig_default = ShipConfig;
  }
});

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
function acquireEffect(state2, key, createFn, initArgs) {
  const poolMap = state2.assetPool.effects;
  const counts = state2.assetPool.counts?.effects || /* @__PURE__ */ new Map();
  if (!state2.assetPool.counts) state2.assetPool.counts = { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: counts };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (free.length) {
    const obj = free.pop();
    try {
      if (typeof obj.reset === "function") obj.reset(initArgs);
      else if (initArgs && typeof initArgs === "object") Object.assign(obj, initArgs);
    } catch {
    }
    return obj;
  }
  const max = state2.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state2.assetPool.config.effectOverflowStrategy, "discard-oldest");
  const total = entry.allocated || counts.get(key) || 0;
  if (total < max || strategy === "grow") {
    const e2 = createFn();
    try {
      if (typeof e2.reset === "function") e2.reset(initArgs);
      else if (initArgs && typeof initArgs === "object") Object.assign(e2, initArgs);
    } catch {
    }
    entry.allocated = (entry.allocated || 0) + 1;
    _incCount(counts, key, 1);
    return e2;
  }
  if (strategy === "error") throw new Error(`Effect pool exhausted for key "${key}" (max=${max})`);
  const e = createFn();
  entry.allocated = (entry.allocated || 0) + 1;
  _incCount(counts, key, 1);
  return e;
}
function releaseEffect(state2, key, effect, disposeFn) {
  const poolMap = state2.assetPool.effects;
  const counts = state2.assetPool.counts?.effects || /* @__PURE__ */ new Map();
  if (!state2.assetPool.counts) state2.assetPool.counts = { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: counts };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (!free.includes(effect)) free.push(effect);
  const max = state2.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state2.assetPool.config.effectOverflowStrategy, "discard-oldest");
  if (strategy === "grow") return;
  while (free.length > max) {
    const victim = strategy === "discard-oldest" ? free.shift() : free.pop();
    try {
      if (disposeFn) disposeFn(victim);
    } catch {
    }
    _incCount(counts, key, -1);
  }
  if (strategy === "error" && free.length > max) {
    const victim = free.pop();
    try {
      if (disposeFn) disposeFn(victim);
    } catch {
    }
    _incCount(counts, key, -1);
  }
}
var nextId = 1;
function genId() {
  return nextId++;
}
function createShip(type = void 0, x = 0, y = 0, team = TEAM_DEFAULT) {
  const shipCfg = getShipConfig();
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType = type && shipCfg[type] ? type : availableTypes.length ? availableTypes[0] : getDefaultShipType();
  const rawCfg = shipCfg[resolvedType] || shipCfg[getDefaultShipType()];
  const sizeVal = rawCfg.size || (rawCfg.radius && rawCfg.radius >= 36 ? "large" : rawCfg.radius && rawCfg.radius >= 20 ? "medium" : "small");
  const sizeDefaults = getSizeDefaults(sizeVal);
  const cfg = Object.assign({}, sizeDefaults, rawCfg);
  return {
    id: genId(),
    type: resolvedType,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.maxHp ?? 0,
    maxHp: cfg.maxHp ?? 0,
    shield: cfg.maxShield ?? 0,
    maxShield: cfg.maxShield ?? 0,
    shieldRegen: cfg.shieldRegen ?? 0,
    armor: cfg.armor ?? 0,
    size: cfg.size || sizeVal,
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    accel: cfg.accel || 0,
    currentAccel: 0,
    throttle: 0,
    steering: 0,
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    // Ensure maxSpeed is always a sensible positive number. Some saved state
    // or malformed configs may have maxSpeed omitted or set to 0 which causes
    // ships to never translate (they can still rotate/fire). Prefer the
    // configured value but fall back to a safe default > 0.
    maxSpeed: typeof cfg.maxSpeed === "number" && cfg.maxSpeed > 0 ? cfg.maxSpeed : 120,
    angle: 0,
    trail: void 0,
    shieldPercent: 1,
    hpPercent: 1
  };
}
function createBullet(x, y, vx, vy, team = TEAM_DEFAULT, ownerId = null, damage = 1, ttl = 2) {
  return { id: genId(), x, y, vx, vy, team, ownerId, damage, ttl, prevX: x, prevY: y, _prevX: x, _prevY: y };
}
function createExplosionEffect(init) {
  return { x: init?.x ?? 0, y: init?.y ?? 0, r: init?.r, alive: true, _pooled: false, ...init };
}
function resetExplosionEffect(obj, init) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.r = init?.r;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
function createShieldHitEffect(init) {
  return { x: init?.x ?? 0, y: init?.y ?? 0, magnitude: init?.magnitude, alive: true, _pooled: false, ...init };
}
function resetShieldHitEffect(obj, init) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.magnitude = init?.magnitude;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
function createHealthHitEffect(init) {
  return { x: init?.x ?? 0, y: init?.y ?? 0, amount: init?.amount, alive: true, _pooled: false, ...init };
}
function resetHealthHitEffect(obj, init) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.amount = init?.amount;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
function makePooled(obj, resetFn) {
  const o = obj;
  if (typeof o.reset !== "function") {
    if (typeof resetFn === "function") {
      o.reset = function(initArgs) {
        try {
          resetFn(o, initArgs);
        } catch {
        }
      };
    } else {
      o.reset = function(initArgs) {
        if (initArgs && typeof initArgs === "object") Object.assign(o, initArgs);
      };
    }
  }
  return o;
}
function _getStrategy(v, def) {
  return v === "grow" || v === "error" || v === "discard-oldest" ? v : def;
}
function _incCount(map, key, delta) {
  const cur = map.get(key) || 0;
  const next = cur + delta;
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}
function releaseSprite(state2, key, sprite, disposeFn) {
  const poolMap = state2.assetPool.sprites;
  const counts = state2.assetPool.counts?.sprites || /* @__PURE__ */ new Map();
  if (!state2.assetPool.counts) state2.assetPool.counts = { textures: /* @__PURE__ */ new Map(), sprites: counts, effects: /* @__PURE__ */ new Map() };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (!free.includes(sprite)) free.push(sprite);
  const max = state2.assetPool.config.spritePoolSize || 256;
  const strategy = _getStrategy(state2.assetPool.config.spriteOverflowStrategy, "discard-oldest");
  if (strategy === "grow") return;
  while (free.length > max) {
    const victim = strategy === "discard-oldest" ? free.shift() : free.pop();
    try {
      if (disposeFn) disposeFn(victim);
    } catch {
    }
    _incCount(counts, key, -1);
  }
  if (strategy === "error" && free.length > max) {
    const victim = free.pop();
    try {
      if (disposeFn) disposeFn(victim);
    } catch {
    }
    _incCount(counts, key, -1);
  }
}
function updateTeamCount(state2, oldTeam, newTeam) {
  try {
    if (oldTeam) {
      state2.teamCounts[oldTeam] = Math.max(0, (state2.teamCounts[oldTeam] || 0) - 1);
    }
    if (newTeam) {
      state2.teamCounts[newTeam] = (state2.teamCounts[newTeam] || 0) + 1;
    }
  } catch (e) {
  }
}

// src/simulate.ts
init_entitiesConfig();

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
var SIM = {
  DT_MS: 16,
  MAX_ACC_MS: 250,
  bounds: { W: 1920, H: 1080 },
  // Use LOGICAL_MAP for default bounds
  friction: 0.99,
  gridCellSize: 64
};
var boundaryBehavior = {
  ships: "wrap",
  bullets: "remove"
};

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
        const enemies = (state2.ships || []).filter((sh) => sh && sh.team !== ship.team);
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
        const enemies = (state2.ships || []).filter((sh) => sh && sh.team !== ship.team);
        if (enemies.length) turretTarget = enemies[Math.floor(srandom() * enemies.length)];
      } else if (turret.targeting === "focus") {
        if (ship.__ai && ship.__ai.targetId != null) {
          const tId = ship.__ai.targetId;
          turretTarget = state2.shipMap && typeof tId !== "undefined" && tId !== null ? state2.shipMap.get(Number(tId)) || null : (state2.ships || []).find((sh) => sh && sh.id === tId) || null;
        }
      } else {
        const enemies = (state2.ships || []).filter((sh) => sh && sh.team !== ship.team);
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
      target = state2.shipMap && typeof ai.targetId !== "undefined" && ai.targetId !== null ? state2.shipMap.get(Number(ai.targetId)) || null : (state2.ships || []).find((sh) => sh && sh.id === ai.targetId) || null;
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
function releaseBullet(state2, b) {
  if (!b) return;
  if (!b.alive) return;
  b.alive = false;
  const arr = state2.bullets || [];
  const idx = arr.indexOf(b);
  if (idx !== -1) arr.splice(idx, 1);
  releaseSprite(state2, "bullet", b, void 0);
}
function acquireExplosion(state2, opts = {}) {
  const key = "explosion";
  const e = acquireEffect(state2, key, () => makePooled(createExplosionEffect(opts), resetExplosionEffect), opts);
  (state2.explosions ||= []).push(e);
  return e;
}
function releaseExplosion(state2, e) {
  if (!e) return;
  if (e._pooled) return;
  if (!e.alive) return;
  e.alive = false;
  e._pooled = true;
  const arr = state2.explosions || [];
  const idx = arr.indexOf(e);
  if (idx !== -1) arr.splice(idx, 1);
  releaseEffect(state2, "explosion", e, void 0);
}
function acquireShieldHit(state2, opts = {}) {
  const key = "shieldHit";
  const sh = acquireEffect(state2, key, () => makePooled(createShieldHitEffect(opts), resetShieldHitEffect), opts);
  (state2.shieldHits ||= []).push(sh);
  return sh;
}
function releaseShieldHit(state2, sh) {
  if (!sh) return;
  if (sh._pooled) return;
  const arr = state2.shieldHits || [];
  const i = arr.indexOf(sh);
  if (i !== -1) arr.splice(i, 1);
  sh.alive = false;
  sh._pooled = true;
  releaseEffect(state2, "shieldHit", sh, void 0);
}
function acquireHealthHit(state2, opts = {}) {
  const key = "healthHit";
  const hh = acquireEffect(state2, key, () => makePooled(createHealthHitEffect(opts), resetHealthHitEffect), opts);
  (state2.healthHits ||= []).push(hh);
  return hh;
}
function releaseHealthHit(state2, hh) {
  if (!hh) return;
  if (hh._pooled) return;
  const arr = state2.healthHits || [];
  const i = arr.indexOf(hh);
  if (i !== -1) arr.splice(i, 1);
  hh.alive = false;
  hh._pooled = true;
  releaseEffect(state2, "healthHit", hh, void 0);
}
var config = {
  shield: { ...SHIELD },
  health: { ...HEALTH },
  explosion: { ...EXPLOSION },
  stars: { ...STARS }
};
var _reinforcementInterval = TeamsConfig.continuousReinforcement?.interval ?? 5;
function releaseParticle(state2, p) {
  if (!p) return;
  const key = "particle";
  try {
    releaseEffect(state2, key, p, (x) => {
    });
  } catch {
  }
  const idx = (state2.particles || []).indexOf(p);
  if (idx !== -1) (state2.particles || []).splice(idx, 1);
}

// src/spatialGrid.ts
var spatialGrid_exports = {};
__export(spatialGrid_exports, {
  default: () => SpatialGrid,
  segmentIntersectsCircle: () => segmentIntersectsCircle
});
var SpatialGrid = class _SpatialGrid {
  cellSize;
  grid;
  // simple pooled instances to avoid per-frame allocations
  // pool keyed by cellSize to avoid reuse mismatch; cap instances per key
  static _pools = /* @__PURE__ */ new Map();
  static _perKeyCap = 4;
  static acquire(cellSize = 64) {
    const key = cellSize | 0;
    const pool = this._pools.get(key) || [];
    const inst = pool.pop();
    if (inst) {
      inst.cellSize = cellSize;
      return inst;
    }
    return new _SpatialGrid(cellSize);
  }
  static release(inst) {
    const key = (inst.cellSize || 64) | 0;
    inst.clear();
    let pool = this._pools.get(key);
    if (!pool) {
      pool = [];
      this._pools.set(key, pool);
    }
    if (pool.length < this._perKeyCap) pool.push(inst);
  }
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.grid = /* @__PURE__ */ new Map();
  }
  key(cx, cy) {
    return cx + "," + cy;
  }
  insert(entity) {
    const cx = Math.floor((entity.x || 0) / this.cellSize);
    const cy = Math.floor((entity.y || 0) / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.grid.get(k);
    if (!bucket) {
      bucket = [];
      this.grid.set(k, bucket);
    }
    bucket.push(entity);
  }
  queryRadius(x, y, radius) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const results = [];
    const seen = /* @__PURE__ */ new Set();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.grid.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const e of bucket) {
          if (!seen.has(e)) {
            seen.add(e);
            results.push(e);
          }
        }
      }
    }
    return results;
  }
  // clear internal storage for reuse
  clear() {
    this.grid.clear();
  }
};
function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  if (t1 >= 0 && t1 <= 1 || t2 >= 0 && t2 <= 1) return true;
  return false;
}

// src/simulate.ts
var SpatialGrid2 = SpatialGrid || spatialGrid_exports;
var segmentIntersectsCircle2 = segmentIntersectsCircle;
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
    const prevXVal = typeof b.x === "number" ? b.x : 0;
    const prevYVal = typeof b.y === "number" ? b.y : 0;
    b.prevX = prevXVal;
    b.prevY = prevYVal;
    b._prevX = prevXVal;
    b._prevY = prevYVal;
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
    if (remove) releaseBullet(state2, b);
  }
  function pruneAll(state3, dtSeconds2, bounds3) {
    state3.particles = state3.particles || [];
    state3.explosions = state3.explosions || [];
    state3.shieldHits = state3.shieldHits || [];
    state3.healthHits = state3.healthHits || [];
    let writeBullet = 0;
    for (let read = 0; read < state3.bullets.length; read++) {
      const b = state3.bullets[read];
      const prevXVal = typeof b.x === "number" ? b.x : 0;
      const prevYVal = typeof b.y === "number" ? b.y : 0;
      b.prevX = prevXVal;
      b.prevY = prevYVal;
      b._prevX = prevXVal;
      b._prevY = prevYVal;
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
        releaseBullet(state3, b);
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
    const friction = typeof SIM.friction === "number" ? SIM.friction : 0.98;
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
    if (remove) {
      const rem = state2.ships.splice(si, 1);
      if (rem && rem.length) {
        try {
          state2.shipMap && state2.shipMap.delete(rem[0].id);
        } catch (e) {
        }
        try {
          if (rem[0] && rem[0].team) state2.teamCounts[rem[0].team] = Math.max(0, (state2.teamCounts[rem[0].team] || 0) - 1);
        } catch (e) {
        }
      }
    }
    try {
      const shipCfg = getShipConfig && typeof getShipConfig === "function" ? getShipConfig() : {};
      const typeCfg = shipCfg && s.type ? shipCfg[s.type] : void 0;
      if (typeCfg && typeCfg.carrier) {
        const carrierCfg = typeCfg.carrier;
        s._carrierTimer = s._carrierTimer || 0;
        s._carrierTimer += dtSeconds;
        const cooldown = Number(carrierCfg.fighterCooldown) || 1.5;
        if (s._carrierTimer >= cooldown) {
          s._carrierTimer = 0;
          const existing = (state2.ships || []).filter((sh) => sh && sh.parentId === s.id && sh.type === "fighter").length;
          const maxF = Number(carrierCfg.maxFighters) || 0;
          const spawnPer = Number(carrierCfg.spawnPerCooldown) || 1;
          const canSpawn = Math.max(0, maxF - existing);
          let toSpawn = Math.min(canSpawn, spawnPer);
          while (toSpawn > 0) {
            const angle2 = srandom() * Math.PI * 2;
            const dist = (s.radius || 20) + 8 + srandom() * 8;
            const nx = (s.x || 0) + Math.cos(angle2) * dist;
            const ny = (s.y || 0) + Math.sin(angle2) * dist;
            try {
              const f = createShip("fighter", nx, ny, s.team);
              f.parentId = s.id;
              f.angle = s.angle;
              (state2.ships ||= []).push(f);
              try {
                state2.shipMap && state2.shipMap.set(f.id, f);
              } catch (e) {
              }
              try {
                updateTeamCount(state2, void 0, String(f.team));
              } catch (e) {
              }
            } catch (e) {
            }
            toSpawn--;
          }
        }
      }
    } catch (e) {
    }
  }
  const cellSize = SIM && SIM.gridCellSize || 64;
  const grid = SpatialGrid2.acquire(cellSize);
  const ships = state2.ships || [];
  for (let i = 0; i < ships.length; i++) grid.insert(ships[i]);
  const removedShipIds = /* @__PURE__ */ new Set();
  for (let bi = (state2.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state2.bullets[bi];
    const searchRadius = (b.radius || 1) + 64;
    const candidates = grid.queryRadius(b.x || 0, b.y || 0, searchRadius);
    let collided = false;
    for (let ci = 0; ci < candidates.length; ci++) {
      const s = candidates[ci];
      if (!s || removedShipIds.has(s.id)) continue;
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      const bxPrev = typeof b._prevX === "number" ? b._prevX : b.x - (b.vx || 0) * dtSeconds;
      const byPrev = typeof b._prevY === "number" ? b._prevY : b.y - (b.vy || 0) * dtSeconds;
      const didHit = dist2(b, s) <= r * r || segmentIntersectsCircle2(bxPrev, byPrev, b.x || 0, b.y || 0, s.x || 0, s.y || 0, r);
      if (didHit) {
        const attacker = typeof b.ownerId === "number" || typeof b.ownerId === "string" ? state2.shipMap && state2.shipMap.get(Number(b.ownerId)) : void 0;
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
          (state2.shieldHits ||= []).push(acquireShieldHit(state2, {
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
            const armor = s.armor || 0;
            const dmgMul = Math.max(0, 1 - 0.1 * armor);
            const dealt = Math.max(0, remaining * dmgMul);
            s.hp -= dealt;
            (state2.healthHits ||= []).push(acquireHealthHit(state2, {
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: dealt
            }));
            (state2.damageEvents ||= []).push({
              id: s.id,
              type: "hp",
              amount: dealt,
              x: b.x,
              y: b.y,
              team: s.team,
              attackerId: attacker && attacker.id
            });
          }
          dealtToShield = absorbed;
          const remainingAfterShield = Math.max(0, (b.damage || 0) - absorbed);
          const armorAfterShield = s.armor || 0;
          dealtToHealth = Math.max(0, remainingAfterShield * Math.max(0, 1 - 0.1 * armorAfterShield));
        } else {
          const armor = s.armor || 0;
          const dmgMulNoShield = Math.max(0, 1 - 0.1 * armor);
          const dealtNoShield = Math.max(0, (b.damage || 0) * dmgMulNoShield);
          s.hp -= dealtNoShield;
          (state2.healthHits ||= []).push(acquireHealthHit(state2, {
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: dealtNoShield
          }));
          (state2.damageEvents ||= []).push({
            id: s.id,
            type: "hp",
            amount: dealtNoShield,
            x: b.x,
            y: b.y,
            team: s.team,
            attackerId: attacker && attacker.id
          });
          dealtToHealth = dealtNoShield;
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
        collided = true;
        if (s.hp <= 0) {
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progression.xpPerKill || 0);
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
          (state2.explosions ||= []).push(acquireExplosion(state2, { x: s.x, y: s.y, team: s.team, life: 0.5, ttl: 0.5 }));
          const idx = (state2.ships || []).findIndex((sh) => sh && sh.id === s.id);
          if (idx >= 0) {
            state2.ships.splice(idx, 1);
            try {
              state2.shipMap && state2.shipMap.delete(s.id);
            } catch (e) {
            }
            try {
              if (s && s.team) state2.teamCounts[s.team] = Math.max(0, (state2.teamCounts[s.team] || 0) - 1);
            } catch (e) {
            }
          }
          removedShipIds.add(s.id);
        }
        break;
      }
    }
  }
  SpatialGrid2.release(grid);
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
          try {
            state.shipMap && state.shipMap.set(msg.args.ship.id, msg.args.ship);
          } catch (e) {
          }
          try {
            const tt = String(msg.args.ship.team || "");
            state.teamCounts[tt] = (state.teamCounts[tt] || 0) + 1;
          } catch (e) {
          }
        } else if (msg.cmd === "spawnShipBullet" && state) {
          state.bullets.push(msg.args.bullet);
        } else if (msg.cmd === "setState") {
          state = msg.args.state;
          try {
            state.shipMap = /* @__PURE__ */ new Map();
            state.teamCounts = { red: 0, blue: 0 };
            for (const s of state.ships || []) if (s && typeof s.id !== "undefined") {
              state.shipMap.set(s.id, s);
              try {
                const t = String(s.team || "");
                state.teamCounts[t] = (state.teamCounts[t] || 0) + 1;
              } catch (e) {
              }
            }
          } catch (e) {
          }
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
