var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config/entitiesConfig.ts
function getShipConfig() {
  return ShipConfig;
}
var ShipConfig;
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
var SIM = {
  DT_MS: 16,
  MAX_ACC_MS: 250,
  bounds: { W: 1920, H: 1080 },
  // Use LOGICAL_MAP for default bounds
  friction: 0.98,
  gridCellSize: 64
};
var boundaryBehavior = {
  ships: "wrap",
  bullets: "remove"
};

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

// src/entities.ts
function acquireEffect(state, key, createFn, initArgs) {
  const poolMap = state.assetPool.effects;
  const counts = state.assetPool.counts?.effects || /* @__PURE__ */ new Map();
  if (!state.assetPool.counts) state.assetPool.counts = { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: counts };
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
  const max = state.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, "discard-oldest");
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
function releaseEffect(state, key, effect, disposeFn) {
  const poolMap = state.assetPool.effects;
  const counts = state.assetPool.counts?.effects || /* @__PURE__ */ new Map();
  if (!state.assetPool.counts) state.assetPool.counts = { textures: /* @__PURE__ */ new Map(), sprites: /* @__PURE__ */ new Map(), effects: counts };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (!free.includes(effect)) free.push(effect);
  const max = state.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, "discard-oldest");
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
function releaseSprite(state, key, sprite, disposeFn) {
  const poolMap = state.assetPool.sprites;
  const counts = state.assetPool.counts?.sprites || /* @__PURE__ */ new Map();
  if (!state.assetPool.counts) state.assetPool.counts = { textures: /* @__PURE__ */ new Map(), sprites: counts, effects: /* @__PURE__ */ new Map() };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (!free.includes(sprite)) free.push(sprite);
  const max = state.assetPool.config.spritePoolSize || 256;
  const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, "discard-oldest");
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
function makeInitialState() {
  return {
    t: 0,
    ships: [],
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
    engineTrailsEnabled: true,
    assetPool: {
      textures: /* @__PURE__ */ new Map(),
      sprites: /* @__PURE__ */ new Map(),
      effects: /* @__PURE__ */ new Map(),
      counts: {
        textures: /* @__PURE__ */ new Map(),
        sprites: /* @__PURE__ */ new Map(),
        effects: /* @__PURE__ */ new Map()
      },
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128,
        textureOverflowStrategy: "discard-oldest",
        spriteOverflowStrategy: "discard-oldest",
        effectOverflowStrategy: "discard-oldest"
      }
    }
  };
}

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
function releaseBullet(state, b) {
  if (!b) return;
  if (!b.alive) return;
  b.alive = false;
  const arr = state.bullets || [];
  const idx = arr.indexOf(b);
  if (idx !== -1) arr.splice(idx, 1);
  releaseSprite(state, "bullet", b, void 0);
}
function acquireExplosion(state, opts = {}) {
  const key = "explosion";
  const e = acquireEffect(state, key, () => makePooled(createExplosionEffect(opts), resetExplosionEffect), opts);
  (state.explosions ||= []).push(e);
  return e;
}
function releaseExplosion(state, e) {
  if (!e) return;
  if (e._pooled) return;
  if (!e.alive) return;
  e.alive = false;
  e._pooled = true;
  const arr = state.explosions || [];
  const idx = arr.indexOf(e);
  if (idx !== -1) arr.splice(idx, 1);
  releaseEffect(state, "explosion", e, void 0);
}
function acquireShieldHit(state, opts = {}) {
  const key = "shieldHit";
  const sh = acquireEffect(state, key, () => makePooled(createShieldHitEffect(opts), resetShieldHitEffect), opts);
  (state.shieldHits ||= []).push(sh);
  return sh;
}
function releaseShieldHit(state, sh) {
  if (!sh) return;
  if (sh._pooled) return;
  const arr = state.shieldHits || [];
  const i = arr.indexOf(sh);
  if (i !== -1) arr.splice(i, 1);
  sh.alive = false;
  sh._pooled = true;
  releaseEffect(state, "shieldHit", sh, void 0);
}
function acquireHealthHit(state, opts = {}) {
  const key = "healthHit";
  const hh = acquireEffect(state, key, () => makePooled(createHealthHitEffect(opts), resetHealthHitEffect), opts);
  (state.healthHits ||= []).push(hh);
  return hh;
}
function releaseHealthHit(state, hh) {
  if (!hh) return;
  if (hh._pooled) return;
  const arr = state.healthHits || [];
  const i = arr.indexOf(hh);
  if (i !== -1) arr.splice(i, 1);
  hh.alive = false;
  hh._pooled = true;
  releaseEffect(state, "healthHit", hh, void 0);
}
var config = {
  shield: { ...SHIELD },
  health: { ...HEALTH },
  explosion: { ...EXPLOSION },
  stars: { ...STARS }
};
var _reinforcementInterval = TeamsConfig.continuousReinforcement?.interval ?? 5;
function releaseParticle(state, p) {
  if (!p) return;
  const key = "particle";
  try {
    releaseEffect(state, key, p, (x) => {
    });
  } catch {
  }
  const idx = (state.particles || []).indexOf(p);
  if (idx !== -1) (state.particles || []).splice(idx, 1);
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
function simulateStep(state, dtSeconds, bounds) {
  pruneAll(state, dtSeconds, bounds);
  state.t = (state.t || 0) + dtSeconds;
  for (let i = (state.bullets || []).length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.prevX = typeof b.x === "number" ? b.x : 0;
    b.prevY = typeof b.y === "number" ? b.y : 0;
    b.x += (b.vx || 0) * dtSeconds;
    b.y += (b.vy || 0) * dtSeconds;
    b.ttl = (b.ttl || 0) - dtSeconds;
    let outX = b.x < 0 || b.x >= bounds.W;
    let outY = b.y < 0 || b.y >= bounds.H;
    let outOfBounds = outX || outY;
    let remove = false;
    if (b.ttl <= 0) remove = true;
    else if (outOfBounds) {
      switch (boundaryBehavior.bullets) {
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (b.x < 0) b.x += bounds.W;
          if (b.x >= bounds.W) b.x -= bounds.W;
          if (b.y < 0) b.y += bounds.H;
          if (b.y >= bounds.H) b.y -= bounds.H;
          break;
        case "bounce":
          if (outX) {
            b.vx = -(b.vx || 0);
            b.x = Math.max(0, Math.min(bounds.W, b.x));
          }
          if (outY) {
            b.vy = -(b.vy || 0);
            b.y = Math.max(0, Math.min(bounds.H, b.y));
          }
          break;
      }
    }
    if (remove) releaseBullet(state, b);
  }
  function pruneAll(state2, dtSeconds2, bounds2) {
    state2.particles = state2.particles || [];
    state2.explosions = state2.explosions || [];
    state2.shieldHits = state2.shieldHits || [];
    state2.healthHits = state2.healthHits || [];
    let writeBullet = 0;
    for (let read = 0; read < state2.bullets.length; read++) {
      const b = state2.bullets[read];
      b.x += (b.vx || 0) * dtSeconds2;
      b.y += (b.vy || 0) * dtSeconds2;
      b.ttl = (b.ttl || 0) - dtSeconds2;
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
      if (!remove) {
        state2.bullets[writeBullet++] = b;
      } else {
        releaseBullet(state2, b);
      }
    }
    state2.bullets.length = writeBullet;
    let writeParticle = 0;
    for (let read = 0; read < state2.particles.length; read++) {
      const p = state2.particles[read];
      p.life = (p.life || p.ttl || 0) - dtSeconds2;
      if (p.life > 0) {
        state2.particles[writeParticle++] = p;
      } else {
        releaseParticle(p);
      }
    }
    state2.particles.length = writeParticle;
    let writeExplosion = 0;
    for (let read = 0; read < state2.explosions.length; read++) {
      const e = state2.explosions[read];
      e.life = (e.life || e.ttl || 0) - dtSeconds2;
      if (e.life > 0) {
        state2.explosions[writeExplosion++] = e;
      } else {
        releaseExplosion(e);
      }
    }
    state2.explosions.length = writeExplosion;
    let writeShield = 0;
    for (let read = 0; read < state2.shieldHits.length; read++) {
      const sh = state2.shieldHits[read];
      if (typeof sh.x === "number" && typeof sh.y === "number" && sh.x >= 0 && sh.x < bounds2.W && sh.y >= 0 && sh.y < bounds2.H) {
        state2.shieldHits[writeShield++] = sh;
      } else {
        releaseShieldHit(sh);
      }
    }
    state2.shieldHits.length = writeShield;
    let writeHealth = 0;
    for (let read = 0; read < state2.healthHits.length; read++) {
      const hh = state2.healthHits[read];
      if (typeof hh.x === "number" && typeof hh.y === "number" && hh.x >= 0 && hh.x < bounds2.W && hh.y >= 0 && hh.y < bounds2.H) {
        state2.healthHits[writeHealth++] = hh;
      } else {
        releaseHealthHit(hh);
      }
    }
    state2.healthHits.length = writeHealth;
  }
  for (let si = (state.ships || []).length - 1; si >= 0; si--) {
    const s = state.ships[si];
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
    let outX = s.x < -r || s.x > bounds.W + r;
    let outY = s.y < -r || s.y > bounds.H + r;
    let outOfBounds = outX || outY;
    let remove = false;
    if (outOfBounds) {
      switch (boundaryBehavior.ships) {
        case "remove":
          remove = true;
          break;
        case "wrap":
          if (s.x < -r) s.x += bounds.W + r * 2;
          if (s.x > bounds.W + r) s.x -= bounds.W + r * 2;
          if (s.y < -r) s.y += bounds.H + r * 2;
          if (s.y > bounds.H + r) s.y -= bounds.H + r * 2;
          break;
        case "bounce":
          if (outX) {
            s.vx = -(s.vx || 0);
            s.x = Math.max(-r, Math.min(bounds.W + r, s.x));
          }
          if (outY) {
            s.vy = -(s.vy || 0);
            s.y = Math.max(-r, Math.min(bounds.H + r, s.y));
          }
          break;
      }
    }
    if (remove) state.ships.splice(si, 1);
  }
  const cellSize = SIM && SIM.gridCellSize || 64;
  const grid = SpatialGrid2.acquire(cellSize);
  const ships = state.ships || [];
  for (let i = 0; i < ships.length; i++) grid.insert(ships[i]);
  const removedShipIds = /* @__PURE__ */ new Set();
  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
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
        const attacker = typeof b.ownerId === "number" || typeof b.ownerId === "string" ? (state.ships || []).find((sh) => sh.id === b.ownerId) : void 0;
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
          (state.shieldHits ||= []).push(acquireShieldHit(state, {
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: absorbed,
            hitAngle
          }));
          (state.damageEvents ||= []).push({
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
            (state.healthHits ||= []).push(acquireHealthHit(state, {
              id: s.id,
              x: b.x,
              y: b.y,
              team: s.team,
              amount: remaining
            }));
            (state.damageEvents ||= []).push({
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
          (state.healthHits ||= []).push(acquireHealthHit(state, {
            id: s.id,
            x: b.x,
            y: b.y,
            team: s.team,
            amount: b.damage || 0
          }));
          (state.damageEvents ||= []).push({
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
        state.bullets.splice(bi, 1);
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
          (state.explosions ||= []).push(acquireExplosion(state, { x: s.x, y: s.y, team: s.team, life: 0.5, ttl: 0.5 }));
          const idx = (state.ships || []).findIndex((sh) => sh && sh.id === s.id);
          if (idx >= 0) state.ships.splice(idx, 1);
          removedShipIds.add(s.id);
        }
        break;
      }
    }
  }
  SpatialGrid2.release(grid);
  for (const s of state.ships || []) {
    if (s.maxShield)
      s.shield = Math.min(
        s.maxShield,
        (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds
      );
  }
  for (const s of state.ships || []) {
    s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
    s.shieldPercent = typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
  }
  return state;
}
var simulate_default = { simulateStep };

// scripts/benchmark_simulate_runner.ts
if (process.env.SIM_GRID_CELL_SIZE) {
  const v = Number(process.env.SIM_GRID_CELL_SIZE);
  if (!Number.isNaN(v) && v > 0) {
    SIM.gridCellSize = v;
    console.log("Overriding SIM.gridCellSize ->", v);
  }
}
var simulateStep2 = simulate_default.simulateStep || simulate_default.default?.simulateStep || simulate_default.default;
function makeState(shipsCount, bulletsCount, areaW = 2e3, areaH = 2e3) {
  const state = makeInitialState();
  state.ships = [];
  state.bullets = [];
  for (let i = 0; i < shipsCount; i++) {
    state.ships.push({ id: i, x: Math.random() * areaW, y: Math.random() * areaH, team: i % 2 === 0 ? "red" : "blue", hp: 10, maxHp: 10, radius: 8, shield: 0 });
  }
  for (let i = 0; i < bulletsCount; i++) {
    state.bullets.push({ id: i, x: Math.random() * areaW, y: Math.random() * areaH, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, team: i % 2 === 0 ? "red" : "blue", damage: 2, ttl: 1, radius: 1 });
  }
  state.t = 0;
  return state;
}
function benchScenario(ships, bullets, runs = 20) {
  const bounds = { W: 2e3, H: 2e3 };
  const dt = 1 / 60;
  const stateTemplate = makeState(ships, bullets, bounds.W, bounds.H);
  console.log("assetPool.effects instanceof Map?", stateTemplate.assetPool?.effects instanceof Map);
  for (let w = 0; w < 3; w++) {
    const s = makeState(ships, bullets, bounds.W, bounds.H);
    simulateStep2(s, dt, bounds);
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) {
    const s = makeState(ships, bullets, bounds.W, bounds.H);
    simulateStep2(s, dt, bounds);
  }
  const end = process.hrtime.bigint();
  const avgMs = Number((end - start) / BigInt(runs)) / 1e6;
  console.log(`simulateStep avg time for ships=${ships} bullets=${bullets}: ${avgMs.toFixed(3)} ms`);
}
async function main() {
  console.log("Running simulateStep benchmark (single-step)");
  benchScenario(50, 200, 50);
  benchScenario(200, 800, 30);
  benchScenario(500, 2e3, 10);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
