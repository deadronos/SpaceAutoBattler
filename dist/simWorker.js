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
    if (b.ttl <= 0 || b.x < 0 || b.x >= bounds2.W || b.y < 0 || b.y >= bounds2.H) {
      state2.bullets.splice(i, 1);
    }
  }
  function pruneHits(arr, bounds3) {
    if (!Array.isArray(arr)) return arr;
    return arr.filter((e) => typeof e.x === "number" && typeof e.y === "number" && e.x >= 0 && e.x < bounds3.W && e.y >= 0 && e.y < bounds3.H);
  }
  if (Array.isArray(state2.shieldHits)) state2.shieldHits = pruneHits(state2.shieldHits, bounds2);
  if (Array.isArray(state2.healthHits)) state2.healthHits = pruneHits(state2.healthHits, bounds2);
  if (Array.isArray(state2.explosions)) state2.explosions = pruneHits(state2.explosions, bounds2);
  if (Array.isArray(state2.damageEvents)) state2.damageEvents = pruneHits(state2.damageEvents, bounds2);
  for (const s of state2.ships || []) {
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    const r = typeof s.radius === "number" ? s.radius : 12;
    if (typeof bounds2.W === "number" && bounds2.W > 0) {
      if (s.x < -r) s.x += bounds2.W + r * 2;
      if (s.x > bounds2.W + r) s.x -= bounds2.W + r * 2;
    }
    if (typeof bounds2.H === "number" && bounds2.H > 0) {
      if (s.y < -r) s.y += bounds2.H + r * 2;
      if (s.y > bounds2.H + r) s.y -= bounds2.H + r * 2;
    }
    const speed2 = (s.vx || 0) * (s.vx || 0) + (s.vy || 0) * (s.vy || 0);
    const minSpeed = 0.5;
    if (speed2 > minSpeed * minSpeed) {
      const desired = Math.atan2(s.vy || 0, s.vx || 0);
      if (typeof s.angle !== "number") s.angle = desired;
      else {
        let a = s.angle;
        let da = desired - a;
        while (da < -Math.PI) da += Math.PI * 2;
        while (da > Math.PI) da -= Math.PI * 2;
        const turnRate = typeof s.turnRate === "number" ? s.turnRate : 3;
        const maxTurn = turnRate * dtSeconds;
        if (Math.abs(da) < maxTurn) a = desired;
        else a += Math.sign(da) * maxTurn;
        while (a < -Math.PI) a += Math.PI * 2;
        while (a > Math.PI) a -= Math.PI * 2;
        s.angle = a;
      }
    }
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
          const hitAngle = Math.atan2((b.y || 0) - (s.y || 0), (b.x || 0) - (s.x || 0));
          (state2.shieldHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: absorbed, hitAngle });
          (state2.damageEvents ||= []).push({ id: s.id, type: "shield", amount: absorbed, x: b.x, y: b.y, team: s.team, attackerId: attacker && attacker.id });
          const remaining = (b.damage || 0) - absorbed;
          if (remaining > 0) {
            s.hp -= remaining;
            (state2.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: remaining });
            (state2.damageEvents ||= []).push({ id: s.id, type: "hp", amount: remaining, x: b.x, y: b.y, team: s.team, attackerId: attacker && attacker.id });
          }
          dealtToShield = absorbed;
          dealtToHealth = Math.max(0, (b.damage || 0) - absorbed);
        } else {
          s.hp -= b.damage || 0;
          (state2.healthHits ||= []).push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: b.damage || 0 });
          (state2.damageEvents ||= []).push({ id: s.id, type: "hp", amount: b.damage || 0, x: b.x, y: b.y, team: s.team, attackerId: attacker && attacker.id });
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
            const hpScalar = resolveScalar(progression.hpPercentPerLevel, lvl);
            const shScalar = resolveScalar(progression.shieldPercentPerLevel, lvl);
            const dmgScalar = resolveScalar(progression.dmgPercentPerLevel, lvl);
            const speedScalar = resolveScalar(progression.speedPercentPerLevel, lvl);
            const regenScalar = resolveScalar(progression.regenPercentPerLevel, lvl);
            const hpMul = 1 + hpScalar;
            const shMul = 1 + shScalar;
            const dmgMul = 1 + dmgScalar;
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
            if (typeof speedScalar === "number" && typeof attacker.accel === "number") attacker.accel = attacker.accel * (1 + speedScalar);
            if (typeof regenScalar === "number" && typeof attacker.shieldRegen === "number") attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
          }
        }
        state2.bullets.splice(bi, 1);
        if (s.hp <= 0) {
          if (attacker) {
            attacker.xp = (attacker.xp || 0) + (progression.xpPerKill || 0);
            while ((attacker.xp || 0) >= progression.xpToLevel(attacker.level || 1)) {
              attacker.xp -= progression.xpToLevel(attacker.level || 1);
              attacker.level = (attacker.level || 1) + 1;
              const resolveScalar = (s2, lvl2) => typeof s2 === "function" ? s2(lvl2) : s2 || 0;
              const lvl = attacker.level || 1;
              const hpScalar = resolveScalar(progression.hpPercentPerLevel, lvl);
              const shScalar = resolveScalar(progression.shieldPercentPerLevel, lvl);
              const dmgScalar = resolveScalar(progression.dmgPercentPerLevel, lvl);
              const speedScalar = resolveScalar(progression.speedPercentPerLevel, lvl);
              const regenScalar = resolveScalar(progression.regenPercentPerLevel, lvl);
              const hpMul = 1 + hpScalar;
              const shMul = 1 + shScalar;
              const dmgMul = 1 + dmgScalar;
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
              if (typeof speedScalar === "number" && typeof attacker.accel === "number") attacker.accel = attacker.accel * (1 + speedScalar);
              if (typeof regenScalar === "number" && typeof attacker.shieldRegen === "number") attacker.shieldRegen = attacker.shieldRegen * (1 + regenScalar);
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
  for (const s of state2.ships || []) {
    s.hpPercent = Math.max(0, Math.min(1, (s.hp || 0) / (s.maxHp || 1)));
    s.shieldPercent = typeof s.maxShield === "number" && s.maxShield > 0 ? Math.max(0, Math.min(1, (s.shield || 0) / s.maxShield)) : 0;
  }
  return state2;
}

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

// src/config/entitiesConfig.ts
var ShipConfig = {
  fighter: {
    maxHp: 15,
    armor: 0,
    maxShield: 8,
    shieldRegen: 1,
    dmg: 3,
    damage: 3,
    radius: 12,
    cannons: [{ damage: 3, rate: 3, spread: 0.1, muzzleSpeed: 300, bulletRadius: 1.5, bulletTTL: 1.2 }],
    accel: 150,
    turnRate: 6
  },
  corvette: {
    maxHp: 50,
    armor: 0,
    maxShield: Math.round(50 * 0.6),
    shieldRegen: 0.5,
    dmg: 5,
    damage: 5,
    radius: 20,
    accel: 80,
    turnRate: 3,
    cannons: [{ damage: 6, rate: 1.2, spread: 0.05, muzzleSpeed: 220, bulletRadius: 2, bulletTTL: 2 }]
  },
  frigate: {
    maxHp: 80,
    armor: 1,
    maxShield: Math.round(80 * 0.6),
    shieldRegen: 0.4,
    dmg: 8,
    damage: 8,
    radius: 24,
    cannons: [{ damage: 8, rate: 1, spread: 0.06, muzzleSpeed: 200, bulletRadius: 2.5, bulletTTL: 2.2 }],
    accel: 60,
    turnRate: 2.2
  },
  destroyer: {
    maxHp: 120,
    armor: 2,
    maxShield: Math.round(120 * 0.6),
    shieldRegen: 0.3,
    dmg: 12,
    damage: 12,
    radius: 40,
    cannons: new Array(6).fill(0).map(() => ({ damage: 6, rate: 0.8, spread: 0.08, muzzleSpeed: 240, bulletRadius: 2.5, bulletTTL: 2.4 })),
    accel: 40,
    turnRate: 1.6,
    turrets: [
      { position: [1.2, 0.8], kind: "basic", targeting: "nearest", cooldown: 0.8 },
      { position: [-1.2, 0.8], kind: "basic", targeting: "nearest", cooldown: 0.8 },
      { position: [1.2, -0.8], kind: "basic", targeting: "nearest", cooldown: 0.8 },
      { position: [-1.2, -0.8], kind: "basic", targeting: "nearest", cooldown: 0.8 },
      { position: [0, 1.5], kind: "basic", targeting: "nearest", cooldown: 0.8 },
      { position: [0, -1.5], kind: "basic", targeting: "nearest", cooldown: 0.8 }
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
    cannons: new Array(4).fill(0).map(() => ({ damage: 4, rate: 0.6, spread: 0.12, muzzleSpeed: 180, bulletRadius: 3, bulletTTL: 2.8 })),
    accel: 20,
    turnRate: 0.8,
    carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
    turrets: [
      { position: [2, 1.2], kind: "basic", targeting: "nearest", cooldown: 1 },
      { position: [-2, 1.2], kind: "basic", targeting: "nearest", cooldown: 1 },
      { position: [2, -1.2], kind: "basic", targeting: "nearest", cooldown: 1 },
      { position: [-2, -1.2], kind: "basic", targeting: "nearest", cooldown: 1 }
    ]
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
      const speed = typeof c.muzzleSpeed === "number" ? c.muzzleSpeed : 240;
      const dmg = typeof c.damage === "number" ? c.damage : typeof ship.damage === "number" ? ship.damage : typeof ship.dmg === "number" ? ship.dmg : 3;
      const ttl = typeof c.bulletTTL === "number" ? c.bulletTTL : 2;
      const radius = typeof c.bulletRadius === "number" ? c.bulletRadius : 1.5;
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        createBullet(ship.x || 0, ship.y || 0, vx, vy, ship.team || "red", ship.id || null, dmg, ttl),
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
          turretTarget = (state2.ships || []).find((sh) => sh && sh.id === ship.__ai.targetId) || null;
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
      const spread = 0.05;
      const dir = aimWithSpread(ship, turretTarget, spread);
      const speed = 240;
      const dmg = typeof turret.damage === "number" ? turret.damage : typeof ship.damage === "number" ? ship.damage : 3;
      const ttl = 2;
      const radius = 2;
      const angle = ship.angle || 0;
      const [tx, ty] = turret.position || [0, 0];
      const turretX = (ship.x || 0) + Math.cos(angle) * tx * (ship.radius || 12) - Math.sin(angle) * ty * (ship.radius || 12);
      const turretY = (ship.y || 0) + Math.sin(angle) * tx * (ship.radius || 12) + Math.cos(angle) * ty * (ship.radius || 12);
      const vx = dir.x * speed;
      const vy = dir.y * speed;
      const b = Object.assign(
        createBullet(turretX, turretY, vx, vy, ship.team || "red", ship.id || null, dmg, ttl),
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
  const enemies = (state2.ships || []).filter((sh) => sh && sh.team !== ship.team);
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}
function steerAway(s, tx, ty, accel, dt) {
  const dx = (s.x || 0) - tx;
  const dy = (s.y || 0) - ty;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  s.vx = (s.vx || 0) + nx * accel * dt;
  s.vy = (s.vy || 0) + ny * accel * dt;
}
function applySimpleAI(state2, dt, bounds2 = { W: 800, H: 600 }) {
  if (!state2 || !Array.isArray(state2.ships)) return;
  for (const s of state2.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);
    let target = null;
    if (ai.targetId != null) target = (state2.ships || []).find((sh) => sh && sh.id === ai.targetId) || null;
    if (!target) target = chooseNewTarget(state2, s);
    if (target) ai.targetId = target.id;
    const accel = typeof s.accel === "number" ? s.accel : 100;
    const maxSpeed = 160;
    if (!target) {
      s.vx = (s.vx || 0) + srange(-1, 1) * 8 * dt;
      s.vy = (s.vy || 0) + srange(-1, 1) * 8 * dt;
      ai.state = "idle";
    } else {
      if (ai.decisionTimer <= 0) {
        const hpFrac = (s.hp || 0) / Math.max(1, s.maxHp || 1);
        const rnd = srandom();
        if (hpFrac < 0.35 || rnd < 0.15) ai.state = "evade";
        else if (rnd < 0.85) ai.state = "engage";
        else ai.state = "idle";
        ai.decisionTimer = 0.5 + srandom() * 1.5;
      }
      if (ai.state === "engage") {
        const aim = aimWithSpread(s, target, 0.05);
        s.vx = (s.vx || 0) + aim.x * accel * dt;
        s.vy = (s.vy || 0) + aim.y * accel * dt;
        tryFire(state2, s, target, dt);
      } else if (ai.state === "evade") {
        steerAway(s, target.x || 0, target.y || 0, accel * 0.8, dt);
        const ang = Math.atan2(s.vy || 0, s.vx || 0);
        const perp = ang + Math.PI / 2 * (srandom() < 0.5 ? 1 : -1);
        s.vx = (s.vx || 0) + Math.cos(perp) * accel * 0.2 * dt;
        s.vy = (s.vy || 0) + Math.sin(perp) * accel * 0.2 * dt;
      } else {
        s.vx = (s.vx || 0) + srange(-0.5, 0.5) * 6 * dt;
        s.vy = (s.vy || 0) + srange(-0.5, 0.5) * 6 * dt;
      }
    }
    clampSpeed(s, maxSpeed);
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
