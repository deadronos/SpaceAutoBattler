var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/gamemanager.js
var gamemanager_exports = {};
__export(gamemanager_exports, {
  Particle: () => Particle,
  acquireParticle: () => acquireParticle,
  bullets: () => bullets,
  config: () => config,
  createStarCanvas: () => createStarCanvas,
  default: () => gamemanager_default,
  evaluateReinforcement: () => evaluateReinforcement,
  flashes: () => flashes,
  getManagerConfig: () => getManagerConfig,
  getReinforcementInterval: () => getReinforcementInterval,
  healthFlashes: () => healthFlashes,
  initStars: () => initStars,
  particlePool: () => particlePool,
  particles: () => particles,
  processStateEvents: () => processStateEvents,
  releaseParticle: () => releaseParticle,
  reset: () => reset,
  setManagerConfig: () => setManagerConfig,
  setReinforcementInterval: () => setReinforcementInterval,
  shieldFlashes: () => shieldFlashes,
  ships: () => ships,
  simulate: () => simulate,
  starCanvas: () => starCanvas,
  stars: () => stars
});

// src/rng.js
var _state = null;
function srand(seed) {
  _state = seed >>> 0 || 1;
}
function _next() {
  _state = Math.imul(1664525, _state) + 1013904223 >>> 0;
  return _state;
}
function srandom() {
  if (_state === null) return Math.random();
  const v = _next();
  const result = v / 4294967296;
  return result;
}
function srange(a = 0, b = 1) {
  const r = srandom();
  return a + r * (b - a);
}

// src/entities.js
var _nextId = 1;
var _genId = () => _nextId++;
var Team = { RED: "red", BLUE: "blue" };
function createShip(opts = {}) {
  const id = opts.id == null ? _genId() : opts.id;
  const hpMax = opts.maxHp != null ? opts.maxHp : opts.hp != null ? opts.hp : 50;
  const shieldDefault = Math.round(hpMax * 0.6);
  const ship = {
    id,
    team: opts.team || Team.RED,
    type: opts.type || "corvette",
    x: opts.x || 0,
    y: opts.y || 0,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    hp: opts.hp != null ? opts.hp : hpMax,
    maxHp: hpMax,
    armor: opts.armor != null ? opts.armor : 0,
    shield: opts.shield != null ? opts.shield : shieldDefault,
    maxShield: opts.maxShield != null ? opts.maxShield : shieldDefault,
    shieldRegen: opts.shieldRegen != null ? opts.shieldRegen : 0.5,
    dmg: opts.dmg != null ? opts.dmg : 5,
    radius: opts.radius != null ? opts.radius : 8,
    cannons: opts.cannons || [],
    isCarrier: !!opts.isCarrier,
    alive: true,
    level: opts.level || 1,
    xp: opts.xp || 0
  };
  ship.update = (dt, state) => {
    if (!ship.alive) return;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    if (ship.shield < ship.maxShield) {
      ship.shield = Math.min(ship.maxShield, ship.shield + ship.shieldRegen * dt);
    }
  };
  ship.pickTarget = (ships2) => {
    let best = null;
    let bestDist = Infinity;
    for (const s of ships2) {
      if (!s || s.team === ship.team || !s.alive) continue;
      const dx = s.x - ship.x;
      const dy = s.y - ship.y;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  };
  ship.damage = (amount, source) => {
    const result = { shield: 0, hp: 0, killed: false };
    if (!ship.alive) return result;
    const flat = Math.max(0, ship.armor || 0);
    const afterArmor = Math.max(0, amount - flat);
    const shieldAbsorb = Math.min(ship.shield, afterArmor);
    ship.shield -= shieldAbsorb;
    result.shield = shieldAbsorb;
    const leftover = afterArmor - shieldAbsorb;
    if (leftover > 0) {
      const hpReduce = Math.min(ship.hp, leftover);
      ship.hp -= hpReduce;
      result.hp = hpReduce;
      if (ship.hp <= 0) {
        ship.alive = false;
        result.killed = true;
      }
    }
    return result;
  };
  ship.gainXp = (amount) => {
    ship.xp += amount;
    while (ship.xp >= 100) {
      ship.xp -= 100;
      ship.level += 1;
      ship.maxHp += 10;
      ship.hp = ship.maxHp;
      ship.dmg += 1;
      ship.maxShield += 2;
      ship.shield = ship.maxShield;
    }
  };
  ship.applyLevel = (lvl) => {
    ship.level = lvl;
    ship.maxHp = 50 + (lvl - 1) * 10;
    ship.hp = ship.maxHp;
    ship.dmg = 5 + (lvl - 1) * 1;
    ship.maxShield = 10 + (lvl - 1) * 2;
    ship.shield = ship.maxShield;
  };
  return ship;
}
function createBullet(opts = {}) {
  const id = opts.id == null ? _genId() : opts.id;
  const bullet = {
    id,
    x: opts.x || 0,
    y: opts.y || 0,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    dmg: opts.dmg != null ? opts.dmg : 6,
    team: opts.team || "red",
    ownerId: opts.ownerId || null,
    ttl: opts.ttl != null ? opts.ttl : 2,
    radius: opts.radius != null ? opts.radius : 2
  };
  bullet.update = (dt) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.ttl -= dt;
  };
  bullet.alive = (bounds) => {
    if (bullet.ttl <= 0) return false;
    if (!bounds) return true;
    if (bullet.x < 0 || bullet.x > bounds.W || bullet.y < 0 || bullet.y > bounds.H) return false;
    return true;
  };
  return bullet;
}

// src/simulate.js
function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.radius || 0) + (b.radius || 0);
  return dx * dx + dy * dy <= r * r;
}
function simulateStep(state, dt, bounds) {
  if (!dt || dt <= 0) return;
  state.explosions = state.explosions || [];
  state.shieldHits = state.shieldHits || [];
  state.healthHits = state.healthHits || [];
  if (!state.stars) {
    state.stars = [];
  }
  for (let i = 0; i < state.stars.length; i++) {
    const star = state.stars[i];
    star.a = srange(0.1, 1);
  }
  for (let i = 0; i < state.ships.length; i++) {
    const s = state.ships[i];
    if (s.update) s.update(dt, state);
    if (bounds) {
      if (s.x < 0) s.x += bounds.W;
      else if (s.x > bounds.W) s.x -= bounds.W;
      if (s.y < 0) s.y += bounds.H;
      else if (s.y > bounds.H) s.y -= bounds.H;
    }
    if (s.cannons && s.cannons.length && Math.random() < 0.01) {
      const c = s.cannons[0];
      const angle = srange(0, Math.PI * 2);
      const speed = 200;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const b = createBullet({ x: s.x, y: s.y, vx, vy, team: s.team, dmg: c.damage || s.dmg, ownerId: s.id });
      state.bullets.push(b);
    }
  }
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const bullet = state.bullets[bi];
    if (bullet.update) bullet.update(dt);
    if (!bullet.alive(bounds)) {
      state.bullets.splice(bi, 1);
      continue;
    }
    for (let si = state.ships.length - 1; si >= 0; si--) {
      const ship = state.ships[si];
      if (!ship.alive || ship.team === bullet.team) continue;
      if (collides(bullet, ship)) {
        const hit = ship.damage(bullet.dmg, bullet);
        if (hit.shield) state.shieldHits.push({ id: ship.id, hitX: bullet.x, hitY: bullet.y, team: ship.team, amount: hit.shield });
        if (hit.hp) state.healthHits.push({ id: ship.id, hitX: bullet.x, hitY: bullet.y, team: ship.team, amount: hit.hp });
        if (bullet.ownerId != null) {
          const owner = state.ships.find((s) => s.id === bullet.ownerId);
          if (owner && owner.gainXp) owner.gainXp(hit.shield + hit.hp);
        }
        state.bullets.splice(bi, 1);
        if (!ship.alive) {
          state.explosions.push({ x: ship.x, y: ship.y, team: ship.team });
          state.ships.splice(si, 1);
        }
        break;
      }
    }
  }
}

