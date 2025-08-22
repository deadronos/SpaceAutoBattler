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

// src/rng.js
function srand(seed = 1) {
  _seed = seed >>> 0;
}
function mulberry32(a) {
  return function() {
    let t = a += 1831565813;
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
var _seed;
var init_rng = __esm({
  "src/rng.js"() {
    "use strict";
    _seed = 1;
  }
});

// src/config/teamsConfig.js
var teamsConfig_exports = {};
__export(teamsConfig_exports, {
  TeamsConfig: () => TeamsConfig,
  chooseReinforcements: () => chooseReinforcements,
  chooseReinforcementsWithManagerSeed: () => chooseReinforcementsWithManagerSeed,
  default: () => teamsConfig_default,
  generateFleetForTeam: () => generateFleetForTeam,
  makeInitialFleets: () => makeInitialFleets
});
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
      const x = Math.max(0, Math.min(bounds.W, baseX + dx));
      const y = Math.max(0, Math.min(bounds.H, centerY + dy));
      if (typeof shipFactory === "function") {
        out.push(shipFactory(type, x, y, teamId));
      } else {
        out.push({ type, x, y, team: teamId });
      }
    }
  }
  return out;
}
function makeInitialFleets(seed = 0, bounds = { W: 800, H: 600 }, shipFactory, options = {}) {
  const red = generateFleetForTeam(seed, "red", bounds, shipFactory, options);
  const blue = generateFleetForTeam(seed + 1, "blue", bounds, shipFactory, options);
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
      const cnt = (state.ships || []).filter((s) => s && s.team === t).length;
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
    const maxPerTick = Math.max(1, Math.floor(Number(cfg.perTick) || 1));
    const spawnCount = Math.max(1, Math.floor(rng() * maxPerTick) + 1);
    const b = options.bounds || { W: 800, H: 600 };
    const centerY = b.H / 2;
    const baseX = weakest === "red" ? b.W * 0.18 : b.W * 0.82;
    for (let i = 0; i < spawnCount; i++) {
      const x = Math.max(0, Math.min(b.W, baseX + (rng() - 0.5) * 120));
      const y = Math.max(0, Math.min(b.H, centerY + (rng() - 0.5) * 160));
      const type = candidateTypes[Math.floor(rng() * candidateTypes.length)] || (cfg.reinforceType || "fighter");
      orders.push({ type, team: weakest, x, y });
    }
    return orders;
  }
  return [];
}
function chooseReinforcementsWithManagerSeed(state = {}, options = {}) {
  const seed = Math.floor(srandom() * 4294967295) >>> 0;
  return chooseReinforcements(seed, state, options);
}
var TeamsConfig, teamsConfig_default;
var init_teamsConfig = __esm({
  "src/config/teamsConfig.js"() {
    "use strict";
    init_rng();
    TeamsConfig = {
      teams: {
        red: { id: "red", color: "#ff4d4d", label: "Red" },
        blue: { id: "blue", color: "#4da6ff", label: "Blue" }
      },
      // Default fleet composition when prepopulating a game
      defaultFleet: {
        // counts per ship type
        counts: {
          fighter: 8,
          corvette: 3,
          frigate: 1
        },
        // jitter and spacing used when scattering initial ships
        spacing: 28,
        jitter: { x: 80, y: 120 }
      },
      // Continuous reinforcement defaults
      continuousReinforcement: {
        enabled: false,
        // toggle to enable/disable
        scoreMargin: 0.12,
        // if weaker team has less than (1 - scoreMargin) of strength, reinforce
        perTick: 1,
        // number of reinforcement ships to provide when triggered
        reinforceType: "fighter"
        // default reinforcement ship type
      }
    };
    teamsConfig_default = TeamsConfig;
  }
});

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
    turret: "#94a3b8"
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
        { type: "polygon", points: [[0, -0.35], [-0.35, 0], [-0.6, -0.65]] }
      ],
      strokeWidth: 0.08,
      model3d: { url: void 0, scale: 1, type: "gltf", mesh: void 0 }
    },
    corvette: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[1, 0], [0.2, 0.6], [-0.9, 0.5], [-1.1, 0], [-0.9, -0.5], [0.2, -0.6]] },
        { type: "polygon", points: [[1.2, 0.18], [1, 0.1], [1, -0.1], [1.2, -0.18]] }
      ],
      strokeWidth: 0.08,
      model3d: { url: void 0, scale: 1.4, type: "gltf", mesh: void 0 }
    },
    frigate: {
      type: "polygon",
      points: [[1.1, 0], [0.6, 0.55], [-0.2, 0.8], [-1.2, 0.45], [-1.2, -0.45], [-0.2, -0.8], [0.6, -0.55]],
      strokeWidth: 0.1,
      model3d: { url: void 0, scale: 1.8, type: "gltf", mesh: void 0 }
    },
    destroyer: {
      type: "polygon",
      points: [[1.4, 0], [0.8, 0.5], [0.1, 0.7], [-0.6, 0.6], [-1.4, 0.4], [-1.4, -0.4], [-0.6, -0.6], [0.1, -0.7], [0.8, -0.5]],
      strokeWidth: 0.12,
      model3d: { url: void 0, scale: 2.2, type: "gltf", mesh: void 0 }
    },
    carrier: {
      type: "compound",
      parts: [
        { type: "polygon", points: [[1.1, 0], [0.6, 0.7], [-0.5, 0.9], [-1.4, 0.7], [-1.6, 0], [-1.4, -0.7], [-0.5, -0.9], [0.6, -0.7]] },
        { type: "polygon", points: [[1.4, 0.25], [1.1, 0.15], [1.1, -0.15], [1.4, -0.25]] }
      ],
      strokeWidth: 0.12,
      model3d: { url: void 0, scale: 3, type: "gltf", mesh: void 0 }
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
    }
  }
};
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

