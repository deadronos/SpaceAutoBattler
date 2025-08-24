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

// src/entities.ts
init_entitiesConfig();

// src/config/teamsConfig.ts
init_entitiesConfig();

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

// src/config/teamsConfig.ts
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
function mulberry322(seed) {
  let t = seed >>> 0;
  return function() {
    t += 1831565813;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function hashStringToInt(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function generateFleetForTeam(seed = 0, teamId = "red", bounds = { W: 800, H: 600 }, shipFactory, options = {}) {
  const cfg = Object.assign({}, TeamsConfig.defaultFleet, options.fleet || {});
  const spacing = options.spacing ?? cfg.spacing;
  const jitter = Object.assign({}, cfg.jitter, options.jitter || {});
  const centerY = bounds.H / 2;
  const baseX = teamId === "red" ? bounds.W * 0.22 : bounds.W * 0.78;
  const rng = mulberry322((seed >>> 0) + hashStringToInt(teamId));
  const out = [];
  for (const [type, count] of Object.entries(cfg.counts)) {
    for (let i = 0; i < count; i++) {
      const r = spacing * Math.sqrt(rng());
      const angle = rng() * Math.PI * 2;
      const dx = Math.cos(angle) * r + (rng() - 0.5) * (jitter.x ?? 0);
      const dy = Math.sin(angle) * r + (rng() - 0.5) * (jitter.y ?? 0);
      const x = Math.max(0, Math.min(bounds.W - 1e-6, baseX + dx));
      const y = Math.max(0, Math.min(bounds.H - 1e-6, centerY + dy));
      if (typeof shipFactory === "function")
        out.push(shipFactory(type, x, y, teamId));
      else out.push({ type, x, y, team: teamId });
    }
  }
  return out;
}
function makeInitialFleets(seed = 0, bounds = { W: 800, H: 600 }, shipFactory, options = {}) {
  const red = generateFleetForTeam(seed, "red", bounds, shipFactory, options);
  const blue = generateFleetForTeam(
    seed + 1,
    "blue",
    bounds,
    shipFactory,
    options
  );
  return red.concat(blue);
}
function chooseReinforcements(seed = 0, state = {}, options = {}) {
  const cfg = Object.assign({}, TeamsConfig.continuousReinforcement, options);
  if (!cfg.enabled) return [];
  const teamStrength = {};
  if (Array.isArray(state.ships)) {
    for (const s of state.ships) {
      if (!s || !s.team) continue;
      const hp = typeof s.hp === "number" ? s.hp : 1;
      teamStrength[s.team] = (teamStrength[s.team] || 0) + hp;
    }
  }
  const teams = Object.keys(TeamsConfig.teams);
  if (teams.length === 0) return [];
  for (const t of teams) {
    if (!teamStrength[t]) {
      const cnt = (state.ships || []).filter(
        (s) => s && s.team === t
      ).length;
      teamStrength[t] = cnt > 0 ? cnt : 0;
    }
  }
  let weakest = teams[0];
  let strongest = teams[0];
  for (const t of teams) {
    if (teamStrength[t] < teamStrength[weakest]) weakest = t;
    if (teamStrength[t] > teamStrength[strongest]) strongest = t;
  }
  const total = teams.reduce((s, t) => s + (teamStrength[t] || 0), 0) || 1;
  const weakestRatio = (teamStrength[weakest] || 0) / total;
  if (weakestRatio < 0.5 - cfg.scoreMargin) {
    const orders = [];
    const rng = mulberry322((seed >>> 0) + hashStringToInt(weakest));
    const candidateTypes = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length ? cfg.shipTypes : Object.keys(TeamsConfig.defaultFleet.counts || { fighter: 1 });
    const countsMap = TeamsConfig && TeamsConfig.defaultFleet && TeamsConfig.defaultFleet.counts ? TeamsConfig.defaultFleet.counts : {};
    const weights = candidateTypes.map(
      (t) => Math.max(0, Number(countsMap[t]) || 1)
    );
    const totalWeight = weights.reduce((s, w) => s + w, 0) || candidateTypes.length || 1;
    const weightedPick = () => {
      const r = rng() * totalWeight;
      let acc = 0;
      for (let i = 0; i < candidateTypes.length; i++) {
        acc += weights[i];
        if (r < acc) return candidateTypes[i];
      }
      return candidateTypes[candidateTypes.length - 1];
    };
    const maxPerTick = Math.max(1, Math.floor(Number(cfg.perTick) || 1));
    const spawnCount = Math.max(1, Math.floor(rng() * maxPerTick) + 1);
    const b = options.bounds || { W: 800, H: 600 };
    const centerY = b.H / 2;
    const baseX = weakest === "red" ? b.W * 0.18 : b.W * 0.82;
    for (let i = 0; i < spawnCount; i++) {
      const x = Math.max(0, Math.min(b.W - 1e-6, baseX + (rng() - 0.5) * 120));
      const y = Math.max(
        0,
        Math.min(b.H - 1e-6, centerY + (rng() - 0.5) * 160)
      );
      const type = Array.isArray(cfg.shipTypes) && cfg.shipTypes.length ? candidateTypes[Math.floor(rng() * candidateTypes.length)] || getDefaultShipType() : weightedPick();
      orders.push({ type, team: weakest, x, y });
    }
    return orders;
  }
  return [];
}
var TEAM_DEFAULT = "red";
var teamsConfig_default = TeamsConfig;
function chooseReinforcementsWithManagerSeed(state = {}, options = {}) {
  const seed = Math.floor(srandom() * 4294967295) >>> 0;
  return chooseReinforcements(seed, state, options);
}

// src/entities.ts
var nextId = 1;
function genId() {
  return nextId++;
}
function createShip(type = void 0, x = 0, y = 0, team = TEAM_DEFAULT) {
  const shipCfg = getShipConfig();
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType = type && shipCfg[type] ? type : availableTypes.length ? availableTypes[0] : getDefaultShipType();
  const cfg = shipCfg[resolvedType] || shipCfg[getDefaultShipType()];
  return {
    id: genId(),
    type: resolvedType,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    shield: cfg.maxShield || 0,
    maxShield: cfg.maxShield || 0,
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    accel: cfg.accel || 0,
    currentAccel: 0,
    // start at rest, AI/gamemanager sets this
    throttle: 0,
    // start at rest, AI/gamemanager sets this
    steering: 0,
    // start straight, AI/gamemanager sets this
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    maxSpeed: cfg.maxSpeed || void 0,
    angle: 0
  };
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
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128
      }
    }
  };
}
function acquireTexture(state, key, createFn) {
  const pool = state.assetPool.textures;
  const arr = pool.get(key) || [];
  if (arr.length) {
    return arr.pop();
  }
  const total = arr.length;
  if (total < (state.assetPool.config.texturePoolSize || 128)) {
    const tex = createFn();
    return tex;
  }
  return arr.shift();
}
function releaseTexture(state, key, tex) {
  const pool = state.assetPool.textures;
  let arr = pool.get(key);
  if (!arr) {
    arr = [];
    pool.set(key, arr);
  }
  if (!arr.includes(tex)) arr.push(tex);
}