// src/gamemanager.js
var ships = [];
var bullets = [];
var particles = [];
var stars = [];
var starCanvas = null;
var flashes = [];
var shieldFlashes = [];
var healthFlashes = [];
var particlePool = [];
var config = {
  shield: { ttl: 0.4, particleCount: 6, particleTTL: 0.35, particleColor: "rgba(160,200,255,0.9)", particleSize: 2 },
  health: { ttl: 0.75, particleCount: 8, particleTTL: 0.6, particleColor: "rgba(255,120,80,0.95)", particleSize: 2 }
};
config.stars = {
  twinkle: false,
  redrawInterval: 0.35
  // seconds between canvas redraws when twinkling
};
function setManagerConfig(newCfg = {}) {
  for (const k of Object.keys(newCfg)) {
    if (config[k]) Object.assign(config[k], newCfg[k]);
  }
}
function getManagerConfig() {
  return config;
}
var Particle = class {
  constructor(x = 0, y = 0, vx = 0, vy = 0, ttl = 1, color = "#fff", size = 2) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ttl = ttl;
    this.life = ttl;
    this.color = color;
    this.size = size;
    this.alive = true;
  }
};
function acquireParticle(x, y, opts = {}) {
  let p = null;
  if (particlePool.length) {
    p = particlePool.pop();
    p.x = x;
    p.y = y;
    p.vx = opts.vx || 0;
    p.vy = opts.vy || 0;
    p.ttl = opts.ttl || 1;
    p.life = p.ttl;
    p.color = opts.color || "#fff";
    p.size = opts.size || 2;
    p.alive = true;
  } else {
    p = new Particle(x, y, opts.vx || 0, opts.vy || 0, opts.ttl || 1, opts.color || "#fff", opts.size || 2);
  }
  particles.push(p);
  return p;
}
function releaseParticle(p) {
  const i = particles.indexOf(p);
  if (i !== -1) particles.splice(i, 1);
  p.alive = false;
  particlePool.push(p);
}
var _seed = null;
var _reinforcementInterval = 5;
var _reinforcementAccumulator = 0;
var _starTime = 0;
var _starCanvasVersion = 0;
function reset(seedValue = null) {
  ships.length = 0;
  bullets.length = 0;
  particles.length = 0;
  stars.length = 0;
  flashes.length = 0;
  shieldFlashes.length = 0;
  healthFlashes.length = 0;
  _reinforcementAccumulator = 0;
  if (typeof seedValue === "number") {
    _seed = seedValue >>> 0;
    srand(_seed);
  }
  try {
    initStars({ stars }, 800, 600, 140);
  } catch (e) {
  }
  try {
    if (!config.stars || !config.stars.twinkle) createStarCanvas({ stars }, 800, 600);
  } catch (e) {
  }
}
function initStars(state, W = 800, H = 600, count = 140) {
  if (!state || typeof state !== "object" || !Array.isArray(state.stars)) {
    throw new Error("initStars(state, W, H, count) requires a state object with a `stars` array");
  }
  state.stars.length = 0;
  for (let i = 0; i < count; i++) {
    const x = srandom() * W;
    const y = srandom() * H;
    const r = 0.3 + srandom() * 1.3;
    const a = 0.3 + srandom() * 0.7;
    const twPhase = srandom() * Math.PI * 2;
    const twSpeed = 0.5 + srandom() * 1.5;
    const baseA = a;
    const star = { x, y, r, a: baseA, baseA, twPhase, twSpeed };
    state.stars.push(star);
  }
}
function createStarCanvas(stateOrW = 800, maybeW = 800, maybeH = 600, bg = "#041018") {
  let state = null;
  let W = 800, H = 600;
  if (stateOrW && typeof stateOrW === "object" && Array.isArray(stateOrW.stars)) {
    state = stateOrW;
    W = typeof maybeW === "number" ? maybeW : 800;
    H = typeof maybeH === "number" ? maybeH : 600;
  } else {
    W = stateOrW || 800;
    H = maybeW || 600;
  }
  try {
    const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!c) {
      starCanvas = null;
      return null;
    }
    c.width = Math.max(1, Math.floor(W));
    c.height = Math.max(1, Math.floor(H));
    const ctx = c.getContext && c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      const drawStars = state && state.stars ? state.stars : stars;
      for (const s of drawStars) {
        const alpha = Math.max(0, Math.min(1, s.a != null ? s.a : s.baseA != null ? s.baseA : 1));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        const r = Math.max(0.2, s.r || 0.5);
        ctx.arc(s.x || 0, s.y || 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const Wpx = c.width, Hpx = c.height;
      const data = new Uint8ClampedArray(Wpx * Hpx * 4);
      if (data.length >= 4) {
        data[0] = 255;
        data[1] = 255;
        data[2] = 255;
        data[3] = 255;
      }
      const stubCtx = {
        getImageData: (x, y, w, h) => ({ data }),
        // no-op drawing methods
        fillRect: () => {
        },
        beginPath: () => {
        },
        arc: () => {
        },
        fill: () => {
        },
        set fillStyle(v) {
        },
        get fillStyle() {
          return "#000";
        }
      };
      c.getContext = () => stubCtx;
    }
    try {
      _starCanvasVersion = (_starCanvasVersion || 0) + 1;
    } catch (e) {
    }
    c._version = _starCanvasVersion;
    starCanvas = c;
    return c;
  } catch (e) {
    starCanvas = null;
    return null;
  }
}
function simulate(dt, W = 800, H = 600) {
  const state = { ships, bullets, particles, stars, explosions: [], shieldHits: [], healthHits: [] };
  evaluateReinforcement(dt);
  simulateStep(state, dt, { W, H });
  flashes.push(...state.explosions);
  for (const h of state.shieldHits) {
    shieldFlashes.push(Object.assign({}, h, { ttl: config.shield.ttl, life: config.shield.ttl, spawned: false }));
  }
  for (const h of state.healthHits) {
    healthFlashes.push(Object.assign({}, h, { ttl: config.health.ttl, life: config.health.ttl, spawned: false }));
  }
  try {
    _starTime += dt;
    if (config.stars && config.stars.twinkle) {
      for (const s of stars) {
        const base = s.baseA != null ? s.baseA : s.a != null ? s.a : 1;
        const phase = s.twPhase != null ? s.twPhase : 0;
        const speed = s.twSpeed != null ? s.twSpeed : 1;
        s.a = base * (0.7 + 0.3 * Math.sin(phase + _starTime * speed));
      }
    }
  } catch (e) {
  }
  return { ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars, starCanvas };
}
function processStateEvents(state, dt = 0) {
  return state;
}
function evaluateReinforcement(dt) {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    ships.push(createShip({ x: 100, y: 100, team: "red" }));
    ships.push(createShip({ x: 700, y: 500, team: "blue" }));
  }
}
function setReinforcementInterval(seconds) {
  _reinforcementInterval = seconds;
}
function getReinforcementInterval() {
  return _reinforcementInterval;
}
var gamemanager_default = { reset, simulate, processStateEvents, evaluateReinforcement, ships, bullets };