// src/config/entitiesConfig.js
var ShipConfig = {
  fighter: {
    maxHp: 15,
    armor: 0,
    maxShield: 8,
    shieldRegen: 1,
    dmg: 3,
    radius: 4,
    cannons: [
      { damage: 3, rate: 3, spread: 0.1, muzzleSpeed: 300, bulletRadius: 1.5, bulletTTL: 1.2 }
    ],
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
function getShipConfig() {
  return JSON.parse(JSON.stringify(ShipConfig));
}
var VisualMappingConfig = {
  // thresholds to map bulletRadius to an asset kind
  bulletRadiusThresholds: [
    { threshold: 0.22, kind: "small" },
    { threshold: 0.32, kind: "medium" },
    { threshold: Infinity, kind: "large" }
  ],
  defaultTurretKind: "basic",
  shipAssetKey: {
    fighter: "fighter",
    corvette: "corvette",
    frigate: "frigate",
    destroyer: "destroyer",
    carrier: "carrier"
  }
};
function bulletKindForRadius(r = 0.2) {
  for (const t of VisualMappingConfig.bulletRadiusThresholds) {
    if (r <= t.threshold) return t.kind;
  }
  return "small";
}

// src/entities.js
var nextId = 1;
function genId() {
  return nextId++;
}
function createShip(type = "fighter", x = 0, y = 0, team = "red") {
  const cfg = getShipConfig()[type] || getShipConfig().fighter;
  return {
    id: genId(),
    type,
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
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6
  };
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
function makeInitialState() {
  return {
    t: 0,
    ships: [],
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: []
  };
}

// src/simulate.js
init_rng();

// src/config/progressionConfig.js
var progression = {
  xpPerDamage: 1,
  xpPerKill: 50,
  xpToLevel: (level) => 100 + level * 50,
  // percent-per-level scalars (fractions)
  hpPercentPerLevel: 0.1,
  dmgPercentPerLevel: 0.08,
  shieldPercentPerLevel: 0.06
};

// src/simulate.js
var SIM_DT_MS = 16;
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function simulateStep(state, dtSeconds, bounds) {
  state.t += dtSeconds;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dtSeconds;
    b.y += b.vy * dtSeconds;
    b.ttl -= dtSeconds;
    if (b.ttl <= 0) state.bullets.splice(i, 1);
  }
  for (const s of state.ships) {
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    if (s.x < 0) s.x += bounds.W;
    if (s.x > bounds.W) s.x -= bounds.W;
    if (s.y < 0) s.y += bounds.H;
    if (s.y > bounds.H) s.y -= bounds.H;
  }
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    for (let si = state.ships.length - 1; si >= 0; si--) {
      const s = state.ships[si];
      if (s.team === b.team) continue;
      const r = (s.radius || 6) + (b.radius || 1);
      if (dist2(b, s) <= r * r) {
        const attacker = typeof b.ownerId === "number" || typeof b.ownerId === "string" ? state.ships.find((sh) => sh.id === b.ownerId) || void 0 : void 0;
        let dealtToShield = 0;
        let dealtToHealth = 0;
        const shield = s.shield || 0;
        if (shield > 0) {
          const absorbed = Math.min(shield, b.damage);
          s.shield -= absorbed;
          state.shieldHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: absorbed });
          const remaining = b.damage - absorbed;
          if (remaining > 0) {
            s.hp -= remaining;
            state.healthHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: remaining });
          }
          dealtToShield = absorbed;
          dealtToHealth = Math.max(0, (b.damage || 0) - absorbed);
        } else {
          s.hp -= b.damage;
          state.healthHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: b.damage });
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
        state.bullets.splice(bi, 1);
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
          state.explosions.push({ x: s.x, y: s.y, team: s.team });
          state.ships.splice(si, 1);
        }
        break;
      }
    }
  }
  for (const s of state.ships) {
    if (s.maxShield) s.shield = Math.min(s.maxShield, (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds);
  }
  return state;
}