// src/gamemanager.ts
init_entitiesConfig();

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
function tryFire(state, ship, target, dt) {
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
      state.bullets.push(b);
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
        const enemies = (state.ships || []).filter(
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
        const enemies = (state.ships || []).filter(
          (sh) => sh && sh.team !== ship.team
        );
        if (enemies.length)
          turretTarget = enemies[Math.floor(srandom() * enemies.length)];
      } else if (turret.targeting === "focus") {
        if (ship.__ai && ship.__ai.targetId != null) {
          turretTarget = (state.ships || []).find(
            (sh) => sh && sh.id === ship.__ai.targetId
          ) || null;
        }
      } else {
        const enemies = (state.ships || []).filter(
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
      state.bullets.push(b);
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
function chooseNewTarget(state, ship) {
  const enemies = (state.ships || []).filter(
    (sh) => sh && sh.team !== ship.team
  );
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}
function applySimpleAI(state, dt, bounds = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);
    let target = null;
    if (ai.targetId != null)
      target = (state.ships || []).find((sh) => sh && sh.id === ai.targetId) || null;
    if (!target) target = chooseNewTarget(state, s);
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
        tryFire(state, s, target, dt);
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
  bounds: { W: 1920, H: 1080 }
  // Use LOGICAL_MAP for default bounds
};
var boundaryBehavior = {
  ships: "wrap",
  bullets: "remove"
};
var LOGICAL_MAP = { W: 1920, H: 1080 };
function getDefaultBounds() {
  return { W: LOGICAL_MAP.W, H: LOGICAL_MAP.H };
}

// src/simulate.ts
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
    if (remove) releaseBullet(b);
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
        releaseBullet(b);
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
    const friction = typeof s.friction === "number" ? s.friction : 0.98;
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
  for (let bi = (state.bullets || []).length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    for (let si = (state.ships || []).length - 1; si >= 0; si--) {
      const s = state.ships[si];
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      if (dist2(b, s) <= r * r) {
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
          (state.shieldHits ||= []).push(acquireShieldHit({
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
            (state.healthHits ||= []).push(acquireHealthHit({
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
          (state.healthHits ||= []).push(acquireHealthHit({
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
          (state.explosions ||= []).push(acquireExplosion({ x: s.x, y: s.y, team: s.team, life: 0.5, ttl: 0.5 }));
          state.ships.splice(si, 1);
        }
        break;
      }
    }
  }
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

// src/createSimWorker.ts
function createSimWorker(url = "./simWorker.js") {
  const worker = new Worker(url, { type: "module" });
  const listeners = /* @__PURE__ */ new Map();
  worker.onmessage = (ev) => {
    const msg = ev.data;
    const cb = listeners.get(msg && msg.type);
    if (cb) cb(msg);
  };
  return {
    post(msg) {
      worker.postMessage(msg);
    },
    on(type, cb) {
      listeners.set(type, cb);
    },
    terminate() {
      worker.terminate();
    }
  };
}

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
var FALLBACK_POSITIONS = [
  { x: 100, y: 100, team: "red" },
  { x: 700, y: 500, team: "blue" }
];
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
var _seed2 = null;
var _reinforcementInterval = TeamsConfig.continuousReinforcement?.interval ?? 5;
var _reinforcementAccumulator = 0;
var starCanvas = null;
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
function setReinforcementInterval(seconds) {
  _reinforcementInterval = Number(seconds) || (TeamsConfig.continuousReinforcement?.interval ?? 5);
}
function getReinforcementInterval() {
  return _reinforcementInterval;
}
function emitManagerEvent(map, type, data) {
  const arr = map.get(type) || [];
  for (const cb of arr.slice()) {
    try {
      if (typeof cb === "function") cb(data);
    } catch (e) {
    }
  }
}
function evaluateReinforcement(dt, state, continuousOptions = {}) {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    try {
      if (typeof chooseReinforcementsWithManagerSeed === "function") {
        const orders = chooseReinforcementsWithManagerSeed(state, {
          ...continuousOptions,
          bounds: SIM.bounds,
          enabled: true
        });
        if (Array.isArray(orders) && orders.length) {
          const spawned = [];
          for (const o of orders) {
            try {
              const ship = createShip(
                o.type || getDefaultShipType(),
                o.x || 100,
                o.y || 100,
                o.team || "red"
              );
              state.ships.push(ship);
              spawned.push(ship);
            } catch (e) {
            }
          }
          return { spawned };
        }
      }
      const fallback = getDefaultShipType();
      const r = createShip(
        fallback,
        FALLBACK_POSITIONS[0].x,
        FALLBACK_POSITIONS[0].y,
        FALLBACK_POSITIONS[0].team
      );
      const b = createShip(
        fallback,
        FALLBACK_POSITIONS[1].x,
        FALLBACK_POSITIONS[1].y,
        FALLBACK_POSITIONS[1].team
      );
      state.ships.push(r);
      state.ships.push(b);
      return { spawned: [r, b] };
    } catch (e) {
      return null;
    }
  }
  return null;
}
function createGameManager({
  useWorker = true,
  renderer = null,
  seed = 12345,
  createSimWorker: createSimWorkerFactory
} = {}) {
  let state = makeInitialState();
  let running = false;
  const listeners = /* @__PURE__ */ new Map();
  const workerReadyCbs = [];
  let simWorker = null;
  let _workerReadyHandler = null;
  let _workerSnapshotHandler = null;
  let _workerReinforcementsHandler = null;
  let workerReady = false;
  let lastReinforcement = {
    spawned: [],
    timestamp: 0,
    options: {}
  };
  let continuous = false;
  let continuousOptions = {};
  function emit(type, msg) {
    emitManagerEvent(listeners, type, msg);
  }
  function _mgr_random() {
    return srandom();
  }
  try {
    if (useWorker) {
      const factory = createSimWorkerFactory || createSimWorker;
      let simWorkerUrl;
      try {
        simWorkerUrl = typeof import.meta !== "undefined" && import.meta.url ? new URL("./simWorker.js", import.meta.url).href : "./simWorker.js";
      } catch (e) {
        simWorkerUrl = "./simWorker.js";
      }
      simWorker = factory(simWorkerUrl);
      _workerReadyHandler = () => {
        workerReady = true;
        for (const cb of workerReadyCbs.slice()) {
          try {
            cb();
          } catch (e) {
          }
        }
      };
      simWorker.on && simWorker.on("ready", _workerReadyHandler);
      _workerSnapshotHandler = (m) => {
        if (m && m.state) state = m.state;
      };
      simWorker.on && simWorker.on("snapshot", _workerSnapshotHandler);
      _workerReinforcementsHandler = (m) => {
        emit("reinforcements", m);
      };
      simWorker.on && simWorker.on("reinforcements", _workerReinforcementsHandler);
      try {
        simWorker.post({
          type: "init",
          seed,
          bounds: SIM.bounds,
          simDtMs: SIM.DT_MS,
          state
        });
        simWorker.post({ type: "start" });
      } catch (e) {
      }
    }
  } catch (e) {
    simWorker = null;
  }
  function _evaluateAndEmit(dt) {
    const result = evaluateReinforcement(dt, state, continuousOptions);
    if (result && Array.isArray(result.spawned) && result.spawned.length) {
      lastReinforcement = {
        spawned: result.spawned,
        timestamp: Date.now(),
        options: { ...continuousOptions }
      };
      emit("reinforcements", { spawned: result.spawned });
    }
  }
  function step(dtSeconds) {
    const clampedDt = Math.min(dtSeconds, 0.05);
    if (!simWorker) {
      try {
        applySimpleAI(state, clampedDt, SIM.bounds);
      } catch (e) {
      }
      try {
        simulateStep(state, clampedDt, SIM.bounds);
      } catch (e) {
      }
    } else {
      try {
        simWorker.post && simWorker.post({ type: "snapshotRequest" });
      } catch (e) {
      }
    }
    _evaluateAndEmit(clampedDt);
    if (typeof simulateStep === "function") {
      simulateStep(state, clampedDt, SIM.bounds);
    }
    if (renderer && typeof renderer.renderState === "function") {
      try {
        renderer.renderState({
          ships: state.ships,
          bullets: state.bullets,
          flashes,
          shieldFlashes,
          healthFlashes,
          t: state.t
        });
      } catch (e) {
      }
    }
  }
  let last = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  let acc = 0;
  function runLoop() {
    if (!running) return;
    const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    acc += now - last;
    last = now;
    if (acc > 250) acc = 250;
    while (acc >= SIM.DT_MS) {
      step(SIM.DT_MS / 1e3);
      acc -= SIM.DT_MS;
    }
    try {
      requestAnimationFrame(runLoop);
    } catch (e) {
      setTimeout(runLoop, SIM.DT_MS);
    }
  }
  function on(evt, cb) {
    const arr = listeners.get(evt) || [];
    arr.push(cb);
    listeners.set(evt, arr);
  }
  function off(evt, cb) {
    const arr = listeners.get(evt) || [];
    const i = arr.indexOf(cb);
    if (i !== -1) arr.splice(i, 1);
  }
  function destroy() {
    running = false;
    try {
      if (simWorker) {
        try {
          if (typeof simWorker.off === "function") {
            try {
              if (_workerReadyHandler)
                simWorker.off("ready", _workerReadyHandler);
            } catch (e) {
            }
            try {
              if (_workerSnapshotHandler)
                simWorker.off("snapshot", _workerSnapshotHandler);
            } catch (e) {
            }
            try {
              if (_workerReinforcementsHandler)
                simWorker.off("reinforcements", _workerReinforcementsHandler);
            } catch (e) {
            }
          }
        } catch (e) {
        }
        try {
          if (typeof simWorker.terminate === "function") simWorker.terminate();
          else if (typeof simWorker.close === "function") simWorker.close();
          else if (typeof simWorker.post === "function")
            simWorker.post({ type: "stop" });
        } catch (e) {
        }
        simWorker = null;
      }
    } catch (e) {
    }
    workerReady = false;
    workerReadyCbs.length = 0;
    if (renderer && typeof renderer.dispose === "function") {
      try {
        renderer.dispose();
      } catch (e) {
      }
    }
    starCanvas = null;
  }
  function start() {
    if (!running) {
      running = true;
      last = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      runLoop();
    }
  }
  function pause() {
    running = false;
  }
  function resetManager() {
    state = makeInitialState();
    if (simWorker)
      try {
        simWorker.post({ type: "command", cmd: "setState", args: { state } });
      } catch (e) {
      }
  }
  function stepOnce(dt = SIM.DT_MS / 1e3) {
    const n = Number(dt) || SIM.DT_MS / 1e3;
    step(n);
  }
  function setContinuousEnabled(v = false) {
    continuous = !!v;
    if (simWorker) {
      try {
        simWorker.post({ type: "setContinuous", value: !!v });
      } catch (e) {
      }
    } else {
      if (continuous) {
        const result = evaluateReinforcement(
          SIM.DT_MS / 1e3,
          state,
          continuousOptions
        );
        if (result && Array.isArray(result.spawned) && result.spawned.length) {
          lastReinforcement = {
            spawned: result.spawned,
            timestamp: Date.now(),
            options: { ...continuousOptions }
          };
          emit("reinforcements", { spawned: result.spawned });
        }
      }
    }
  }
  function isContinuousEnabled() {
    return !!continuous;
  }
  function setContinuousOptions(opts = {}) {
    continuousOptions = { ...continuousOptions, ...opts };
    if (simWorker)
      try {
        simWorker.post({
          type: "setContinuousOptions",
          opts: continuousOptions
        });
      } catch (e) {
      }
  }
  function getContinuousOptions() {
    return { ...continuousOptions };
  }
  function setReinforcementIntervalManager(seconds) {
    setReinforcementInterval(seconds);
    if (simWorker)
      try {
        simWorker.post({ type: "setReinforcementInterval", seconds });
      } catch (e) {
      }
  }
  function getReinforcementIntervalManager() {
    return getReinforcementInterval();
  }
  function isRunning() {
    return running;
  }
  function isWorker() {
    return !!simWorker && !!workerReady;
  }
  function onWorkerReady(cb) {
    if (typeof cb === "function") workerReadyCbs.push(cb);
  }
  function offWorkerReady(cb) {
    const i = workerReadyCbs.indexOf(cb);
    if (i !== -1) workerReadyCbs.splice(i, 1);
  }
  function spawnShip(team = "red") {
    try {
      const type = getDefaultShipType();
      const b = SIM.bounds;
      const x = Math.max(0, Math.min(b.W - 1e-6, srandom() * b.W));
      const y = Math.max(0, Math.min(b.H - 1e-6, srandom() * b.H));
      const ship = createShip(type, x, y, team);
      state.ships.push(ship);
      return ship;
    } catch (e) {
      return null;
    }
  }
  function formFleets() {
    try {
      state.ships.length = 0;
      const bounds = SIM.bounds;
      const seed2 = Math.floor(srandom() * 4294967295) >>> 0;
      const ships = makeInitialFleets(seed2, bounds, createShip);
      for (const ship of ships) {
        state.ships.push(ship);
      }
    } catch (e) {
    }
  }
  function reseedManager(newSeed = Math.floor(srandom() * 4294967295)) {
    _seed2 = newSeed >>> 0;
    srand(_seed2);
    if (simWorker)
      try {
        simWorker.post({ type: "setSeed", seed: _seed2 });
      } catch (e) {
      }
  }
  function getLastReinforcement() {
    return { ...lastReinforcement };
  }
  function snapshot() {
    return {
      ships: state.ships.slice(),
      bullets: state.bullets.slice(),
      t: state.t
    };
  }
  const score = { red: 0, blue: 0 };
  const internal = { state, bounds: SIM.bounds };
  return {
    on,
    off,
    start,
    pause,
    reset: resetManager,
    stepOnce,
    setContinuousEnabled,
    isContinuousEnabled,
    setContinuousOptions,
    getContinuousOptions,
    setReinforcementInterval: setReinforcementIntervalManager,
    getReinforcementInterval: getReinforcementIntervalManager,
    isRunning,
    isWorker,
    onWorkerReady,
    offWorkerReady,
    spawnShip,
    reseed: reseedManager,
    getLastReinforcement,
    snapshot,
    score,
    formFleets,
    destroy,
    _internal: internal
  };
}

// src/config/displayConfig.ts
var DISPLAY_DEFAULTS = {
  renderScale: 1,
  displayScale: 1,
  hpBar: { bg: "#222", fill: "#4caf50", w: 20, h: 4, dx: -10, dy: -12 }
};

// src/config/rendererConfig.ts
var RendererConfig = {
  preferred: "canvas",
  allowUrlOverride: true,
  allowWebGL: true,
  renderScale: DISPLAY_DEFAULTS.renderScale,
  displayScale: DISPLAY_DEFAULTS.displayScale,
  dynamicScaleEnabled: false,
  lastFrameTime: 0,
  frameScore: "green",
  // green, yellow, red
  // UI overlays configuration
  hpBar: DISPLAY_DEFAULTS.hpBar
};
function getPreferredRenderer() {
  try {
    if (RendererConfig.allowUrlOverride && typeof window !== "undefined" && window.location && window.location.search) {
      const p = new URLSearchParams(window.location.search);
      const r = p.get("renderer");
      if (r === "canvas" || r === "webgl") return r;
    }
  } catch (e) {
  }
  return RendererConfig.preferred;
}
var rendererConfig_default = RendererConfig;

// src/config/assets/assetsConfig.ts
var AssetsConfig = {
  meta: {
    orientation: "+X",
    coordinateSystem: "topdown-2d"
  },
  palette: {
    shipHull: "#b0b7c3",
    shipAccent: "#6c7380",
    bullet: "#ffd166",
    turret: "#94a3b8",
    // Scene background color used by renderers
    background: "#0b1220"
  },
  // 2D vector shapes defined as polygons and circles. Points are unit-sized
  // profiles (roughly radius 1). Renderer should multiply by entity radius or
  // provided scale before drawing.
  shapes2d: {
    fighter: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[1.2, 0], [-0.8, 0.6], [-0.5, 0], [-0.8, -0.6]] },
        { type: "polygon", points: [[0, 0.35], [-0.6, 0.65], [-0.35, 0]] },
        { type: "polygon", points: [[0, -0.35], [-0.35, 0], [-0.6, -0.65]] },
        { type: "circle", r: 0.5 }
      ],
      strokeWidth: 0.08,
      model3d: { url: void 0, scale: 1, type: "gltf", mesh: void 0 }
    },
    corvette: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[1.2, 0], [0.4, 0.7], [-1, 0.6], [-1.2, 0], [-1, -0.6], [0.4, -0.7]] },
        { type: "polygon", points: [[1.4, 0.22], [1.2, 0.12], [1.2, -0.12], [1.4, -0.22]] },
        { type: "circle", r: 0.6 }
      ],
      strokeWidth: 0.08,
      model3d: { url: void 0, scale: 1.4, type: "gltf", mesh: void 0 }
    },
    frigate: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[1.3, 0], [0.7, 0.65], [-0.3, 1], [-1.3, 0.55], [-1.3, -0.55], [-0.3, -1], [0.7, -0.65]] },
        { type: "circle", r: 0.7 }
      ],
      strokeWidth: 0.1,
      model3d: { url: void 0, scale: 1.8, type: "gltf", mesh: void 0 }
    },
    destroyer: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[1.8, 0], [1, 0.7], [0.2, 1], [-0.8, 0.9], [-1.8, 0.6], [-1.8, -0.6], [-0.8, -0.9], [0.2, -1], [1, -0.7]] },
        { type: "circle", r: 1 },
        { type: "polygon", points: [[2, 0.3], [1.8, 0.2], [1.8, -0.2], [2, -0.3]] }
      ],
      strokeWidth: 0.12,
      model3d: { url: void 0, scale: 2.2, type: "gltf", mesh: void 0 },
      turrets: [
        { kind: "basic", position: [1.2, 0.8] },
        { kind: "basic", position: [-1.2, 0.8] },
        { kind: "basic", position: [1.2, -0.8] },
        { kind: "basic", position: [-1.2, -0.8] },
        { kind: "basic", position: [0, 1.5] },
        { kind: "basic", position: [0, -1.5] }
      ]
    },
    carrier: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[2.2, 0], [1.2, 1.2], [-1, 1.6], [-2.8, 1.2], [-3.2, 0], [-2.8, -1.2], [-1, -1.6], [1.2, -1.2]] },
        { type: "circle", r: 1.2 },
        { type: "polygon", points: [[2.6, 0.5], [2.2, 0.3], [2.2, -0.3], [2.6, -0.5]] }
      ],
      strokeWidth: 0.12,
      model3d: { url: void 0, scale: 3, type: "gltf", mesh: void 0 },
      turrets: [
        { kind: "basic", position: [2, 1.2] },
        { kind: "basic", position: [-2, 1.2] },
        { kind: "basic", position: [2, -1.2] },
        { kind: "basic", position: [-2, -1.2] }
      ]
    },
    bulletSmall: { type: "circle", r: 0.18 },
    bulletMedium: { type: "circle", r: 0.25 },
    bulletLarge: { type: "circle", r: 0.36 },
    turretBasic: {
      type: "compound",
      parts: [
        { type: "circle", r: 0.5 },
        { type: "polygon", points: [[-0.2, 0.2], [0.7, 0.2], [0.7, -0.2], [-0.2, -0.2]] }
      ],
      strokeWidth: 0.08
    },
    // Small effect/particle shapes for renderer-driven effects
    particleSmall: { type: "circle", r: 0.12 },
    particleMedium: { type: "circle", r: 0.22 },
    explosionParticle: { type: "circle", r: 0.32 },
    shieldRing: { type: "circle", r: 1.2 }
  }
};
AssetsConfig.animations = {
  engineFlare: {
    type: "polygon",
    points: [[0, 0], [-0.3, 0.15], [-0.5, 0], [-0.3, -0.15]],
    pulseRate: 8,
    // configurable alpha multiplier for engine overlay
    alpha: 0.4,
    // local-space X offset (negative = behind ship)
    offset: -0.9
  },
  shieldEffect: {
    type: "circle",
    r: 1.2,
    strokeWidth: 0.1,
    color: "#88ccff",
    pulseRate: 2,
    // map shieldPct -> alpha = base + scale * shieldPct
    alphaBase: 0.25,
    alphaScale: 0.75
  },
  damageParticles: {
    type: "particles",
    color: "#ff6b6b",
    count: 6,
    lifetime: 0.8,
    spread: 0.6
  },
  engineTrail: {
    type: "trail",
    color: "#fffc00",
    // bright yellow for high contrast
    maxLength: 40,
    // much longer trail
    width: 0.35,
    // thicker trail line
    fade: 0.35
    // slower fading, more persistent
  }
};
AssetsConfig.damageStates = {
  light: { opacity: 0.9, accentColor: "#b0b7c3" },
  moderate: { opacity: 0.75, accentColor: "#d4a06a" },
  heavy: { opacity: 0.5, accentColor: "#ff6b6b" }
};
AssetsConfig.visualStateDefaults = {
  fighter: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
  corvette: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
  frigate: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
  destroyer: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 },
  carrier: { engine: "engineFlare", shield: "shieldEffect", damageParticles: "damageParticles", engineTrail: "engineTrail", arcWidth: Math.PI / 12 }
};
AssetsConfig.damageThresholds = { moderate: 0.66, heavy: 0.33 };
AssetsConfig.shieldArcWidth = Math.PI / 12;
function getVisualConfig(type) {
  const shape = getShipAsset(type);
  const visuals = AssetsConfig.visualStateDefaults[type] || AssetsConfig.visualStateDefaults.fighter;
  return { shape, visuals, palette: AssetsConfig.palette, animations: AssetsConfig.animations, damageStates: AssetsConfig.damageStates };
}
function getShipAsset(type) {
  return AssetsConfig.shapes2d[type] || AssetsConfig.shapes2d.fighter;
}
function getBulletAsset(kind = "small") {
  if (kind === "large") return AssetsConfig.shapes2d.bulletLarge;
  if (kind === "medium") return AssetsConfig.shapes2d.bulletMedium;
  return AssetsConfig.shapes2d.bulletSmall;
}
function getTurretAsset(_kind = "basic") {
  return AssetsConfig.shapes2d.turretBasic;
}
var assetsConfig_default = AssetsConfig;