// src/renderer.js
function createCanvasRenderer(canvas2) {
  const ctx = canvas2.getContext("2d");
  let _running = false;
  let _last = null;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(canvas2.clientWidth * dpr);
    const h = Math.floor(canvas2.clientHeight * dpr);
    if (canvas2.width !== w || canvas2.height !== h) {
      canvas2.width = w;
      canvas2.height = h;
    }
  }
  function doRender(t) {
    const now = t / 1e3;
    const dt = _last ? Math.min(0.05, now - _last) : 1 / 60;
    _last = now;
    resize();
    const W = canvas2.width;
    const H = canvas2.height;
    const state = simulate(dt, W, H);
    ctx.clearRect(0, 0, canvas2.width, canvas2.height);
    if (state.starCanvas) {
      try {
        ctx.drawImage(state.starCanvas, 0, 0, canvas2.width, canvas2.height);
      } catch (e) {
        ctx.fillStyle = "#041018";
        ctx.fillRect(0, 0, canvas2.width, canvas2.height);
        if (state.stars && state.stars.length) {
          for (const s of state.stars) {
            ctx.globalAlpha = s.a != null ? s.a : 1;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r || 1, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
    } else {
      if (state.stars && state.stars.length) {
        ctx.fillStyle = "#041018";
        ctx.fillRect(0, 0, canvas2.width, canvas2.height);
        for (const s of state.stars) {
          ctx.globalAlpha = s.a != null ? s.a : 1;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r || 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#081018";
        ctx.fillRect(0, 0, canvas2.width, canvas2.height);
      }
    }
    for (const s of state.ships) {
      ctx.beginPath();
      ctx.fillStyle = s.team === "red" ? "#ff8080" : "#80b8ff";
      ctx.arc(s.x, s.y, s.radius || 8, 0, Math.PI * 2);
      ctx.fill();
      if (s.shield > 0) {
        ctx.strokeStyle = "rgba(160,200,255,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max((s.radius || 8) + 3, (s.radius || 8) * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const b of state.bullets) {
      ctx.fillStyle = "#ffd080";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius || 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = shieldFlashes.length - 1; i >= 0; i--) {
      const ev = shieldFlashes[i];
      if (!ev.spawned) {
        ev.spawned = true;
        const pc = config.shield.particleCount || 6;
        for (let j = 0; j < pc; j++) {
          const a = j / pc * Math.PI * 2;
          const speed = 30 + j * 6;
          acquireParticle(ev.hitX, ev.hitY, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ttl: config.shield.particleTTL, color: config.shield.particleColor, size: config.shield.particleSize });
        }
      }
      const t2 = Math.max(0, Math.min(1, ev.life / ev.ttl));
      const radius = (ev.radius || 8) * (1 + (1 - t2) * 1.5);
      ctx.strokeStyle = `rgba(160,200,255,${0.6 * t2})`;
      ctx.lineWidth = 2 * t2;
      ctx.beginPath();
      ctx.arc(ev.hitX, ev.hitY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ev.life -= dt;
      if (ev.life <= 0) shieldFlashes.splice(i, 1);
    }
    for (let i = healthFlashes.length - 1; i >= 0; i--) {
      const ev = healthFlashes[i];
      if (!ev.spawned) {
        ev.spawned = true;
        const pc = config.health.particleCount || 8;
        for (let j = 0; j < pc; j++) {
          const a = srandom() * Math.PI * 2;
          const speed = 40 * srandom();
          acquireParticle(ev.hitX, ev.hitY, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ttl: config.health.particleTTL, color: config.health.particleColor, size: config.health.particleSize + srandom() * 2 });
        }
      }
      const t2 = Math.max(0, Math.min(1, ev.life / ev.ttl));
      const radius = (ev.radius || 8) * (1 + (1 - t2) * 2);
      ctx.strokeStyle = `rgba(255,120,80,${0.7 * t2})`;
      ctx.lineWidth = 2 * t2;
      ctx.beginPath();
      ctx.arc(ev.hitX, ev.hitY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ev.life -= dt;
      if (ev.life <= 0) healthFlashes.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        releaseParticle(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const alpha = Math.max(0, p.life / p.ttl);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function renderFrame(t) {
    if (!_running) return;
    doRender(t);
    requestAnimationFrame(renderFrame);
  }
  function renderOnce(nowMs = performance.now()) {
    doRender(nowMs);
  }
  return {
    init() {
      resize();
      return true;
    },
    start() {
      if (!_running) {
        _running = true;
        _last = null;
        requestAnimationFrame(renderFrame);
      }
    },
    stop() {
      _running = false;
    },
    isRunning() {
      return _running;
    },
    render() {
    },
    renderOnce,
    destroy() {
      this.stop();
    }
  };
}

// src/webglRenderer.js
function createWebGLRenderer(canvas2, opts = {}) {
  const cfg = Object.assign({ webgl2: true, maxDevicePixelRatio: 1.5, maxUploadsPerFrame: 2, atlasUseMipmaps: false, atlasMaxSize: 2048, debug: true }, opts);
  let gl = null;
  let isWebGL2 = false;
  try {
    const ctxAttrs = {
      antialias: true,
      alpha: opts && typeof opts.alpha === "boolean" ? opts.alpha : false,
      preserveDrawingBuffer: opts && typeof opts.preserveDrawingBuffer === "boolean" ? opts.preserveDrawingBuffer : true,
      premultipliedAlpha: true
    };
    if (cfg.webgl2) {
      gl = canvas2.getContext("webgl2", ctxAttrs);
      isWebGL2 = !!gl;
    }
    if (!gl) {
      gl = canvas2.getContext("webgl", ctxAttrs) || canvas2.getContext("experimental-webgl", ctxAttrs);
      isWebGL2 = false;
    }
  } catch (e) {
    gl = null;
  }
  if (!gl) return null;
  const diag = {
    _batchVBOCapacity: 0,
    _instanceVBOCapacity: 0,
    _uploadsThisFrame: 0,
    _diagCounter: 0
  };
  const resources = {
    textures: /* @__PURE__ */ new Map(),
    quadVBO: null,
    fullscreenQuadVBO: null,
    instanceVBO: null,
    programInstanced: null,
    programSimple: null,
    vao: null
  };
  const programLocations = /* @__PURE__ */ new Map();
  let _lastW = 0;
  let _lastH = 0;
  let _running = false;
  let _starBuffer = null;
  let _starCapacity = 0;
  let _starUsed = 0;
  let _shipBuffer = null;
  let _shipCapacity = 0;
  let _shipUsed = 0;
  let _bulletBuffer = null;
  let _bulletCapacity = 0;
  let _bulletUsed = 0;
  let _particleBuffer = null;
  let _particleCapacity = 0;
  let _particleUsed = 0;
  const _pendingAtlasUploads = [];
  function debugLog(...args) {
    if (typeof console !== "undefined" && console.log) console.log("[webgl-debug]", ...args);
  }
  function checkGLError(where) {
    try {
      const err = gl.getError();
      if (err !== gl.NO_ERROR) debugLog("GL error at", where, err);
    } catch (e) {
    }
  }
  function dumpProgramInfo(program) {
    try {
      const nattrib = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
      debugLog("Active attributes:", nattrib);
      for (let i = 0; i < nattrib; i++) {
        const a = gl.getActiveAttrib(program, i);
        debugLog("  attrib", i, a.name, a.size, a.type, "loc", gl.getAttribLocation(program, a.name));
      }
      const nunif = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      debugLog("Active uniforms:", nunif);
      for (let i = 0; i < nunif; i++) {
        const u = gl.getActiveUniform(program, i);
        debugLog("  uniform", i, u.name, u.size, u.type, "loc", gl.getUniformLocation(program, u.name));
      }
    } catch (e) {
    }
  }
  const fsInstanced = `#version 300 es
  precision mediump float;
  in vec2 v_uv;
  in vec4 v_color;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform int u_useTex;
  void main() {
    if (u_useTex == 1) {
      vec4 t = texture(u_tex, v_uv);
      outColor = t * v_color;
    } else {
      // simple circular mask in fragment
      vec2 d = v_uv - vec2(0.5);
      float r = length(d);
  float alpha = 1.0 - smoothstep(0.48, 0.5, r);
  outColor = vec4(v_color.rgb, v_color.a * alpha);
    }
  }
`;
  const vsInstanced = `#version 300 es
  precision mediump float;
  layout(location=0) in vec2 a_quadPos;
  layout(location=1) in vec2 a_pos;
  layout(location=2) in float a_scale;
  layout(location=3) in float a_angle;
  layout(location=4) in vec4 a_color;
  out vec2 v_uv;
  out vec4 v_color;
  uniform vec2 u_resolution;
  void main() {
    float c = cos(a_angle);
    float s = sin(a_angle);
    vec2 p = vec2(a_quadPos.x * a_scale, a_quadPos.y * a_scale);
    vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec2 screen = (a_pos + rp);
    vec2 ndc = (screen / u_resolution) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_quadPos + 0.5;
    v_color = a_color;
  }
`;
  const vsSimple = `precision mediump float;
  attribute vec2 a_pos;
  attribute vec2 a_quadPos;
  attribute float a_scale;
  attribute float a_angle;
  attribute vec4 a_color;
  varying vec2 v_uv;
  varying vec4 v_color;
  uniform vec2 u_resolution;
  void main() {
    float c = cos(a_angle);
    float s = sin(a_angle);
    vec2 p = vec2(a_quadPos.x * a_scale, a_quadPos.y * a_scale);
    vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec2 screen = (a_pos + rp);
    vec2 ndc = (screen / u_resolution) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);
    v_uv = a_quadPos + 0.5;
    v_color = a_color;
  }
`;
  const fsSimple = `precision mediump float;
  varying vec2 v_uv;
  varying vec4 v_color;
  uniform sampler2D u_tex;
  uniform int u_useTex;
  void main() {
    if (u_useTex == 1) {
      vec4 t = texture2D(u_tex, v_uv);
      gl_FragColor = t * v_color;
    } else {
      vec2 d = v_uv - vec2(0.5);
      float r = length(d);
  float alpha = 1.0 - smoothstep(0.48, 0.5, r);
  gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
    }
  }
`;
  function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      debugLog("Shader compile failed", info, "\n", src.substring(0, 200));
      gl.deleteShader(s);
      throw new Error("Shader compile failed: " + info);
    }
    return s;
  }
  function linkProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    if (isWebGL2) {
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      debugLog("Program link failed", info);
      gl.deleteProgram(p);
      throw new Error("Program link failed: " + info);
    }
    return p;
  }
  function initPrograms() {
    if (isWebGL2) {
      const vs = compileShader(vsInstanced, gl.VERTEX_SHADER);
      const fs = compileShader(fsInstanced, gl.FRAGMENT_SHADER);
      resources.programInstanced = linkProgram(vs, fs);
      try {
        dumpProgramInfo(resources.programInstanced);
      } catch (e) {
      }
      try {
        const map = { uniforms: {}, attribs: {} };
        map.uniforms.u_resolution = gl.getUniformLocation(resources.programInstanced, "u_resolution");
        map.uniforms.u_tex = gl.getUniformLocation(resources.programInstanced, "u_tex");
        map.uniforms.u_useTex = gl.getUniformLocation(resources.programInstanced, "u_useTex");
        map.attribs.a_quadPos = gl.getAttribLocation(resources.programInstanced, "a_quadPos");
        map.attribs.a_pos = gl.getAttribLocation(resources.programInstanced, "a_pos");
        map.attribs.a_scale = gl.getAttribLocation(resources.programInstanced, "a_scale");
        map.attribs.a_angle = gl.getAttribLocation(resources.programInstanced, "a_angle");
        map.attribs.a_color = gl.getAttribLocation(resources.programInstanced, "a_color");
        programLocations.set(resources.programInstanced, map);
      } catch (e) {
      }
    }
    const vs2 = compileShader(isWebGL2 ? vsInstanced : vsSimple, gl.VERTEX_SHADER);
    const fs2 = compileShader(isWebGL2 ? fsInstanced : fsSimple, gl.FRAGMENT_SHADER);
    resources.programSimple = linkProgram(vs2, fs2);
    try {
      dumpProgramInfo(resources.programSimple);
    } catch (e) {
    }
    try {
      const map2 = { uniforms: {}, attribs: {} };
      map2.uniforms.u_resolution = gl.getUniformLocation(resources.programSimple, "u_resolution");
      map2.uniforms.u_tex = gl.getUniformLocation(resources.programSimple, "u_tex");
      map2.uniforms.u_useTex = gl.getUniformLocation(resources.programSimple, "u_useTex");
      map2.attribs.a_quadPos = gl.getAttribLocation(resources.programSimple, "a_quadPos");
      map2.attribs.a_pos = gl.getAttribLocation(resources.programSimple, "a_pos");
      map2.attribs.a_scale = gl.getAttribLocation(resources.programSimple, "a_scale");
      map2.attribs.a_angle = gl.getAttribLocation(resources.programSimple, "a_angle");
      map2.attribs.a_color = gl.getAttribLocation(resources.programSimple, "a_color");
      programLocations.set(resources.programSimple, map2);
    } catch (e) {
    }
  }
  function initBuffers() {
    const quadVerts = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    resources.quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    resources.instanceVBO = gl.createBuffer();
    resources.instanceVBO._size = 0;
    resources.starInstanceVBO = gl.createBuffer();
    resources.starInstanceVBO._size = 0;
    resources.shipInstanceVBO = gl.createBuffer();
    resources.shipInstanceVBO._size = 0;
    resources.bulletInstanceVBO = gl.createBuffer();
    resources.particleInstanceVBO = gl.createBuffer();
    resources.bulletInstanceVBO._size = 0;
    resources.particleInstanceVBO._size = 0;
    if (isWebGL2 && gl.createVertexArray) {
      try {
        resources.vao = gl.createVertexArray();
      } catch (e) {
        resources.vao = null;
      }
    }
    diag._batchVBOCapacity = 0;
  }
  function parseColor(str) {
    if (!str) return [1, 1, 1, 1];
    if (Array.isArray(str) && str.length >= 3) return [str[0], str[1], str[2], str[3] != null ? str[3] : 1];
    str = String(str).trim();
    if (str[0] === "#") {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
      const num = parseInt(hex, 16);
      if (Number.isNaN(num)) return [1, 1, 1, 1];
      return [(num >> 16 & 255) / 255, (num >> 8 & 255) / 255, (num & 255) / 255, 1];
    }
    const m = str.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(",").map((s) => parseFloat(s));
      const r = parts[0] != null ? parts[0] : 255;
      const g = parts[1] != null ? parts[1] : 255;
      const b = parts[2] != null ? parts[2] : 255;
      const a = parts[3] != null ? parts[3] : 1;
      const norm = (v) => v > 1 ? v / 255 : v;
      return [norm(r), norm(g), norm(b), a];
    }
    return [1, 1, 1, 1];
  }
  function resizeIfNeeded() {
    const dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDevicePixelRatio || 1.5);
    const clientW = Math.max(1, Math.floor(canvas2.clientWidth));
    const clientH = Math.max(1, Math.floor(canvas2.clientHeight));
    const newW = Math.floor(clientW * dpr);
    const newH = Math.floor(clientH * dpr);
    if (newW !== _lastW || newH !== _lastH) {
      canvas2.width = newW;
      canvas2.height = newH;
      gl.viewport(0, 0, newW, newH);
      _lastW = newW;
      _lastH = newH;
    }
  }
  function usePremultipliedAlpha() {
    try {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    } catch (e) {
    }
    gl.enable(gl.BLEND);
    try {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } catch (e) {
      try {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } catch (ee) {
      }
    }
  }
  function queueAtlasUpload(key, atlas) {
    _pendingAtlasUploads.push({ key, atlas });
  }
  function processAtlasUploads(limit) {
    diag._uploadsThisFrame = 0;
    while (_pendingAtlasUploads.length && diag._uploadsThisFrame < limit) {
      const item = _pendingAtlasUploads.shift();
      const { key, atlas } = item;
      try {
        let canvasSrc = atlas.canvas;
        let size = atlas.size;
        if (cfg.atlasMaxSize && size > cfg.atlasMaxSize) {
          const scale = cfg.atlasMaxSize / size;
          const tmp = document.createElement("canvas");
          tmp.width = Math.max(1, Math.floor(canvasSrc.width * scale));
          tmp.height = Math.max(1, Math.floor(canvasSrc.height * scale));
          const tctx = tmp.getContext("2d");
          tctx.drawImage(canvasSrc, 0, 0, tmp.width, tmp.height);
          canvasSrc = tmp;
          size = cfg.atlasMaxSize;
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasSrc);
        if (cfg.atlasUseMipmaps && isPowerOfTwo(canvasSrc.width) && isPowerOfTwo(canvasSrc.height)) {
          gl.generateMipmap(gl.TEXTURE_2D);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        resources.textures.set(key, { tex, size: atlas.size, baseRadius: atlas.baseRadius, canvas: atlas.canvas });
        diag._uploadsThisFrame++;
      } catch (e) {
        console.warn("atlas upload failed", e);
      }
    }
  }
  function queueStarfieldUpload(canvasSrc) {
    if (!canvasSrc) return;
    const key = "__starfield";
    queueAtlasUpload(key, { canvas: canvasSrc, size: Math.max(canvasSrc.width, canvasSrc.height), baseRadius: 0 });
  }
  function isPowerOfTwo(v) {
    return (v & v - 1) === 0;
  }
  function initGL() {
    usePremultipliedAlpha();
    initPrograms();
    initBuffers();
  }
  function setupAttributePointers(program) {
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    const locQuad = gl.getAttribLocation(program, "a_quadPos");
    if (locQuad >= 0) {
      gl.enableVertexAttribArray(locQuad);
      gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 0, 0);
    }
  }
  function render(state = {}) {
    diag._diagCounter++;
    resizeIfNeeded();
    processAtlasUploads(cfg.maxUploadsPerFrame || 2);
    const W = state.W || canvas2.clientWidth;
    const H = state.H || canvas2.clientHeight;
    const ships2 = state.ships || [];
    const n = ships2.length;
    const stars2 = state.stars || [];
    const sn = stars2.length;
    const elemsPer = 8;
    const bullets2 = state.bullets || [];
    const bn = bullets2.length;
    const particles2 = state.particles || [];
    const pn = particles2.length;
    const starElems = sn * elemsPer;
    const shipElems = n * elemsPer;
    const bulletElems = bn * elemsPer;
    const particleElems = pn * elemsPer;
    if (_starCapacity < starElems) {
      let cap = Math.max(4 * elemsPer, _starCapacity || 0);
      if (cap < 1) cap = elemsPer * 4;
      while (cap < starElems) cap *= 2;
      _starCapacity = cap;
      _starBuffer = new Float32Array(_starCapacity);
    }
    _starUsed = starElems;
    for (let i = 0; i < sn; i++) {
      const s = stars2[i];
      const base = i * elemsPer;
      _starBuffer[base + 0] = s.x || 0;
      _starBuffer[base + 1] = s.y || 0;
      _starBuffer[base + 2] = s.r != null ? s.r : 1;
      _starBuffer[base + 3] = 0;
      const a = s.a != null ? s.a : 1;
      _starBuffer[base + 4] = 1;
      _starBuffer[base + 5] = 1;
      _starBuffer[base + 6] = 1;
      _starBuffer[base + 7] = a;
    }
    if (_shipCapacity < shipElems) {
      let cap = Math.max(4 * elemsPer, _shipCapacity || 0);
      if (cap < 1) cap = elemsPer * 4;
      while (cap < shipElems) cap *= 2;
      _shipCapacity = cap;
      _shipBuffer = new Float32Array(_shipCapacity);
    }
    _shipUsed = shipElems;
    for (let i = 0; i < n; i++) {
      const s = ships2[i];
      const base = i * elemsPer;
      _shipBuffer[base + 0] = s.x || 0;
      _shipBuffer[base + 1] = s.y || 0;
      _shipBuffer[base + 2] = s.radius != null ? s.radius : 8;
      _shipBuffer[base + 3] = s.angle != null ? s.angle : 0;
      const color = teamToColor(s.team);
      _shipBuffer[base + 4] = color[0];
      _shipBuffer[base + 5] = color[1];
      _shipBuffer[base + 6] = color[2];
      _shipBuffer[base + 7] = color[3];
    }
    if (_bulletCapacity < bulletElems) {
      let cap = Math.max(4 * elemsPer, _bulletCapacity || 0);
      if (cap < 1) cap = elemsPer * 4;
      while (cap < bulletElems) cap *= 2;
      _bulletCapacity = cap;
      _bulletBuffer = new Float32Array(_bulletCapacity);
    }
    _bulletUsed = bulletElems;
    for (let i = 0; i < bn; i++) {
      const b = bullets2[i];
      const base = i * elemsPer;
      _bulletBuffer[base + 0] = b.x || 0;
      _bulletBuffer[base + 1] = b.y || 0;
      _bulletBuffer[base + 2] = b.radius != null ? b.radius : 2;
      _bulletBuffer[base + 3] = 0;
      _bulletBuffer[base + 4] = 1;
      _bulletBuffer[base + 5] = 0.85;
      _bulletBuffer[base + 6] = 0.5;
      _bulletBuffer[base + 7] = 1;
    }
    if (_particleCapacity < particleElems) {
      let cap = Math.max(4 * elemsPer, _particleCapacity || 0);
      if (cap < 1) cap = elemsPer * 4;
      while (cap < particleElems) cap *= 2;
      _particleCapacity = cap;
      _particleBuffer = new Float32Array(_particleCapacity);
    }
    _particleUsed = particleElems;
    for (let i = 0; i < pn; i++) {
      const p = particles2[i];
      const base = i * elemsPer;
      _particleBuffer[base + 0] = p.x || 0;
      _particleBuffer[base + 1] = p.y || 0;
      _particleBuffer[base + 2] = p.size != null ? p.size : 1;
      _particleBuffer[base + 3] = 0;
      const col = parseColor(p.color || "#ffffff");
      _particleBuffer[base + 4] = col[0];
      _particleBuffer[base + 5] = col[1];
      _particleBuffer[base + 6] = col[2];
      _particleBuffer[base + 7] = Math.max(0.2, col[3]);
    }
    const totalElems = starElems + shipElems + bulletElems + particleElems;
    if (totalElems === 0) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      return;
    }
    const BYTES = Float32Array.BYTES_PER_ELEMENT || 4;
    function ensureVBO(vbo, usedElems, usedBuffer) {
      try {
        const usedBytes = usedElems * BYTES;
        const srcByteLen = usedBuffer && usedBuffer.byteLength ? Math.min(usedBytes, usedBuffer.byteLength) : usedBytes;
        if (!vbo._size) vbo._size = 0;
        if (vbo._size < srcByteLen) {
          let alloc = Math.max(vbo._size || 1, 1);
          while (alloc < srcByteLen) alloc *= 2;
          try {
            gl.bufferData(gl.ARRAY_BUFFER, alloc, gl.DYNAMIC_DRAW);
            vbo._size = alloc;
          } catch (e) {
            try {
              gl.bufferData(gl.ARRAY_BUFFER, srcByteLen, gl.DYNAMIC_DRAW);
              vbo._size = srcByteLen;
            } catch (ee) {
            }
          }
        }
        if (usedElems > 0 && usedBuffer) {
          const view = usedBuffer.subarray(0, usedElems);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
        }
        try {
          diag._instanceVBOCapacity = Math.max(diag._instanceVBOCapacity || 0, vbo._size || 0);
        } catch (e) {
        }
      } catch (e) {
      }
    }
    function safeDrawInstanced(boundVBO, vertsPerInstance, instanceCount, elemsPerInstance) {
      try {
        if (!boundVBO) return;
        const strideBytes = elemsPerInstance * BYTES;
        const requiredBytes = instanceCount * strideBytes;
        const vboSize = boundVBO._size || 0;
        if (vboSize >= requiredBytes) {
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, instanceCount);
          return;
        }
        try {
          let alloc = Math.max(vboSize || 1, 1);
          while (alloc < requiredBytes) alloc *= 2;
          gl.bufferData(gl.ARRAY_BUFFER, alloc, gl.DYNAMIC_DRAW);
          boundVBO._size = alloc;
        } catch (e) {
        }
        const finalSize = boundVBO._size || 0;
        if (finalSize >= requiredBytes) {
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, instanceCount);
          return;
        }
        const maxInstances = Math.max(1, Math.floor(finalSize / strideBytes));
        if (maxInstances <= 0) {
          debugLog("safeDrawInstanced: VBO too small for even one instance", finalSize, strideBytes);
          return;
        }
        let offsetInstances = 0;
        while (offsetInstances < instanceCount) {
          const chunk = Math.min(maxInstances, instanceCount - offsetInstances);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, chunk);
          offsetInstances += chunk;
        }
      } catch (e) {
        try {
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, vertsPerInstance, instanceCount);
        } catch (ee) {
        }
      }
    }
    if (cfg.debug) {
      try {
        if (_starBuffer && _starUsed > _starBuffer.length) debugLog("star buffer used exceeds capacity", _starUsed, _starBuffer.length);
        if (_shipBuffer && _shipUsed > _shipBuffer.length) debugLog("ship buffer used exceeds capacity", _shipUsed, _shipBuffer.length);
        if (_bulletBuffer && _bulletUsed > _bulletBuffer.length) debugLog("bullet buffer used exceeds capacity", _bulletUsed, _bulletBuffer.length);
        if (_particleBuffer && _particleUsed > _particleBuffer.length) debugLog("particle buffer used exceeds capacity", _particleUsed, _particleBuffer.length);
      } catch (e) {
      }
    }
    if (_starUsed > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.starInstanceVBO);
      ensureVBO(resources.starInstanceVBO, _starUsed, _starBuffer);
    }
    if (_shipUsed > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.shipInstanceVBO);
      ensureVBO(resources.shipInstanceVBO, _shipUsed, _shipBuffer);
    }
    if (_bulletUsed > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.bulletInstanceVBO);
      ensureVBO(resources.bulletInstanceVBO, _bulletUsed, _bulletBuffer);
    }
    if (_particleUsed > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.particleInstanceVBO);
      ensureVBO(resources.particleInstanceVBO, _particleUsed, _particleBuffer);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const useInstanced = isWebGL2 && resources.programInstanced;
    const program = useInstanced ? resources.programInstanced : resources.programSimple;
    gl.useProgram(program);
    const locs = programLocations.get(program) || null;
    const uresLoc = locs && locs.uniforms && locs.uniforms.u_resolution ? locs.uniforms.u_resolution : gl.getUniformLocation(program, "u_resolution");
    if (uresLoc) gl.uniform2f(uresLoc, canvas2.width || _lastW || canvas2.clientWidth, canvas2.height || _lastH || canvas2.clientHeight);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadVBO);
    const aQuadLoc = locs && locs.attribs && locs.attribs.a_quadPos != null ? locs.attribs.a_quadPos : gl.getAttribLocation(program, "a_quadPos");
    if (aQuadLoc >= 0) {
      gl.enableVertexAttribArray(aQuadLoc);
      gl.vertexAttribPointer(aQuadLoc, 2, gl.FLOAT, false, 0, 0);
      if (isWebGL2) gl.vertexAttribDivisor(aQuadLoc, 0);
    }
    const attrPos = locs && locs.attribs && locs.attribs.a_pos != null ? locs.attribs.a_pos : gl.getAttribLocation(program, "a_pos");
    const attrScale = locs && locs.attribs && locs.attribs.a_scale != null ? locs.attribs.a_scale : gl.getAttribLocation(program, "a_scale");
    const attrAngle = locs && locs.attribs && locs.attribs.a_angle != null ? locs.attribs.a_angle : gl.getAttribLocation(program, "a_angle");
    const attrColor = locs && locs.attribs && locs.attribs.a_color != null ? locs.attribs.a_color : gl.getAttribLocation(program, "a_color");
    const useTexLoc = locs && locs.uniforms && locs.uniforms.u_useTex != null ? locs.uniforms.u_useTex : gl.getUniformLocation(program, "u_useTex");
    const texLoc = locs && locs.uniforms && locs.uniforms.u_tex != null ? locs.uniforms.u_tex : gl.getUniformLocation(program, "u_tex");
    let anyTex = resources.textures.size > 0;
    if (useTexLoc) gl.uniform1i(useTexLoc, anyTex ? 1 : 0);
    if (texLoc && anyTex) {
      gl.activeTexture(gl.TEXTURE0);
      const first = resources.textures.values().next().value;
      gl.bindTexture(gl.TEXTURE_2D, first.tex);
      gl.uniform1i(texLoc, 0);
    }
    if (resources.textures.has("__starfield")) {
      try {
        const s = resources.textures.get("__starfield");
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        gl.useProgram(resources.programSimple);
        const locs2 = programLocations.get(resources.programSimple) || null;
        const useTexLoc2 = locs2 && locs2.uniforms && locs2.uniforms.u_useTex != null ? locs2.uniforms.u_useTex : gl.getUniformLocation(resources.programSimple, "u_useTex");
        const texLoc2 = locs2 && locs2.uniforms && locs2.uniforms.u_tex != null ? locs2.uniforms.u_tex : gl.getUniformLocation(resources.programSimple, "u_tex");
        if (useTexLoc2) gl.uniform1i(useTexLoc2, 1);
        if (texLoc2) {
          gl.activeTexture(gl.TEXTURE1);
          gl.uniform1i(texLoc2, 1);
        }
        const prevProg = program;
        const ures2 = locs2 && locs2.uniforms && locs2.uniforms.u_resolution ? locs2.uniforms.u_resolution : gl.getUniformLocation(resources.programSimple, "u_resolution");
        if (ures2) gl.uniform2f(ures2, canvas2.width || _lastW || canvas2.clientWidth, canvas2.height || _lastH || canvas2.clientHeight);
        if (!resources.fullscreenQuadVBO) {
          resources.fullscreenQuadVBO = gl.createBuffer();
          const Wpx = canvas2.width || _lastW || canvas2.clientWidth;
          const Hpx = canvas2.height || _lastH || canvas2.clientHeight;
          const verts = new Float32Array([0, 0, Wpx, 0, 0, Hpx, Wpx, Hpx]);
          gl.bindBuffer(gl.ARRAY_BUFFER, resources.fullscreenQuadVBO);
          gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        } else {
          const Wpx = canvas2.width || _lastW || canvas2.clientWidth;
          const Hpx = canvas2.height || _lastH || canvas2.clientHeight;
          gl.bindBuffer(gl.ARRAY_BUFFER, resources.fullscreenQuadVBO);
          const verts = new Float32Array([0, 0, Wpx, 0, 0, Hpx, Wpx, Hpx]);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.fullscreenQuadVBO);
        const posLoc = locs2 && locs2.attribs && locs2.attribs.a_pos != null ? locs2.attribs.a_pos : gl.getAttribLocation(resources.programSimple, "a_pos");
        if (posLoc >= 0) {
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.useProgram(prevProg);
      } catch (e) {
      }
    }
    if (useInstanced) {
      if (sn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.starInstanceVBO);
        if (attrPos >= 0) {
          gl.enableVertexAttribArray(attrPos);
          gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0);
          if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1);
        }
        if (attrScale >= 0) {
          gl.enableVertexAttribArray(attrScale);
          gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1);
        }
        if (attrAngle >= 0) {
          gl.enableVertexAttribArray(attrAngle);
          gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1);
        }
        if (attrColor >= 0) {
          gl.enableVertexAttribArray(attrColor);
          gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1);
        }
        safeDrawInstanced(resources.starInstanceVBO, 4, sn, elemsPer);
      }
      if (n > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.shipInstanceVBO);
        if (attrPos >= 0) {
          gl.enableVertexAttribArray(attrPos);
          gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0);
          if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1);
        }
        if (attrScale >= 0) {
          gl.enableVertexAttribArray(attrScale);
          gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1);
        }
        if (attrAngle >= 0) {
          gl.enableVertexAttribArray(attrAngle);
          gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1);
        }
        if (attrColor >= 0) {
          gl.enableVertexAttribArray(attrColor);
          gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1);
        }
        safeDrawInstanced(resources.shipInstanceVBO, 4, n, elemsPer);
      }
      if (bn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.bulletInstanceVBO);
        if (attrPos >= 0) {
          gl.enableVertexAttribArray(attrPos);
          gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0);
          if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1);
        }
        if (attrScale >= 0) {
          gl.enableVertexAttribArray(attrScale);
          gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1);
        }
        if (attrAngle >= 0) {
          gl.enableVertexAttribArray(attrAngle);
          gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, 3 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrAngle, 1);
        }
        if (attrColor >= 0) {
          gl.enableVertexAttribArray(attrColor);
          gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1);
        }
        safeDrawInstanced(resources.bulletInstanceVBO, 4, bn, elemsPer);
      }
      if (pn > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.particleInstanceVBO);
        if (attrPos >= 0) {
          gl.enableVertexAttribArray(attrPos);
          gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, 0);
          if (isWebGL2) gl.vertexAttribDivisor(attrPos, 1);
        }
        if (attrScale >= 0) {
          gl.enableVertexAttribArray(attrScale);
          gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, 2 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrScale, 1);
        }
        if (attrColor >= 0) {
          gl.enableVertexAttribArray(attrColor);
          gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, 4 * 4);
          if (isWebGL2) gl.vertexAttribDivisor(attrColor, 1);
        }
        safeDrawInstanced(resources.particleInstanceVBO, 4, pn, elemsPer);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const byteOffset = i * elemsPer * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.shipInstanceVBO);
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, byteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 2 * 4);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 3 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, byteOffset + 4 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      for (let bi = 0; bi < bn; bi++) {
        const byteOffset = bi * elemsPer * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.bulletInstanceVBO);
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, byteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 2 * 4);
        if (attrAngle >= 0) gl.vertexAttribPointer(attrAngle, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 3 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, byteOffset + 4 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      for (let pi = 0; pi < pn; pi++) {
        const byteOffset = pi * elemsPer * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.particleInstanceVBO);
        if (attrPos >= 0) gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, elemsPer * 4, byteOffset + 0);
        if (attrScale >= 0) gl.vertexAttribPointer(attrScale, 1, gl.FLOAT, false, elemsPer * 4, byteOffset + 2 * 4);
        if (attrColor >= 0) gl.vertexAttribPointer(attrColor, 4, gl.FLOAT, false, elemsPer * 4, byteOffset + 4 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }
  function teamToColor(team) {
    if (!team) return [0.6, 0.6, 0.6, 1];
    if (team === "red" || team === 0 || team === "0") return [1, 0.5, 0.5, 1];
    if (team === "blue" || team === 1 || team === "1") return [0.5, 0.75, 1, 1];
    return [0.85, 0.85, 0.85, 1];
  }
  function onContextLost(e) {
    e.preventDefault();
    _running = false;
  }
  function onContextRestored() {
    try {
      initGL();
    } catch (e) {
      console.warn("webgl restore failed", e);
    }
  }
  const renderer2 = {
    type: "webgl",
    webgl2: isWebGL2,
    // cached debug resources to avoid per-call shader compiles
    _debug: { solidProgram: null, solidBuf: null, solidBufSize: 0, fbo: null, fboTex: null },
    // debug helper: draw a solid opaque rectangle to the default framebuffer
    debugDrawSolid(opts2 = {}) {
      try {
        if (!gl) return false;
        const color = opts2.color || [1, 0, 0, 1];
        const x = opts2.x != null ? opts2.x : Math.floor((canvas2.width || 0) / 2 - 32);
        const y = opts2.y != null ? opts2.y : Math.floor((canvas2.height || 0) / 2 - 32);
        const w = opts2.w != null ? opts2.w : 64;
        const h = opts2.h != null ? opts2.h : 64;
        let p = renderer2._debug.solidProgram;
        let buf = renderer2._debug.solidBuf;
        if (!p) {
          const vsSrc = isWebGL2 ? `#version 300 es
precision mediump float; layout(location=0) in vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }` : `precision mediump float; attribute vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }`;
          const fsSrc = isWebGL2 ? `#version 300 es
precision mediump float; out vec4 o; uniform vec4 u_color; void main(){ o = u_color; }` : `precision mediump float; uniform vec4 u_color; void main(){ gl_FragColor = u_color; }`;
          const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
          const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
          p = linkProgram(vs, fs);
          buf = gl.createBuffer();
          renderer2._debug.solidProgram = p;
          renderer2._debug.solidBuf = buf;
          try {
            dumpProgramInfo(p);
          } catch (e) {
          }
        }
        const x0 = x, y0 = y, x1 = x + w, y1 = y + h;
        const verts = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        try {
          const byteLen = verts.byteLength;
          if (renderer2._debug.solidBufSize && byteLen <= renderer2._debug.solidBufSize) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
          } else {
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
            renderer2._debug.solidBufSize = byteLen;
          }
        } catch (e) {
          gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
          renderer2._debug.solidBufSize = verts.byteLength;
        }
        const blendEnabled = !!gl.getParameter(gl.BLEND);
        if (blendEnabled) gl.disable(gl.BLEND);
        gl.useProgram(p);
        const posLoc = isWebGL2 ? gl.getAttribLocation(p, "a_pos") : gl.getAttribLocation(p, "a_pos");
        const ures = gl.getUniformLocation(p, "u_resolution");
        const ucolor = gl.getUniformLocation(p, "u_color");
        if (ures) gl.uniform2f(ures, canvas2.width || _lastW || canvas2.clientWidth, canvas2.height || _lastH || canvas2.clientHeight);
        if (ucolor) gl.uniform4f(ucolor, color[0], color[1], color[2], color[3]);
        if (posLoc >= 0) {
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        try {
          checkGLError("debugDrawSolid after drawArrays");
        } catch (e) {
        }
        try {
          diag._lastDebugDraw = Date.now();
        } catch (e) {
        }
        if (blendEnabled) gl.enable(gl.BLEND);
        debugLog("debugDrawSolid: drew rect", x, y, w, h);
        return true;
      } catch (e) {
        debugLog("debugDrawSolid failed", e);
        return false;
      }
    },
    // debug helper: clear the default framebuffer to a solid color (opaque)
    debugClear(opts2 = {}) {
      try {
        if (!gl) return false;
        const c = opts2.color || [1, 0, 0, 1];
        const blendEnabled = !!gl.getParameter(gl.BLEND);
        if (blendEnabled) gl.disable(gl.BLEND);
        gl.clearColor(c[0], c[1], c[2], c[3]);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        try {
          checkGLError("debugClear after clear");
        } catch (e) {
        }
        if (blendEnabled) gl.enable(gl.BLEND);
        try {
          diag._lastDebugClear = Date.now();
        } catch (e) {
        }
        debugLog("debugClear: cleared to", c);
        return true;
      } catch (e) {
        debugLog("debugClear failed", e);
        return false;
      }
    },
    // debug helper: render/clear into an offscreen 1x1 FBO and return the pixel bytes
    debugDrawToFBO(opts2 = {}) {
      try {
        if (!gl) return { __error: "no-gl" };
        const c = opts2.color || [1, 0, 0, 1];
        let fbo = renderer2._debug && renderer2._debug.fbo;
        let tex = renderer2._debug && renderer2._debug.fboTex;
        let createdPerCall = false;
        if (!fbo || !tex) {
          createdPerCall = true;
          tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          } catch (e) {
          }
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          fbo = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          try {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          } catch (e) {
          }
          const status = gl.checkFramebufferStatus ? gl.checkFramebufferStatus(gl.FRAMEBUFFER) : gl.FRAMEBUFFER_COMPLETE;
          if (status !== gl.FRAMEBUFFER_COMPLETE) {
            debugLog("debugDrawToFBO: incomplete FBO", status);
            try {
              gl.bindFramebuffer(gl.FRAMEBUFFER, null);
              gl.deleteFramebuffer(fbo);
              gl.deleteTexture(tex);
            } catch (e) {
            }
            return { __error: "fbo-incomplete", status };
          }
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        }
        const prevViewport = gl.getParameter(gl.VIEWPORT);
        gl.viewport(0, 0, 1, 1);
        const blendEnabled = !!gl.getParameter(gl.BLEND);
        if (blendEnabled) gl.disable(gl.BLEND);
        gl.clearColor(c[0], c[1], c[2], c[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        try {
          gl.finish();
        } catch (e) {
        }
        const buf = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        try {
          gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
        } catch (e) {
        }
        if (blendEnabled) gl.enable(gl.BLEND);
        try {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } catch (e) {
        }
        if (createdPerCall) {
          try {
            gl.deleteFramebuffer(fbo);
            gl.deleteTexture(tex);
          } catch (e) {
          }
        }
        debugLog("debugDrawToFBO: read", buf[0], buf[1], buf[2], buf[3]);
        return { pixel: [buf[0], buf[1], buf[2], buf[3]] };
      } catch (e) {
        debugLog("debugDrawToFBO failed", e);
        return { __error: String(e) };
      }
    },
    init() {
      try {
        initGL();
        if (cfg.debug && gl) {
          try {
            if (!renderer2._debug.solidProgram) {
              const vsSrc = isWebGL2 ? `#version 300 es
precision mediump float; layout(location=0) in vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }` : `precision mediump float; attribute vec2 a_pos; uniform vec2 u_resolution; void main(){ vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc,0.0,1.0); }`;
              const fsSrc = isWebGL2 ? `#version 300 es
precision mediump float; out vec4 o; uniform vec4 u_color; void main(){ o = u_color; }` : `precision mediump float; uniform vec4 u_color; void main(){ gl_FragColor = u_color; }`;
              const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
              const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
              const p = linkProgram(vs, fs);
              const buf = gl.createBuffer();
              renderer2._debug.solidProgram = p;
              renderer2._debug.solidBuf = buf;
              renderer2._debug.solidBufSize = 0;
              try {
                dumpProgramInfo(p);
              } catch (e) {
              }
            }
          } catch (e) {
            console.warn("pre-create debug program failed", e);
          }
          try {
            if (!renderer2._debug.fbo) {
              const tex = gl.createTexture();
              gl.bindTexture(gl.TEXTURE_2D, tex);
              try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
              } catch (e) {
              }
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
              const fbo = gl.createFramebuffer();
              gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
              try {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
              } catch (e) {
              }
              let ok = true;
              try {
                if (gl.checkFramebufferStatus && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false;
              } catch (e) {
                ok = false;
              }
              gl.bindFramebuffer(gl.FRAMEBUFFER, null);
              if (ok) {
                renderer2._debug.fbo = fbo;
                renderer2._debug.fboTex = tex;
              } else {
                try {
                  gl.deleteFramebuffer(fbo);
                  gl.deleteTexture(tex);
                } catch (e) {
                }
              }
            }
          } catch (e) {
            console.warn("pre-create debug FBO failed", e);
          }
        }
        canvas2.addEventListener("webglcontextlost", onContextLost, false);
        canvas2.addEventListener("webglcontextrestored", onContextRestored, false);
        try {
          if (cfg.debug && typeof window !== "undefined") {
            window.__getRendererDiagnostics = renderer2.getRendererDiagnostics.bind(renderer2);
            window.__renderer = renderer2;
          }
        } catch (e) {
        }
        return true;
      } catch (e) {
        console.warn("WebGL init failed", e);
        return false;
      }
    },
    // sample center pixel from GL default framebuffer (returns Uint8 values)
    sampleGLCenter() {
      try {
        if (!gl) return null;
        const w = canvas2.width || 0;
        const h = canvas2.height || 0;
        if (!w || !h) return null;
        const x = Math.floor(w / 2);
        const y = Math.floor(h / 2);
        const buf = new Uint8Array(4);
        try {
          gl.finish();
        } catch (e) {
        }
        const glY = Math.max(0, h - 1 - y);
        gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return { x, y, pixel: [buf[0], buf[1], buf[2], buf[3]], w, h };
      } catch (e) {
        return { __error: String(e) };
      }
    },
    start(cb) {
      _running = true;
      if (cb) cb();
    },
    stop() {
      _running = false;
    },
    isRunning() {
      return _running;
    },
    render(state) {
      if (!gl) return;
      if (state && state.starCanvas) {
        try {
          const s = state.starCanvas;
          const prev = resources.textures.get("__starfield");
          const prevVersion = prev && prev.canvas && prev.canvas._version;
          const curVersion = s && s._version;
          if (!prev || prevVersion !== curVersion) queueStarfieldUpload(s);
        } catch (e) {
        }
      }
      if (cfg.atlasAccessor && typeof cfg.atlasAccessor === "function") {
        const ships2 = state && state.ships || [];
        for (const s of ships2) {
          const key = `${s.type || "hull"}:${s.radius || 8}`;
          if (!resources.textures.has(key)) {
            try {
              const atlas = cfg.atlasAccessor(s.type || "hull", s.radius || 8);
              if (atlas && atlas.canvas) {
                queueAtlasUpload(key, atlas);
              }
            } catch (e) {
            }
          }
        }
      }
      render(state);
    },
    destroy() {
      try {
        canvas2.removeEventListener("webglcontextlost", onContextLost);
        canvas2.removeEventListener("webglcontextrestored", onContextRestored);
        for (const v of Object.values(resources)) {
          try {
            if (!v) continue;
            if (v instanceof WebGLTexture) gl.deleteTexture(v);
            if (v instanceof WebGLBuffer) gl.deleteBuffer(v);
            if (v instanceof WebGLProgram) gl.deleteProgram(v);
            if (v instanceof WebGLVertexArrayObject) gl.deleteVertexArray(v);
          } catch (e) {
          }
        }
        try {
          if (renderer2._debug) {
            if (renderer2._debug.solidBuf) try {
              gl.deleteBuffer(renderer2._debug.solidBuf);
            } catch (e) {
            }
            if (renderer2._debug.solidProgram) try {
              gl.deleteProgram(renderer2._debug.solidProgram);
            } catch (e) {
            }
            if (renderer2._debug.fbo) try {
              gl.deleteFramebuffer(renderer2._debug.fbo);
            } catch (e) {
            }
            if (renderer2._debug.fboTex) try {
              gl.deleteTexture(renderer2._debug.fboTex);
            } catch (e) {
            }
            renderer2._debug.solidBuf = null;
            renderer2._debug.solidProgram = null;
            renderer2._debug.solidBufSize = 0;
            renderer2._debug.fbo = null;
            renderer2._debug.fboTex = null;
          }
        } catch (e) {
        }
      } catch (e) {
      }
    },
    // diagnostics accessor (include some resource counts)
    getRendererDiagnostics() {
      const starLen = _starBuffer ? _starBuffer.length : 0;
      const shipLen = _shipBuffer ? _shipBuffer.length : 0;
      const bulletLen = _bulletBuffer ? _bulletBuffer.length : 0;
      const particleLen = _particleBuffer ? _particleBuffer.length : 0;
      const starSampleLen = Math.min(starLen, 32);
      const shipSampleLen = Math.min(shipLen, 32);
      const bulletSampleLen = Math.min(bulletLen, 32);
      const particleSampleLen = Math.min(particleLen, 32);
      const base = Object.assign({}, diag, {
        // per-type buffer capacities (floats)
        starCapacity: _starCapacity,
        shipCapacity: _shipCapacity,
        bulletCapacity: _bulletCapacity,
        particleCapacity: _particleCapacity,
        // used element counts
        starUsed: _starUsed,
        shipUsed: _shipUsed,
        bulletUsed: _bulletUsed,
        particleUsed: _particleUsed,
        // per-VBO allocated byte sizes
        starVBOSize: resources.starInstanceVBO ? resources.starInstanceVBO._size : 0,
        shipVBOSize: resources.shipInstanceVBO ? resources.shipInstanceVBO._size : 0,
        bulletVBOSize: resources.bulletInstanceVBO ? resources.bulletInstanceVBO._size : 0,
        particleVBOSize: resources.particleInstanceVBO ? resources.particleInstanceVBO._size : 0,
        // include small samples to help debug instance contents
        starSample: _starBuffer ? Array.from(_starBuffer.subarray(0, starSampleLen)) : [],
        shipSample: _shipBuffer ? Array.from(_shipBuffer.subarray(0, shipSampleLen)) : [],
        bulletSample: _bulletBuffer ? Array.from(_bulletBuffer.subarray(0, bulletSampleLen)) : [],
        particleSample: _particleBuffer ? Array.from(_particleBuffer.subarray(0, particleSampleLen)) : [],
        // approximate instance counts assuming 8 floats per instance
        approxStarInstances: Math.floor(starLen / 8),
        approxShipInstances: Math.floor(shipLen / 8),
        approxBulletInstances: Math.floor(bulletLen / 8),
        approxParticleInstances: Math.floor(particleLen / 8)
      });
      try {
        if (gl && canvas2 && canvas2.width && canvas2.height) {
          const cx = Math.floor((canvas2.width || 0) / 2);
          const cy = Math.floor((canvas2.height || 0) / 2);
          const sx = Math.max(1, Math.min(3, canvas2.width));
          const sy = Math.max(1, Math.min(3, canvas2.height));
          const px = Math.max(0, cx - Math.floor(sx / 2));
          const py = Math.max(0, cy - Math.floor(sy / 2));
          const read = new Uint8Array(sx * sy * 4);
          try {
            gl.finish();
          } catch (e) {
          }
          const glPy = Math.max(0, canvas2.height - 1 - py - (sy - 1));
          gl.readPixels(px, glPy, sx, sy, gl.RGBA, gl.UNSIGNED_BYTE, read);
          let any = false;
          for (let i = 0; i < read.length; i += 4) {
            if (read[i] !== 0 || read[i + 1] !== 0 || read[i + 2] !== 0 || read[i + 3] !== 0) {
              any = true;
              break;
            }
          }
          base.centerSample = { x: cx, y: cy, w: sx, h: sy, anyNonZero: any, pixels: Array.from(read) };
        }
      } catch (e) {
        base.centerSample = { __error: String(e) };
      }
      try {
        const ca = gl.getContextAttributes ? gl.getContextAttributes() : null;
        const ver = gl.getParameter ? gl.getParameter(gl.VERSION) : null;
        const slv = gl.getParameter ? gl.getParameter(gl.SHADING_LANGUAGE_VERSION) : null;
        const vendor = gl.getParameter ? gl.getParameter(gl.VENDOR) || null : null;
        let lastErr = null;
        try {
          lastErr = gl.getError();
        } catch (e) {
          lastErr = String(e);
        }
        base.gl = { contextAttributes: ca, version: ver, shadingLanguageVersion: slv, vendor, lastError: lastErr };
      } catch (e) {
        base.gl = { __error: String(e) };
      }
      return base;
    }
  };
  return renderer2;
}
var webglRenderer_default = { createWebGLRenderer };