// src/gamemanager.js
init_rng();

// src/config/displayConfig.js
function getDefaultBounds() {
  return { W: Math.max(800, window.innerWidth), H: Math.max(600, window.innerHeight) };
}

// src/createSimWorker.js
function createSimWorker(url = "./simWorker.js") {
  const worker = new Worker(url, { type: "module" });
  const listeners = /* @__PURE__ */ new Map();
  worker.onmessage = (ev) => {
    const msg = ev.data;
    const cb = listeners.get(msg.type);
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

// src/config/gamemanagerConfig.js
var SHIELD = {
  ttl: 0.4,
  particleCount: 6,
  particleTTL: 0.5,
  particleColor: "#88ccff",
  particleSize: 2
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
};
var STARS = {
  twinkle: true,
  redrawInterval: 500
};

// src/gamemanager.js
init_teamsConfig();

// src/behavior.js
init_rng();
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
function findNearestEnemy(state, ship) {
  let best = null;
  let bestD2 = Infinity;
  for (const other of state.ships) {
    if (other === ship) continue;
    if (other.team === ship.team) continue;
    const dx = other.x - ship.x;
    const dy = other.y - ship.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = other;
    }
  }
  return best;
}
function aimWithSpread(from, to, spread = 0) {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
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
  if (!Array.isArray(ship.cannons) || ship.cannons.length === 0) return;
  for (const c of ship.cannons) {
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
    state.bullets.push(b);
    const rate = typeof c.rate === "number" && c.rate > 0 ? c.rate : 1;
    c.__cd = 1 / rate;
  }
}
function applySimpleAI(state, dt, bounds = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const enemy = findNearestEnemy(state, s);
    if (enemy) {
      const accel = typeof s.accel === "number" ? s.accel : 100;
      const aim = aimWithSpread(s, enemy, 0);
      s.vx = (s.vx || 0) + aim.x * accel * dt;
      s.vy = (s.vy || 0) + aim.y * accel * dt;
      tryFire(state, s, enemy, dt);
    } else {
      s.vx = (s.vx || 0) + srange(-1, 1) * 8 * dt;
      s.vy = (s.vy || 0) + srange(-1, 1) * 8 * dt;
    }
    const maxSpeed = 160;
    clampSpeed(s, maxSpeed);
  }
}