// src/canvasrenderer.ts
init_entitiesConfig();
var CanvasRenderer = class {
  canvas;
  ctx = null;
  bufferCanvas;
  bufferCtx = null;
  providesOwnLoop = false;
  type = "canvas";
  // ratio between backing store pixels and CSS (logical) pixels
  pixelRatio = 1;
  constructor(canvas) {
    this.canvas = canvas;
    this.bufferCanvas = document.createElement("canvas");
    this.bufferCtx = this.bufferCanvas.getContext("2d");
  }
  init() {
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      const noop = () => {
      };
      const noOpCtx = {
        setTransform: noop,
        imageSmoothingEnabled: true,
        clearRect: noop,
        save: noop,
        restore: noop,
        fillRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        closePath: noop,
        fill: noop,
        stroke: noop,
        arc: noop,
        translate: noop,
        rotate: noop,
        drawImage: noop,
        globalAlpha: 1,
        strokeStyle: "#000",
        fillStyle: "#000",
        lineWidth: 1,
        globalCompositeOperation: "source-over"
      };
      this.ctx = noOpCtx;
    }
    this.bufferCtx = this.bufferCanvas.getContext("2d") || this.ctx;
    if (!this.bufferCtx) return false;
    try {
      const renderScale = rendererConfig_default && typeof rendererConfig_default.renderScale === "number" ? rendererConfig_default.renderScale : 1;
      this.pixelRatio = renderScale;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
    } catch (e) {
      this.pixelRatio = 1;
    }
    return true;
  }
  isRunning() {
    return false;
  }
  renderState(state, interpolation = 0) {
    function drawRing(x, y, R, color, alpha = 1, thickness = 2) {
      try {
        bufferCtx.save();
        bufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
        bufferCtx.strokeStyle = color;
        bufferCtx.lineWidth = thickness * renderScale;
        bufferCtx.beginPath();
        bufferCtx.arc(x * renderScale, y * renderScale, Math.max(1, R * renderScale), 0, Math.PI * 2);
        bufferCtx.stroke();
        bufferCtx.restore();
      } catch (e) {
      }
    }
    const ctx = this.ctx;
    const bufferCtx = this.bufferCtx;
    if (!ctx || !bufferCtx) return;
    const LOGICAL_W = 1920, LOGICAL_H = 1080;
    const renderScale = rendererConfig_default && typeof rendererConfig_default.renderScale === "number" ? rendererConfig_default.renderScale : 1;
    const fitScale = rendererConfig_default._fitScale || 1;
    const bufferW = Math.round(LOGICAL_W * renderScale);
    const bufferH = Math.round(LOGICAL_H * renderScale);
    if (this.bufferCanvas.width !== bufferW || this.bufferCanvas.height !== bufferH) {
      this.bufferCanvas.width = bufferW;
      this.bufferCanvas.height = bufferH;
      this.bufferCtx = this.bufferCanvas.getContext("2d");
      if (!this.bufferCtx) return;
    }
    const activeBufferCtx = this.bufferCtx;
    activeBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
    activeBufferCtx.clearRect(0, 0, bufferW, bufferH);
    activeBufferCtx.save();
    activeBufferCtx.fillStyle = assetsConfig_default.palette.background || "#0b1220";
    activeBufferCtx.fillRect(0, 0, bufferW, bufferH);
    activeBufferCtx.restore();
    function drawPolygon(points) {
      if (!points || points.length === 0) return;
      activeBufferCtx.beginPath();
      activeBufferCtx.moveTo(points[0][0] * renderScale, points[0][1] * renderScale);
      for (let i = 1; i < points.length; i++) activeBufferCtx.lineTo(points[i][0] * renderScale, points[i][1] * renderScale);
      activeBufferCtx.closePath();
      activeBufferCtx.fill();
    }
    if (state && state.starCanvas) {
      try {
        activeBufferCtx.save();
        activeBufferCtx.globalCompositeOperation = "source-over";
        activeBufferCtx.drawImage(state.starCanvas, 0, 0, bufferW, bufferH);
        activeBufferCtx.restore();
      } catch (e) {
      }
    }
    const now = state && state.t || 0;
    try {
      const dmgAnim = assetsConfig_default.animations && assetsConfig_default.animations.damageParticles;
      if (Array.isArray(state.damageEvents) && dmgAnim) {
        state.particles = state.particles || [];
        for (const ev of state.damageEvents) {
          const count = dmgAnim.count || 6;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (dmgAnim.spread || 0.6);
            state.particles.push({
              x: ev.x || 0,
              y: ev.y || 0,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 0.6 + Math.random() * 0.8,
              color: dmgAnim.color || "#ff6b6b",
              lifetime: dmgAnim.lifetime || 0.8,
              age: 0,
              shape: "circle"
            });
          }
        }
        state.damageEvents = [];
      }
    } catch (e) {
    }
    for (const s of state.ships || []) {
      const sx = (s.x || 0) * renderScale;
      const sy = (s.y || 0) * renderScale;
      if (sx < 0 || sx >= bufferW || sy < 0 || sy >= bufferH) continue;
      if (state.engineTrailsEnabled) {
        s.trail = s.trail || [];
        const last = s.trail.length ? s.trail[s.trail.length - 1] : null;
        if (!last || last.x !== s.x || last.y !== s.y) {
          s.trail.push({ x: s.x, y: s.y });
        }
        const vconf2 = getVisualConfig(s.type || getDefaultShipType());
        const trailName = vconf2.visuals && vconf2.visuals.engineTrail || "engineTrail";
      }
      if (Array.isArray(s.trail)) {
        for (let i = 0; i < s.trail.length; i++) {
          const tx = s.trail[i].x || 0;
          const ty = s.trail[i].y || 0;
          const tAlpha = 0.2 + 0.5 * (i / s.trail.length);
          const txx = tx * renderScale;
          const tyy = ty * renderScale;
          if (txx < 0 || txx >= bufferW || tyy < 0 || tyy >= bufferH) continue;
          activeBufferCtx.save();
          activeBufferCtx.globalAlpha = tAlpha;
          activeBufferCtx.fillStyle = "#aee1ff";
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(txx, tyy, 6 * renderScale, 0, Math.PI * 2);
          activeBufferCtx.fill();
          activeBufferCtx.restore();
        }
      }
      const vconf = getVisualConfig(s.type || getDefaultShipType());
      const shape = getShipAsset(s.type || getDefaultShipType());
      activeBufferCtx.save();
      activeBufferCtx.translate((s.x || 0) * renderScale, (s.y || 0) * renderScale);
      activeBufferCtx.rotate(s.angle || 0);
      let teamColor = assetsConfig_default.palette.shipHull || "#888";
      if (s.team === "red" && teamsConfig_default.teams.red) teamColor = teamsConfig_default.teams.red.color;
      else if (s.team === "blue" && teamsConfig_default.teams.blue) teamColor = teamsConfig_default.teams.blue.color;
      activeBufferCtx.fillStyle = teamColor;
      if (shape.type === "circle") {
        activeBufferCtx.beginPath();
        activeBufferCtx.arc(0, 0, (s.radius || 12) * renderScale, 0, Math.PI * 2);
        activeBufferCtx.fill();
      } else if (shape.type === "polygon") {
        drawPolygon(shape.points);
      } else if (shape.type === "compound") {
        for (const part of shape.parts) {
          if (part.type === "circle") {
            activeBufferCtx.beginPath();
            activeBufferCtx.arc(0, 0, (part.r || 1) * (s.radius || 12) * renderScale, 0, Math.PI * 2);
            activeBufferCtx.fill();
          } else if (part.type === "polygon") {
            drawPolygon(part.points);
          }
        }
      }
      if (Array.isArray(s.turrets) && s.turrets.length > 0) {
        for (const turret of s.turrets) {
          if (!turret || !turret.position) continue;
          const turretShape = getTurretAsset(turret.kind || "basic");
          const shipType = s.type || "fighter";
          const shipCfg = (init_entitiesConfig(), __toCommonJS(entitiesConfig_exports)).getShipConfig()[shipType];
          const configRadius = shipCfg && typeof shipCfg.radius === "number" ? shipCfg.radius : s.radius || 12;
          const turretScale = configRadius * renderScale * 0.5;
          const angle = s.angle || 0;
          const [tx, ty] = turret.position;
          const turretX = Math.cos(angle) * tx * configRadius - Math.sin(angle) * ty * configRadius;
          const turretY = Math.sin(angle) * tx * configRadius + Math.cos(angle) * ty * configRadius;
          activeBufferCtx.save();
          activeBufferCtx.translate(turretX, turretY);
          activeBufferCtx.rotate(0);
          activeBufferCtx.fillStyle = assetsConfig_default.palette.turret || "#94a3b8";
          if (turretShape.type === "circle") {
            activeBufferCtx.beginPath();
            activeBufferCtx.arc(0, 0, (turretShape.r || 1) * turretScale, 0, Math.PI * 2);
            activeBufferCtx.fill();
          } else if (turretShape.type === "polygon") {
            activeBufferCtx.save();
            activeBufferCtx.scale(turretScale, turretScale);
            drawPolygon(turretShape.points);
            activeBufferCtx.restore();
          } else if (turretShape.type === "compound") {
            for (const part of turretShape.parts) {
              if (part.type === "circle") {
                activeBufferCtx.beginPath();
                activeBufferCtx.arc(0, 0, (part.r || 1) * turretScale, 0, Math.PI * 2);
                activeBufferCtx.fill();
              } else if (part.type === "polygon") {
                activeBufferCtx.save();
                activeBufferCtx.scale(turretScale, turretScale);
                drawPolygon(part.points);
                activeBufferCtx.restore();
              }
            }
          }
          activeBufferCtx.restore();
        }
      }
      if ((s.shield ?? 0) > 0) {
        if (sx >= 0 && sx < bufferW && sy >= 0 && sy < bufferH) {
          const shAnim = assetsConfig_default.animations && assetsConfig_default.animations.shieldEffect;
          try {
            if (shAnim) {
              const pulse = typeof shAnim.pulseRate === "number" ? 0.5 + 0.5 * Math.sin(now * shAnim.pulseRate) : 1;
              const shieldNorm = Math.max(0, Math.min(1, (s.shield || 0) / (s.maxShield || s.shield || 1)));
              const alphaBase = typeof shAnim.alphaBase === "number" ? shAnim.alphaBase : shAnim.alpha || 0.25;
              const alphaScale = typeof shAnim.alphaScale === "number" ? shAnim.alphaScale : 0.75;
              const alpha = Math.max(0, Math.min(1, alphaBase + alphaScale * pulse * shieldNorm));
              const R = (shAnim.r || 1.2) * (s.radius || 12);
              activeBufferCtx.save();
              activeBufferCtx.globalAlpha = alpha;
              activeBufferCtx.strokeStyle = shAnim.color || "#3ab6ff";
              activeBufferCtx.lineWidth = (shAnim.strokeWidth || 0.08) * (s.radius || 12) * renderScale;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc((s.x || 0) * renderScale, (s.y || 0) * renderScale, Math.max(1, R * renderScale), 0, Math.PI * 2);
              activeBufferCtx.stroke();
              activeBufferCtx.restore();
            } else {
              drawRing(s.x, s.y, (s.radius || 12) * 1.2, "#3ab6ff", 0.5, 3 * renderScale);
            }
          } catch (e) {
          }
        }
      }
    }
    try {
      const nowT = state.t || 0;
      for (const s of state.ships || []) {
        try {
          let flash = null;
          const arr = Array.isArray(state.healthFlashes) ? state.healthFlashes.filter((f) => f.id === s.id) : [];
          let bestTs = -Infinity;
          for (const f of arr) {
            if (!f) continue;
            const fTs = typeof f._ts === "number" ? f._ts : 0;
            const fTtl = typeof f.ttl === "number" ? f.ttl : 0.4;
            if (fTs + fTtl >= nowT - 1e-6 && fTs > bestTs) {
              bestTs = fTs;
              flash = f;
            }
          }
          if (flash) {
            const ttl = flash.ttl || 0.4;
            const life = flash.life != null ? flash.life : ttl;
            const t = Math.max(0, Math.min(1, life / ttl));
            const R = 6 + (1 - t) * 18;
            const alpha = 0.9 * t;
            const fx = (flash.x || (s.x || 0)) * renderScale;
            const fy = (flash.y || (s.y || 0)) * renderScale;
            if (fx >= 0 && fx < bufferW && fy >= 0 && fy < bufferH) {
              activeBufferCtx.save();
              activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
              activeBufferCtx.strokeStyle = "#ff7766";
              activeBufferCtx.lineWidth = 2 * renderScale;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(fx, fy, Math.max(1, R * renderScale), 0, Math.PI * 2);
              activeBufferCtx.stroke();
              activeBufferCtx.restore();
            }
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
    for (const b of state.bullets || []) {
      try {
        const bx = (b.x || 0) * renderScale;
        const by = (b.y || 0) * renderScale;
        if (bx < 0 || bx >= bufferW || by < 0 || by >= bufferH) continue;
        const r = b.radius || b.bulletRadius || 1.5;
        const kind = typeof b.bulletRadius === "number" ? b.bulletRadius < 2 ? "small" : b.bulletRadius < 3 ? "medium" : "large" : "small";
        const shape = getBulletAsset(kind);
        activeBufferCtx.save();
        activeBufferCtx.translate(bx, by);
        const px = Math.max(1, r * renderScale);
        activeBufferCtx.fillStyle = assetsConfig_default.palette.bullet;
        if (shape.type === "circle") {
          activeBufferCtx.beginPath();
          activeBufferCtx.arc(0, 0, px, 0, Math.PI * 2);
          activeBufferCtx.fill();
        } else if (shape.type === "polygon") {
          drawPolygon(shape.points);
        } else if (shape.type === "compound") {
          for (const part of shape.parts) {
            if (part.type === "circle") {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, (part.r || 1) * px, 0, Math.PI * 2);
              activeBufferCtx.fill();
            } else if (part.type === "polygon") {
              drawPolygon(part.points);
            }
          }
        }
        activeBufferCtx.restore();
      } catch (e) {
      }
    }
    try {
      const shapes = assetsConfig_default.shapes2d || {};
      for (const p of state.particles || []) {
        try {
          const px = (p.x || 0) * renderScale;
          const py = (p.y || 0) * renderScale;
          if (px < 0 || px >= bufferW || py < 0 || py >= bufferH) continue;
          activeBufferCtx.save();
          const shapeName = p.assetShape || (p.r > 0.5 ? "particleMedium" : "particleSmall");
          const shape = shapes[shapeName];
          const color = p.color || "#ffdca8";
          activeBufferCtx.fillStyle = color;
          activeBufferCtx.globalAlpha = Math.max(0, Math.min(1, 1 - (p.age || 0) / (p.lifetime || 1)));
          activeBufferCtx.translate(px, py);
          if (shape) {
            if (shape.type === "circle") {
              const rr = (shape.r || 0.12) * (p.r || 1) * renderScale * 6;
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2);
              activeBufferCtx.fill();
            } else if (shape.type === "polygon") {
              activeBufferCtx.beginPath();
              const pts = shape.points || [];
              if (pts.length) {
                activeBufferCtx.moveTo((pts[0][0] || 0) * renderScale, (pts[0][1] || 0) * renderScale);
                for (let i = 1; i < pts.length; i++) activeBufferCtx.lineTo((pts[i][0] || 0) * renderScale, (pts[i][1] || 0) * renderScale);
                activeBufferCtx.closePath();
                activeBufferCtx.fill();
              }
            } else if (shape.type === "compound") {
              for (const part of shape.parts || []) {
                if (part.type === "circle") {
                  const rr = (part.r || 0.12) * (p.r || 1) * renderScale * 6;
                  activeBufferCtx.beginPath();
                  activeBufferCtx.arc(0, 0, rr, 0, Math.PI * 2);
                  activeBufferCtx.fill();
                } else if (part.type === "polygon") {
                  activeBufferCtx.beginPath();
                  const pts = part.points || [];
                  if (pts.length) {
                    activeBufferCtx.moveTo((pts[0][0] || 0) * renderScale, (pts[0][1] || 0) * renderScale);
                    for (let i = 1; i < pts.length; i++) activeBufferCtx.lineTo((pts[i][0] || 0) * renderScale, (pts[i][1] || 0) * renderScale);
                    activeBufferCtx.closePath();
                    activeBufferCtx.fill();
                  }
                }
              }
            } else {
              activeBufferCtx.beginPath();
              activeBufferCtx.arc(0, 0, (p.r || 2) * renderScale, 0, Math.PI * 2);
              activeBufferCtx.fill();
            }
          } else {
            activeBufferCtx.beginPath();
            activeBufferCtx.arc(0, 0, (p.r || 2) * renderScale, 0, Math.PI * 2);
            activeBufferCtx.fill();
          }
          activeBufferCtx.restore();
        } catch (e) {
        }
      }
    } catch (e) {
    }
    try {
      const expShape = assetsConfig_default.shapes2d && assetsConfig_default.shapes2d.explosionParticle;
      for (const ex of state.explosions || []) {
        try {
          const exx = (ex.x || 0) * renderScale;
          const exy = (ex.y || 0) * renderScale;
          const life = ex.life || 0.5;
          const ttl = ex.ttl || 0.5;
          const t = Math.max(0, Math.min(1, life / ttl));
          const alpha = (1 - t) * 0.9;
          activeBufferCtx.save();
          activeBufferCtx.globalAlpha = alpha;
          activeBufferCtx.translate(exx, exy);
          activeBufferCtx.fillStyle = ex.color || "#ffd089";
          if (expShape && expShape.type === "circle") {
            const rr = (expShape.r || 0.32) * (ex.scale || 1) * renderScale * 6;
            activeBufferCtx.beginPath();
            activeBufferCtx.arc(0, 0, rr * (1 + (1 - t)), 0, Math.PI * 2);
            activeBufferCtx.fill();
          } else {
            activeBufferCtx.beginPath();
            activeBufferCtx.arc(0, 0, Math.max(2, (ex.scale || 1) * 12 * (1 - t)), 0, Math.PI * 2);
            activeBufferCtx.fill();
          }
          activeBufferCtx.restore();
        } catch (e) {
        }
      }
    } catch (e) {
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.bufferCanvas.width,
      this.bufferCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    ctx.restore();
  }
};

// src/webglrenderer.ts
var WebGLRenderer = class {
  canvas;
  gl = null;
  // Renderer may run its own loop in advanced impls (not used here)
  providesOwnLoop = false;
  // Cache of baked textures keyed by asset key
  shapeTextures = {};
  // Last-seen GameState (to support release to pool during dispose)
  gameState = null;
  // Optional textured-quad resources (not required by tests)
  quadVBO = null;
  quadProg = null;
  // Optional FBO resources for render-to-texture
  fbo = null;
  fboTex = null;
  constructor(canvas) {
    this.canvas = canvas;
  }
  // Initialize GL context and basic state
  init() {
    try {
      const gl = this.canvas.getContext("webgl2") || this.canvas.getContext("webgl");
      if (!gl) return false;
      this.gl = gl;
      gl.clearColor(0.02, 0.03, 0.06, 1);
      return true;
    } catch {
      return false;
    }
  }
  // Called when canvas backing store size changes
  updateScale() {
    if (!this.gl) return;
    try {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    } catch {
    }
  }
  isRunning() {
    return false;
  }
  // Render a state frame. This stub clears the screen and ensures
  // textures for present ship types are baked and cached.
  renderState(state, _interpolation = 0) {
    if (!this.gl) return;
    this.gameState = state;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    try {
      const ships = state && state.ships || [];
      for (const s of ships) {
        const type = s && s.type || "fighter";
        this.bakeShapeToTexture(state, type);
      }
    } catch {
    }
  }
  // Pre-bake textures for all known shapes
  preloadAllAssets() {
    if (!this.gl) return;
    try {
      const shapes = AssetsConfig.shapes2d || {};
      for (const key of Object.keys(shapes)) this.bakeShapeToTexture(this.gameState, key);
    } catch {
    }
  }
  // Testing helper: check if we have a cached texture for a key
  hasCachedTexture(key) {
    return !!this.shapeTextures[key];
  }
  // Dispose all GL resources and clear caches
  dispose() {
    if (this.gl) {
      try {
        for (const key of Object.keys(this.shapeTextures)) {
          const tex = this.shapeTextures[key];
          if (!tex) continue;
          if (this.gameState) {
            try {
              releaseTexture(this.gameState, key, tex);
            } catch {
            }
          } else {
            try {
              this.gl.deleteTexture(tex);
            } catch {
            }
          }
        }
        try {
          if (this.quadVBO) this.gl.deleteBuffer(this.quadVBO);
        } catch {
        }
        try {
          if (this.quadProg) this.gl.deleteProgram(this.quadProg);
        } catch {
        }
        try {
          if (this.fboTex) this.gl.deleteTexture(this.fboTex);
        } catch {
        }
        try {
          if (this.fbo) this.gl.deleteFramebuffer(this.fbo);
        } catch {
        }
      } catch {
      }
    }
    this.shapeTextures = {};
    this.quadVBO = null;
    this.quadProg = null;
    this.fbo = null;
    this.fboTex = null;
    this.gl = null;
  }
  // Internal: bake a simple 2D shape into a texture and cache it
  bakeShapeToTexture(state, key) {
    if (!this.gl) return null;
    if (this.shapeTextures[key]) return this.shapeTextures[key];
    try {
      const gl = this.gl;
      const shapes = AssetsConfig.shapes2d || {};
      const shape = shapes[key];
      const size = 128;
      const cvs = document.createElement("canvas");
      cvs.width = size;
      cvs.height = size;
      const ctx = cvs.getContext("2d");
      if (!ctx) return null;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      const scale = size / 4;
      ctx.fillStyle = AssetsConfig.palette && AssetsConfig.palette.shipHull || "#b0b7c3";
      if (!shape) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(4, size * 0.12), 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === "circle") {
        const r = (shape.r ?? 0.5) * scale;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === "polygon") {
        const pts = shape.points || [];
        if (pts.length) {
          ctx.beginPath();
          ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
          for (let i = 1; i < pts.length; i++)
            ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
          ctx.closePath();
          ctx.fill();
        }
      } else if (shape.type === "compound") {
        const parts = shape.parts || [];
        for (const part of parts) {
          if (part.type === "circle") {
            const r = (part.r ?? 0.5) * scale;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          } else if (part.type === "polygon") {
            const pts = part.points || [];
            if (pts.length) {
              ctx.beginPath();
              ctx.moveTo((pts[0][0] || 0) * scale, (pts[0][1] || 0) * scale);
              for (let i = 1; i < pts.length; i++)
                ctx.lineTo((pts[i][0] || 0) * scale, (pts[i][1] || 0) * scale);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();
      const createTex = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 32867, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      let tex = null;
      if (state) {
        try {
          tex = acquireTexture(state, key, createTex);
        } catch {
          tex = createTex();
        }
      } else {
        tex = createTex();
      }
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      this.shapeTextures[key] = tex;
      return tex;
    } catch {
      return null;
    }
  }
  // Optional future path: draw a textured quad (not used in tests yet)
  // Keeping a stub to document intent and ease future extension.
  // private drawTexturedQuad(_tex: WebGLTexture, _x: number, _y: number, _w: number, _h: number): void {
  //   // Intentionally empty in minimal stub
  // }
};

// src/main.ts
async function startApp(rootDocument = document) {
  const gameState = makeInitialState();
  let canvas = rootDocument.getElementById("world");
  if (!canvas) {
    try {
      const el = rootDocument.createElement("canvas");
      el.id = "world";
      rootDocument.body.appendChild(el);
      canvas = el;
    } catch (e) {
      canvas = null;
    }
  }
  const ui = {
    startPause: rootDocument.getElementById("startPause"),
    reset: rootDocument.getElementById("reset"),
    addRed: rootDocument.getElementById("addRed"),
    addBlue: rootDocument.getElementById("addBlue"),
    toggleTrails: rootDocument.getElementById("toggleTrails"),
    speed: rootDocument.getElementById("speed"),
    redScore: rootDocument.getElementById("redScore"),
    blueScore: rootDocument.getElementById("blueScore"),
    stats: rootDocument.getElementById("stats"),
    continuousCheckbox: rootDocument.getElementById("continuousCheckbox"),
    seedBtn: rootDocument.getElementById("seedBtn"),
    formationBtn: rootDocument.getElementById("formationBtn")
  };
  try {
    if (ui.stats) ui.stats.textContent = "Ships: 0 (R:0 B:0) Bullets: 0";
  } catch (e) {
  }
  const LOGICAL_BOUNDS = getDefaultBounds();
  const disposables = [];
  let uiRaf = null;
  let workerIndicatorRaf = null;
  const pendingTimers = /* @__PURE__ */ new Set();
  let isUiTickRunning = false;
  function addListener(target, type, handler) {
    if (!target) return;
    try {
      target.addEventListener(type, handler);
      disposables.push(() => {
        try {
          target.removeEventListener(type, handler);
        } catch (e) {
        }
      });
    } catch (e) {
    }
  }
  function clearAllTimers() {
    for (const id of Array.from(pendingTimers)) {
      try {
        clearTimeout(id);
      } catch (e) {
      }
      pendingTimers.delete(id);
    }
  }
  function updateCanvasBackingStore() {
    const dpr = window.devicePixelRatio || 1;
    const renderScale = RendererConfig && typeof RendererConfig.renderScale === "number" ? RendererConfig.renderScale : 1;
    const logicalW = LOGICAL_BOUNDS.W;
    const logicalH = LOGICAL_BOUNDS.H;
    if (canvas) {
      const bufferW = Math.round(logicalW * renderScale / dpr);
      const bufferH = Math.round(logicalH * renderScale / dpr);
      canvas.width = bufferW;
      canvas.height = bufferH;
      canvas.style.width = bufferW + "px";
      canvas.style.height = bufferH + "px";
      const dimsEl = document.getElementById("rendererDims");
      if (dimsEl) {
        dimsEl.textContent = `${canvas.width} x ${canvas.height} px @ ${dpr}x`;
      }
    }
    RendererConfig._renderScale = renderScale;
    RendererConfig._offsetX = 0;
    RendererConfig._offsetY = 0;
    const scaleVal = rootDocument.getElementById("rendererScaleValue");
    if (scaleVal) scaleVal.textContent = renderScale.toFixed(2);
  }
  function fitCanvasToWindow() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const bufferW = canvas ? canvas.width : LOGICAL_BOUNDS.W;
    const bufferH = canvas ? canvas.height : LOGICAL_BOUNDS.H;
    const scale = Math.min(winW / bufferW, winH / bufferH);
    const scaledW = bufferW * scale;
    const scaledH = bufferH * scale;
    const offsetX = Math.round((winW - scaledW) / 2);
    const offsetY = Math.round((winH - scaledH) / 2);
    if (canvas) {
      canvas.style.width = `${bufferW}px`;
      canvas.style.height = `${bufferH}px`;
      canvas.style.position = "absolute";
      canvas.style.left = `${offsetX}px`;
      canvas.style.top = `${offsetY}px`;
      canvas.style.transformOrigin = "top left";
      canvas.style.transform = `scale(${scale})`;
    }
    document.body.style.overflow = "hidden";
  }
  const scaleSlider = rootDocument.getElementById("rendererScaleRange");
  const dynamicCheckbox = rootDocument.getElementById("dynamicScaleCheckbox");
  let internalScaleUpdate = false;
  if (scaleSlider) {
    const onScaleInput = (ev) => {
      if (internalScaleUpdate) return;
      const val = parseFloat(ev.target.value);
      if (!isNaN(val)) {
        RendererConfig.renderScale = val;
        RendererConfig.dynamicScaleEnabled = false;
        if (dynamicCheckbox)
          dynamicCheckbox.checked = false;
        updateCanvasBackingStore();
        fitCanvasToWindow();
      }
    };
    addListener(scaleSlider, "input", onScaleInput);
    const scaleVal = rootDocument.getElementById("rendererScaleValue");
    if (scaleVal)
      scaleVal.textContent = scaleSlider.value;
    updateCanvasBackingStore();
    fitCanvasToWindow();
  }
  if (dynamicCheckbox) {
    const onDynamicChange = (ev) => {
      const enabled = !!ev.target.checked;
      RendererConfig.dynamicScaleEnabled = enabled;
    };
    addListener(dynamicCheckbox, "change", onDynamicChange);
    dynamicCheckbox.checked = !!RendererConfig.dynamicScaleEnabled;
  }
  fitCanvasToWindow();
  addListener(window, "resize", fitCanvasToWindow);
  let renderer = null;
  const pref = getPreferredRenderer();
  if (canvas) {
    if (pref === "webgl") {
      try {
        const w = new WebGLRenderer(canvas);
        if (w && w.init && w.init()) renderer = w;
      } catch (e) {
      }
    }
    if (!renderer) {
      try {
        renderer = new CanvasRenderer(canvas);
        renderer.init && renderer.init();
      } catch (e) {
        renderer = null;
      }
    }
  }
  if (renderer && typeof renderer.preloadAllAssets === "function") {
    try {
      renderer.preloadAllAssets();
    } catch (e) {
    }
  }
  if (!renderer) {
    renderer = {
      type: "noop",
      init: () => false,
      renderState: (_) => {
      },
      isRunning: () => false
    };
  }
  try {
    window.gm = window.gm || {};
  } catch (e) {
  }
  const gm = createGameManager({ renderer, useWorker: false, seed: 12345 });
  if (gm && gm._internal) {
    gm._internal.bounds = LOGICAL_BOUNDS;
    gm._internal.state = gameState;
  }
  try {
    if (typeof window !== "undefined" && window.gm)
      Object.assign(window.gm, gm);
  } catch (e) {
  }
  let simSpeedMultiplier = 1;
  if (ui.speed) {
    const onSpeedClick = () => {
      simSpeedMultiplier = simSpeedMultiplier >= 4 ? 0.25 : simSpeedMultiplier * 2;
      ui.speed.textContent = `Speed: ${simSpeedMultiplier}\xD7`;
    };
    addListener(ui.speed, "click", onSpeedClick);
    ui.speed.textContent = `Speed: ${simSpeedMultiplier}\xD7`;
  }
  if (gm && typeof gm.stepOnce === "function") {
    const origStepOnce = gm.stepOnce.bind(gm);
    gm.stepOnce = (dt = 0.016) => origStepOnce(dt * simSpeedMultiplier);
  }
  if (ui.formationBtn) {
    const onFormationClick = () => {
      if (gm && typeof gm.formFleets === "function") {
        gm.formFleets();
      }
    };
    addListener(ui.formationBtn, "click", onFormationClick);
  }
  let engineTrailsEnabled = true;
  gameState.engineTrailsEnabled = engineTrailsEnabled;
  if (ui.toggleTrails) {
    const onToggleTrails = () => {
      engineTrailsEnabled = !engineTrailsEnabled;
      gameState.engineTrailsEnabled = engineTrailsEnabled;
      ui.toggleTrails.textContent = engineTrailsEnabled ? "\u2604 Trails: On" : "\u2604 Trails: Off";
    };
    addListener(ui.toggleTrails, "click", onToggleTrails);
    ui.toggleTrails.textContent = engineTrailsEnabled ? "\u2604 Trails: On" : "\u2604 Trails: Off";
  }
  try {
    const host = location && location.hostname || "";
    const urlParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams(location.search) : null;
    const autotest = urlParams && urlParams.get("autotest") === "1" || !!window.__AUTO_REINFORCE_DEV__;
    if ((host === "127.0.0.1" || host === "localhost") && autotest) {
      try {
        if (gm && typeof gm.setContinuousEnabled === "function")
          gm.setContinuousEnabled(true);
      } catch (e) {
      }
      try {
        if (gm && typeof gm.setReinforcementInterval === "function")
          gm.setReinforcementInterval(0.01);
      } catch (e) {
      }
      try {
        if (gm && typeof gm.stepOnce === "function") gm.stepOnce(0.02);
      } catch (e) {
      }
    }
  } catch (e) {
  }
  let lastReinforcementSummary = "";
  let reinforcementsHandler = null;
  try {
    if (gm && typeof gm.on === "function") {
      reinforcementsHandler = (msg) => {
        const list = msg && msg.spawned || [];
        const types = list.map((s) => s.type).filter(Boolean);
        const summary = `Reinforcements: spawned ${list.length} ships (${types.join(", ")})`;
        lastReinforcementSummary = summary;
        try {
          const tid = setTimeout(() => {
            lastReinforcementSummary = "";
          }, 3e3);
          pendingTimers.add(tid);
        } catch (e) {
        }
        try {
          if (ui && ui.stats)
            ui.stats.textContent = `${ui.stats.textContent} | ${summary}`;
        } catch (e) {
        }
      };
      gm.on("reinforcements", reinforcementsHandler);
    }
  } catch (e) {
  }
  const workerIndicator = rootDocument.getElementById("workerIndicator");
  let toastContainer = rootDocument.getElementById("toastContainer");
  if (!toastContainer) {
    try {
      toastContainer = rootDocument.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.style.position = "fixed";
      toastContainer.style.right = "16px";
      toastContainer.style.top = "16px";
      toastContainer.style.zIndex = "9999";
      toastContainer.style.pointerEvents = "none";
      rootDocument.body.appendChild(toastContainer);
      disposables.push(() => {
        try {
          if (toastContainer && toastContainer.parentNode)
            toastContainer.parentNode.removeChild(toastContainer);
        } catch (e) {
        }
      });
    } catch (e) {
      toastContainer = null;
    }
  }
  function showToast(msg, opts = {}) {
    try {
      if (!toastContainer) return;
      const ttl = typeof opts.ttl === "number" ? opts.ttl : 2e3;
      const el = rootDocument.createElement("div");
      el.style.background = "rgba(20,20,30,0.9)";
      el.style.color = "#fff";
      el.style.padding = "8px 12px";
      el.style.marginTop = "6px";
      el.style.borderRadius = "6px";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
      el.style.fontFamily = "sans-serif";
      el.style.fontSize = "13px";
      el.style.pointerEvents = "auto";
      el.textContent = msg;
      toastContainer.appendChild(el);
      const tid = setTimeout(() => {
        try {
          el.style.transition = "opacity 300ms ease";
          el.style.opacity = "0";
        } catch (e) {
        }
        setTimeout(() => {
          try {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          } catch (err) {
          }
        }, 350);
      }, ttl);
      pendingTimers.add(tid);
    } catch (e) {
    }
  }
  let levelupHandler = null;
  try {
    if (gm && typeof gm.on === "function") {
      levelupHandler = (m) => {
        try {
          const ship = m && m.ship || null;
          const lvl = m && m.newLevel || (m && m.newLevel === 0 ? 0 : void 0);
          const who = ship && ship.team ? `${ship.team} ship` : "Ship";
          const msg = `${who} leveled up to ${lvl}`;
          showToast(msg, { ttl: 2200 });
        } catch (e) {
        }
      };
      gm.on("levelup", levelupHandler);
    }
  } catch (e) {
  }
  if (workerIndicator) {
    try {
      const refresh = () => {
        try {
          workerIndicator.textContent = gm.isWorker && gm.isWorker() ? "Worker" : "Main";
        } catch (e) {
        }
        try {
          workerIndicatorRaf = requestAnimationFrame(refresh);
        } catch (e) {
          workerIndicatorRaf = null;
        }
      };
      refresh();
    } catch (e) {
      workerIndicator.textContent = "Unknown";
    }
  }
  try {
    if (ui.startPause)
      addListener(ui.startPause, "click", () => {
        if (gm.isRunning()) {
          gm.pause();
          ui.startPause.textContent = "\u25B6 Start";
        } else {
          gm.start();
          ui.startPause.textContent = "\u23F8 Pause";
        }
      });
  } catch (e) {
  }
  try {
    if (ui.reset) addListener(ui.reset, "click", () => gm.reset());
  } catch (e) {
  }
  try {
    if (ui.addRed) addListener(ui.addRed, "click", () => gm.spawnShip("red"));
  } catch (e) {
  }
  try {
    if (ui.addBlue)
      addListener(ui.addBlue, "click", () => gm.spawnShip("blue"));
  } catch (e) {
  }
  function onSeedBtnClick() {
    try {
      const raw = typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt("Enter new seed (leave blank for random):", "") : null;
      if (raw == null) return;
      const trimmed = String(raw).trim();
      if (trimmed === "") {
        try {
          gm.reseed();
          showToast("Reseeded with random seed");
        } catch (e) {
        }
        return;
      }
      const asNum = Number(trimmed);
      if (!Number.isFinite(asNum) || Math.floor(asNum) !== asNum) {
        try {
          showToast("Invalid seed. Please enter an integer.");
        } catch (e) {
        }
        return;
      }
      try {
        gm.reseed(asNum >>> 0);
        showToast(`Reseeded with ${asNum >>> 0}`);
      } catch (e) {
      }
    } catch (e) {
    }
  }
  try {
    if (ui.seedBtn) addListener(ui.seedBtn, "click", onSeedBtnClick);
  } catch (e) {
  }
  try {
    if (ui.continuousCheckbox) {
      addListener(ui.continuousCheckbox, "change", (ev) => {
        const v = !!ev.target.checked;
        if (gm && typeof gm.setContinuousEnabled === "function")
          gm.setContinuousEnabled(v);
      });
    }
  } catch (e) {
  }
  function uiTick() {
    if (isUiTickRunning) return;
    isUiTickRunning = true;
    const startTick = performance.now();
    let skipRender = false;
    try {
      const s = gm.snapshot();
      ui.redScore.textContent = `Red ${gm.score.red}`;
      ui.blueScore.textContent = `Blue ${gm.score.blue}`;
      const redCount = s.ships.filter((sh) => sh.team === "red").length;
      const blueCount = s.ships.filter((sh) => sh.team === "blue").length;
      ui.stats.textContent = `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}` + (lastReinforcementSummary ? ` | ${lastReinforcementSummary}` : "");
    } catch (e) {
    }
    const endTick = performance.now();
    const tickTime = endTick - startTick;
    if (tickTime > SIM.DT_MS) {
      skipRender = true;
    }
    const dynamicEnabled = !!RendererConfig.dynamicScaleEnabled;
    const scaleSliderEl = rootDocument.getElementById(
      "rendererScaleRange"
    );
    const scaleValEl = rootDocument.getElementById("rendererScaleValue");
    const now = performance.now();
    RendererConfig._lastUiTick = RendererConfig._lastUiTick || now;
    const dt = now - RendererConfig._lastUiTick;
    RendererConfig._lastUiTick = now;
    RendererConfig.lastFrameTime = dt;
    let frameScore = "green";
    if (dt > 33) frameScore = "red";
    else if (dt > 20) frameScore = "yellow";
    RendererConfig.frameScore = frameScore;
    if (scaleValEl) {
      scaleValEl.style.color = frameScore === "green" ? "#4caf50" : frameScore === "yellow" ? "#ffd600" : "#ff1744";
    }
    if (dynamicEnabled && scaleSliderEl) {
      let scale = RendererConfig.renderScale;
      if (frameScore === "red" && scale > 0.25)
        scale = Math.max(0.25, scale - 0.05);
      else if (frameScore === "green" && scale < 2)
        scale = Math.min(2, scale + 0.01);
      if (scale !== RendererConfig.renderScale) {
        RendererConfig.renderScale = scale;
        internalScaleUpdate = true;
        scaleSliderEl.value = scale.toFixed(2);
        if (scaleValEl) scaleValEl.textContent = scale.toFixed(2);
        fitCanvasToWindow();
        internalScaleUpdate = false;
      }
    }
    if (!skipRender) {
      try {
        uiRaf = requestAnimationFrame(() => {
          isUiTickRunning = false;
          uiTick();
        });
      } catch (e) {
        uiRaf = null;
        isUiTickRunning = false;
      }
    } else {
      const tid = setTimeout(() => {
        isUiTickRunning = false;
        uiTick();
      }, SIM.DT_MS);
      if (typeof tid === "number") pendingTimers.add(tid);
    }
  }
  uiRaf = requestAnimationFrame(uiTick);
  function dispose() {
    try {
      if (gm && typeof gm.destroy === "function") gm.destroy();
    } catch (e) {
    }
    try {
      if (gm && typeof gm.pause === "function") gm.pause();
    } catch (e) {
    }
    try {
      if (gm && typeof gm.off === "function") {
        if (reinforcementsHandler)
          gm.off("reinforcements", reinforcementsHandler);
        if (levelupHandler) gm.off("levelup", levelupHandler);
      }
    } catch (e) {
    }
    if (uiRaf != null) {
      try {
        cancelAnimationFrame(uiRaf);
      } catch (e) {
      }
      uiRaf = null;
    }
    isUiTickRunning = false;
    if (workerIndicatorRaf != null) {
      try {
        cancelAnimationFrame(workerIndicatorRaf);
      } catch (e) {
      }
      workerIndicatorRaf = null;
    }
    try {
      clearAllTimers();
    } catch (e) {
    }
    for (const fn of disposables.slice()) {
      try {
        fn();
      } catch (e) {
      }
    }
    disposables.length = 0;
    try {
      if (typeof window !== "undefined" && window.gm) {
        try {
          delete window.gm;
        } catch (e) {
        }
      }
    } catch (e) {
    }
  }
  return { gm, renderer, dispose };
}
if (typeof window !== "undefined") {
  let safeStartApp = function(doc) {
    if (appInstance && typeof appInstance.dispose === "function") {
      appInstance.dispose();
    }
    startApp(doc).then((instance) => {
      appInstance = instance;
    });
  };
  safeStartApp2 = safeStartApp;
  let appInstance = null;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => safeStartApp(document));
  else safeStartApp(document);
  window.addEventListener("beforeunload", () => {
    if (appInstance && typeof appInstance.dispose === "function") {
      appInstance.dispose();
    }
  });
}
var safeStartApp2;
var main_default = startApp;
export {
  main_default as default,
  startApp
};
//# sourceMappingURL=bundled.js.map