// src/main.js
var canvas = document.getElementById("world");
if (!canvas) {
  canvas = document.createElement("canvas");
  canvas.id = "world";
  (document.body || document.documentElement).appendChild(canvas);
}
function fitCanvas() {
  if (!canvas) return;
  try {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const w = Math.max(1, canvas.clientWidth || canvas.width || 1);
    const h = Math.max(1, canvas.clientHeight || canvas.height || 1);
    canvas.width = w;
    canvas.height = h;
  } catch (e) {
  }
}
window.addEventListener && window.addEventListener("resize", fitCanvas);
fitCanvas();
var renderer = null;
function makeSimpleAtlas(type, radius) {
  const pad = 4;
  const size = Math.max(8, Math.ceil(radius * 2 + pad * 2));
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.arc(cx - radius * 0.25, cy - radius * 0.25, Math.max(1, radius * 0.35), 0, Math.PI * 2);
  ctx.fill();
  return { canvas: c, size, baseRadius: radius };
}
try {
  if (webglRenderer_default && typeof webglRenderer_default.createWebGLRenderer === "function") {
    const tryWebgl = webglRenderer_default.createWebGLRenderer(canvas, { webgl2: true, atlasAccessor: (type, radius) => makeSimpleAtlas(type, radius) });
    if (tryWebgl && tryWebgl.init && tryWebgl.init()) {
      renderer = tryWebgl;
      console.log("[main] using WebGL renderer");
    }
  }
} catch (e) {
  console.warn("WebGL renderer init failed, falling back to canvas renderer", e);
}
if (!renderer) {
  renderer = createCanvasRenderer(canvas);
  if (renderer && renderer.init) renderer.init();
}
window.__GM = gamemanager_exports;
window.__getGMShips = () => window.__GM && window.__GM.ships ? window.__GM.ships : [];
var DEFAULT_SEED = 1;
reset(DEFAULT_SEED);
var startBtn = document.getElementById("startPause");
var resetBtn = document.getElementById("reset");
var addRed = document.getElementById("addRed");
var addBlue = document.getElementById("addBlue");
var seedBtn = document.getElementById("seedBtn");
var _rafId = null;
var _lastTime = null;
function webglLoop(nowMs) {
  if (!renderer || typeof renderer.isRunning === "function" && !renderer.isRunning()) {
    _rafId = null;
    return;
  }
  const now = nowMs / 1e3;
  const dt = _lastTime ? Math.min(0.05, now - _lastTime) : 1 / 60;
  _lastTime = now;
  const state = simulate(dt, canvas.width, canvas.height);
  try {
    renderer && renderer.render && renderer.render(state);
  } catch (e) {
    console.warn("renderer.render error", e);
  }
  _rafId = requestAnimationFrame(webglLoop);
}
if (startBtn) {
  startBtn.addEventListener("click", () => {
    const running = typeof renderer.isRunning === "function" ? renderer.isRunning() : false;
    if (!running) {
      renderer.start && renderer.start();
      startBtn.textContent = "\u23F8 Pause";
      _lastTime = null;
      if (renderer && typeof renderer.type === "string" && renderer.type.indexOf("webgl") === 0) _rafId = requestAnimationFrame(webglLoop);
    } else {
      renderer.stop && renderer.stop();
      startBtn.textContent = "\u25B6 Start";
      if (_rafId) {
        cancelAnimationFrame(_rafId);
        _rafId = null;
      }
    }
  });
}
if (resetBtn) resetBtn.addEventListener("click", () => {
  reset();
});
if (addRed) addRed.addEventListener("click", () => {
  ships.push(createShip({ x: 100, y: 100, team: "red" }));
});
if (addBlue) addBlue.addEventListener("click", () => {
  ships.push(createShip({ x: 700, y: 500, team: "blue" }));
});
if (seedBtn) seedBtn.addEventListener("click", () => {
  const s = Math.floor(srandom() * 4294967295);
  srand(s);
  reset(s);
  alert("Seed: " + s);
});
if (renderer) {
  renderer.start && renderer.start();
  if (typeof renderer.type === "string" && renderer.type.indexOf("webgl") === 0) {
    _rafId = requestAnimationFrame(webglLoop);
  }
}