// src/gamemanager.js
function createGameManager({ renderer, canvas, seed = 12345, createSimWorker: createSimWorkerFactory } = {}) {
  let state = makeInitialState();
  let running = false;
  const managerListeners = /* @__PURE__ */ new Map();
  function emitManagerEvent2(type, msg) {
    const arr = managerListeners.get(type);
    if (Array.isArray(arr)) {
      for (const cb of arr.slice()) {
        try {
          if (typeof cb === "function") cb(msg);
        } catch (e) {
        }
      }
    }
  }
  let score = { red: 0, blue: 0 };
  let continuous = false;
  let reinforcementInterval = 5;
  let reinforcementAccumulator = 0;
  let continuousOptions = {};
  let lastReinforcement = { spawned: [], timestamp: 0, options: {} };
  const bounds = getDefaultBounds();
  srand(seed);
  let simWorker = null;
  let workerReady = false;
  const workerReadyCbs = [];
  const flashes = [];
  const shieldFlashes = [];
  const healthFlashes = [];
  try {
    const factory = createSimWorkerFactory || createSimWorker;
    simWorker = factory(new URL("./simWorker.js", import.meta.url).href);
    try {
      simWorker.on("reinforcements", (m) => emitManagerEvent2("reinforcements", m));
    } catch (e) {
    }
    simWorker.on("ready", () => {
      workerReady = true;
      try {
        for (const cb of workerReadyCbs.slice()) {
          try {
            if (typeof cb === "function") cb();
          } catch (e) {
          }
        }
      } catch (e) {
      }
    });
    simWorker.on("snapshot", (m) => {
      if (m && m.state) state = m.state;
    });
    simWorker.on("error", (m) => console.error("sim worker error", m));
    simWorker.post({ type: "init", seed, bounds, simDtMs: SIM_DT_MS, state });
    simWorker.post({ type: "start" });
  } catch (e) {
    simWorker = null;
  }
  function step(dtSeconds) {
    if (!simWorker) {
      try {
        applySimpleAI(state, dtSeconds, bounds);
      } catch (e) {
      }
    }
    if (simWorker) {
      simWorker.post({ type: "snapshotRequest" });
    } else {
      simulateStep(state, dtSeconds, bounds);
    }
    if (!simWorker && continuous) {
      reinforcementAccumulator += dtSeconds;
      if (reinforcementAccumulator >= reinforcementInterval) {
        reinforcementAccumulator = 0;
        try {
          const teams = Object.keys((init_teamsConfig(), __toCommonJS(teamsConfig_exports)).TeamsConfig.teams);
          const spawned = [];
          for (const team of teams) {
            const teamShips = (state.ships || []).filter((s) => s && s.team === team);
            if (teamShips.length < 3) {
              const teamState = Object.assign({}, state, { ships: teamShips });
              const orders = (init_teamsConfig(), __toCommonJS(teamsConfig_exports)).chooseReinforcementsWithManagerSeed(teamState, Object.assign({}, continuousOptions, { bounds, team }));
              if (Array.isArray(orders) && orders.length) {
                for (const o of orders) {
                  try {
                    let type = o.type || "fighter";
                    if (Array.isArray(continuousOptions.shipTypes) && continuousOptions.shipTypes.length) {
                      const types = continuousOptions.shipTypes;
                      type = types[Math.floor(srandom() * types.length)] || type;
                    }
                    const x = typeof o.x === "number" ? o.x : Math.max(0, Math.min(bounds.W, (srandom() - 0.5) * bounds.W + bounds.W * 0.5));
                    const y = typeof o.y === "number" ? o.y : Math.max(0, Math.min(bounds.H, (srandom() - 0.5) * bounds.H + bounds.H * 0.5));
                    const ship = createShip(type, x, y, team);
                    state.ships.push(ship);
                    spawned.push(ship);
                  } catch (e) {
                  }
                }
              }
            }
          }
          if (spawned.length) {
            try {
              emitManagerEvent2("reinforcements", { spawned });
            } catch (e) {
            }
            try {
              lastReinforcement = { spawned: spawned.slice(), timestamp: Date.now(), options: Object.assign({}, continuousOptions) };
            } catch (e) {
            }
          }
        } catch (e) {
        }
      }
    }
    if (Array.isArray(state.explosions)) {
      for (const ex of state.explosions) {
        flashes.push({ x: ex.x, y: ex.y, team: ex.team, ttl: EXPLOSION.particleTTL || 0.6, life: EXPLOSION.particleTTL || 0.6 });
      }
    }
    if (Array.isArray(state.shieldHits)) {
      for (const h of state.shieldHits) {
        shieldFlashes.push({ x: h.hitX || h.x, y: h.hitY || h.y, team: h.team, amount: h.amount, ttl: SHIELD.ttl || 0.4, life: SHIELD.ttl || 0.4 });
      }
      state.shieldHits.length = 0;
    }
    if (Array.isArray(state.healthHits)) {
      for (const h of state.healthHits) {
        healthFlashes.push({ x: h.hitX || h.x, y: h.hitY || h.y, team: h.team, amount: h.amount, ttl: HEALTH.ttl || 0.6, life: HEALTH.ttl || 0.6 });
      }
      state.healthHits.length = 0;
    }
    while (state.explosions.length) {
      const e = state.explosions.shift();
      if (e.team === "red") score.blue++;
      else score.red++;
    }
    function decay(arr, dt) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const it = arr[i];
        it.life = (it.life || 0) - dt;
        if (it.life <= 0) arr.splice(i, 1);
      }
    }
    decay(flashes, dtSeconds);
    decay(shieldFlashes, dtSeconds);
    decay(healthFlashes, dtSeconds);
    if (renderer && typeof renderer.renderState === "function") {
      const renderSnapshot = {
        ships: state.ships,
        bullets: state.bullets,
        flashes,
        shieldFlashes,
        healthFlashes,
        t: state.t
      };
      renderer.renderState(renderSnapshot);
    }
  }
  let acc = 0;
  let last = performance.now();
  function runLoop() {
    if (!running) return;
    const now = performance.now();
    acc += now - last;
    last = now;
    if (acc > 250) acc = 250;
    while (acc >= SIM_DT_MS) {
      step(SIM_DT_MS / 1e3);
      acc -= SIM_DT_MS;
    }
    requestAnimationFrame(runLoop);
  }
  return {
    on(event, cb) {
      if (typeof event === "string" && typeof cb === "function") {
        const arr = managerListeners.get(event) || [];
        arr.push(cb);
        managerListeners.set(event, arr);
      }
    },
    // expose single-step for tests and deterministic stepping
    stepOnce(dtSeconds = SIM_DT_MS / 1e3) {
      step(Number(dtSeconds) || SIM_DT_MS / 1e3);
    },
    off(event, cb) {
      if (typeof event === "string" && typeof cb === "function") {
        const arr = managerListeners.get(event) || [];
        const i = arr.indexOf(cb);
        if (i !== -1) {
          arr.splice(i, 1);
          managerListeners.set(event, arr);
        }
      }
    },
    start() {
      if (!running) {
        running = true;
        last = performance.now();
        runLoop();
      }
    },
    pause() {
      running = false;
    },
    reset() {
      state = makeInitialState();
      score = { red: 0, blue: 0 };
      if (simWorker) simWorker.post({ type: "command", cmd: "setState", args: { state } });
    },
    // continuous mode controls (UI can toggle this)
    setContinuousEnabled(v = false) {
      if (simWorker) {
        try {
          simWorker.post({ type: "setContinuous", value: !!v });
        } catch (e) {
        }
      } else {
        continuous = !!v;
        continuousOptions = Object.assign({}, continuousOptions, { enabled: !!v });
        if (!continuous) reinforcementAccumulator = 0;
      }
    },
    isContinuousEnabled() {
      if (simWorker) return !!continuous;
      return !!continuous;
    },
    // configure continuous reinforcement behaviour used by chooseReinforcements
    setContinuousOptions(opts = {}) {
      continuousOptions = Object.assign({}, continuousOptions, opts);
    },
    getContinuousOptions() {
      return Object.assign({}, continuousOptions);
    },
    setReinforcementInterval(seconds = 5) {
      if (simWorker) {
        try {
          simWorker.post({ type: "setReinforcementInterval", seconds: Math.max(0.01, Number(seconds) || 5) });
        } catch (e) {
        }
      } else {
        reinforcementInterval = Math.max(0.01, Number(seconds) || 5);
      }
    },
    isRunning() {
      return running;
    },
    // diagnostics getters for UI
    getLastReinforcement() {
      return Object.assign({}, lastReinforcement);
    },
    getReinforcementInterval() {
      return reinforcementInterval;
    },
    // authoritative check whether simulation is running in a worker
    isWorker() {
      return !!simWorker && !!workerReady;
    },
    onWorkerReady(cb) {
      if (typeof cb === "function") workerReadyCbs.push(cb);
    },
    offWorkerReady(cb) {
      const i = workerReadyCbs.indexOf(cb);
      if (i !== -1) workerReadyCbs.splice(i, 1);
    },
    spawnShip(color = "red") {
      const x = Math.random() * bounds.W;
      const y = Math.random() * bounds.H;
      const ship = createShip("fighter", x, y, color);
      const dir = color === "red" ? 1 : -1;
      ship.vx = 30 * dir;
      ship.vy = (Math.random() - 0.5) * 20;
      if (simWorker) simWorker.post({ type: "command", cmd: "spawnShip", args: { ship } });
      else state.ships.push(ship);
    },
    reseed(newSeed = Math.floor(Math.random() * 4294967295)) {
      srand(newSeed);
      if (simWorker) simWorker.post({ type: "setSeed", seed: newSeed });
    },
    formFleets() {
      for (let i = 0; i < 5; i++) {
        const r = createShip("fighter", 100 + i * 20, 100 + i * 10, "red");
        r.vx = 40;
        r.vy = 0;
        const b = createShip("fighter", bounds.W - 100 - i * 20, bounds.H - 100 - i * 10, "blue");
        b.vx = -40;
        b.vy = 0;
        if (simWorker) {
          simWorker.post({ type: "command", cmd: "spawnShip", args: { ship: r } });
          simWorker.post({ type: "command", cmd: "spawnShip", args: { ship: b } });
        } else {
          state.ships.push(r);
          state.ships.push(b);
        }
      }
    },
    snapshot() {
      return { ships: state.ships.slice(), bullets: state.bullets.slice(), t: state.t };
    },
    score,
    _internal: { state, bounds }
  };
}
var config = {
  shield: Object.assign({}, SHIELD),
  health: Object.assign({}, HEALTH),
  explosion: Object.assign({}, EXPLOSION),
  stars: Object.assign({}, STARS)
};

// src/canvasrenderer.js
init_teamsConfig();
var CanvasRenderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.providesOwnLoop = false;
  }
  init() {
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return false;
    return true;
  }
  isRunning() {
    return false;
  }
  renderState(state, interpolation = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, w, h);
    function drawPolygon(points) {
      if (!points || points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    for (const s of state.ships) {
      const team = s.team === "blue" ? TeamsConfig.teams.blue : TeamsConfig.teams.red;
      const color = team.color || AssetsConfig.palette.shipHull;
      const radius = s.radius || 6;
      const angle = s.angle || 0;
      const shape = getShipAsset(s.type || "fighter");
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);
      ctx.scale(radius, radius);
      ctx.fillStyle = color;
      if (shape.type === "polygon") {
        drawPolygon(shape.points);
      } else if (shape.type === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, shape.r || 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === "compound" && Array.isArray(shape.parts)) {
        for (const part of shape.parts) {
          if (part.type === "polygon") drawPolygon(part.points);
          else if (part.type === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
      ctx.fillStyle = "#222";
      ctx.fillRect(s.x - 10, s.y - 12, 20, 4);
      ctx.fillStyle = "#4caf50";
      ctx.fillRect(s.x - 10, s.y - 12, 20 * Math.max(0, (s.hp || 0) / (s.maxHp || 1)), 4);
    }
    for (const s of state.ships) {
      const radius = (s.radius || 6) * 0.6;
      const angle = s.angle || 0;
      const tShape = getTurretAsset("basic");
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);
      ctx.scale(radius, radius);
      ctx.fillStyle = AssetsConfig.palette.turret;
      if (tShape.type === "compound") {
        for (const part of tShape.parts) {
          if (part.type === "polygon") drawPolygon(part.points);
          else if (part.type === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, part.r || 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }
    for (const b of state.bullets) {
      const r = b.radius || b.bulletRadius || 1.5;
      const kind = bulletKindForRadius(
        r / 6
        /* normalize roughly by typical ship radius */
      );
      const shape = getBulletAsset(kind);
      ctx.save();
      ctx.translate(b.x, b.y);
      const px = Math.max(1, r);
      if (shape.type === "circle") {
        ctx.beginPath();
        ctx.fillStyle = AssetsConfig.palette.bullet;
        ctx.arc(0, 0, px, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape.type === "polygon") {
        ctx.fillStyle = AssetsConfig.palette.bullet;
        ctx.scale(px, px);
        drawPolygon(shape.points);
      }
      ctx.restore();
    }
    function drawRing(x, y, R, color, alpha = 1, thickness = 2) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, R), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (Array.isArray(state.flashes)) {
      for (const f of state.flashes) {
        const ttl = f.ttl || 0.6;
        const life = f.life != null ? f.life : ttl;
        const t = Math.max(0, Math.min(1, life / ttl));
        const R = 8 + (1 - t) * 28;
        const alpha = 0.8 * t;
        const color = "#ffaa33";
        drawRing(f.x || 0, f.y || 0, R, color, alpha, 3);
      }
    }
    if (Array.isArray(state.shieldFlashes)) {
      for (const s of state.shieldFlashes) {
        const ttl = s.ttl || 0.4;
        const life = s.life != null ? s.life : ttl;
        const t = Math.max(0, Math.min(1, life / ttl));
        const R = 6 + (1 - t) * 16;
        const alpha = 0.9 * t;
        drawRing(s.x || 0, s.y || 0, R, "#88ccff", alpha, 2);
      }
    }
    if (Array.isArray(state.healthFlashes)) {
      for (const s of state.healthFlashes) {
        const ttl = s.ttl || 0.6;
        const life = s.life != null ? s.life : ttl;
        const t = Math.max(0, Math.min(1, life / ttl));
        const R = 6 + (1 - t) * 18;
        const alpha = 0.9 * t;
        drawRing(s.x || 0, s.y || 0, R, "#ff7766", alpha, 2);
      }
    }
    ctx.restore();
  }
};

// src/webglrenderer.js
var WebGLRenderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.providesOwnLoop = false;
  }
  init() {
    try {
      this.gl = this.canvas.getContext("webgl2");
      if (!this.gl) return false;
      const gl = this.gl;
      gl.clearColor(0.02, 0.03, 0.06, 1);
      return true;
    } catch (e) {
      return false;
    }
  }
  isRunning() {
    return false;
  }
  renderState(state, interpolation = 0) {
    if (!this.gl) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
};

// src/config/rendererConfig.js
var RendererConfig = {
  preferred: "canvas",
  allowUrlOverride: true,
  allowWebGL: true
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

// src/main.js
async function startApp(rootDocument = document) {
  const canvas = rootDocument.getElementById("world");
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
  function fitCanvasToWindow() {
    const dpr = window.devicePixelRatio || 1;
    const bounds = getDefaultBounds();
    canvas.style.width = `${bounds.W}px`;
    canvas.style.height = `${bounds.H}px`;
    canvas.width = Math.round(bounds.W * dpr);
    canvas.height = Math.round(bounds.H * dpr);
  }
  fitCanvasToWindow();
  window.addEventListener("resize", fitCanvasToWindow);
  let renderer;
  const pref = getPreferredRenderer();
  if (pref === "webgl") {
    try {
      const w = new WebGLRenderer(canvas);
      if (w && w.init && w.init()) renderer = w;
    } catch (e) {
    }
  }
  if (!renderer) {
    renderer = new CanvasRenderer(canvas);
    renderer.init && renderer.init();
  }
  const gm = createGameManager({ renderer, canvas });
  try {
    if (gm && typeof gm.on === "function") {
      gm.on("reinforcements", (msg) => {
        const list = msg && msg.spawned || [];
        const types = list.map((s) => s.type).filter(Boolean);
        const summary = `Reinforcements: spawned ${list.length} ships (${types.join(", ")})`;
        if (ui.stats) ui.stats.textContent = `${ui.stats.textContent} | ${summary}`;
        else console.info(summary);
      });
    }
  } catch (e) {
  }
  const workerIndicator = rootDocument.getElementById("workerIndicator");
  if (workerIndicator) {
    try {
      workerIndicator.textContent = gm.isWorker() ? "Worker" : "Main";
      (function refresh() {
        workerIndicator.textContent = gm.isWorker() ? "Worker" : "Main";
        requestAnimationFrame(refresh);
      })();
    } catch (e) {
      workerIndicator.textContent = "Unknown";
    }
  }
  ui.startPause.addEventListener("click", () => {
    if (gm.isRunning()) {
      gm.pause();
      ui.startPause.textContent = "\u25B6 Start";
    } else {
      gm.start();
      ui.startPause.textContent = "\u23F8 Pause";
    }
  });
  ui.reset.addEventListener("click", () => gm.reset());
  ui.addRed.addEventListener("click", () => gm.spawnShip("red"));
  ui.addBlue.addEventListener("click", () => gm.spawnShip("blue"));
  ui.seedBtn.addEventListener("click", () => gm.reseed());
  ui.formationBtn.addEventListener("click", () => gm.formFleets());
  if (ui.continuousCheckbox) {
    ui.continuousCheckbox.addEventListener("change", (ev) => {
      const v = !!ev.target.checked;
      if (gm && typeof gm.setContinuousEnabled === "function") gm.setContinuousEnabled(v);
    });
  }
  function uiTick() {
    const s = gm.snapshot();
    ui.redScore.textContent = `Red ${gm.score.red}`;
    ui.blueScore.textContent = `Blue ${gm.score.blue}`;
    const redCount = s.ships.filter((sh) => sh.team === "red").length;
    const blueCount = s.ships.filter((sh) => sh.team === "blue").length;
    ui.stats.textContent = `Ships: ${s.ships.length} (R:${redCount} B:${blueCount}) Bullets: ${s.bullets.length}`;
    requestAnimationFrame(uiTick);
  }
  requestAnimationFrame(uiTick);
  return { gm, renderer };
}
if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => startApp(document));
  else startApp(document);
}
export {
  startApp
};
//# sourceMappingURL=bundled.js.map
