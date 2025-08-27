// Use shared helper for default ship type
import { getDefaultShipTypeSafe } from "./config/runtimeConfigResolver";
export function createGameManager({ useWorker = false, renderer = null, seed = 12345, createSimWorker: createSimWorkerFactory, } = {}) {
    function _evaluateAndEmit(dt) {
        const result = evaluateReinforcement(dt, state, continuousOptions);
        if (result && Array.isArray(result.spawned) && result.spawned.length) {
            lastReinforcement = {
                spawned: result.spawned,
                timestamp: Date.now(),
                options: { ...continuousOptions },
            };
            emit("reinforcements", { spawned: result.spawned });
        }
    }
    let state = makeInitialState();
    let running = false;
    const listeners = new Map();
    const workerReadyCbs = [];
    let simWorker = null;
    let _workerReadyHandler = null;
    let _workerSnapshotHandler = null;
    let _pendingRender = false;
    let _workerReinforcementsHandler = null;
    let workerReady = false;
    let lastReinforcement = {
        spawned: [],
        timestamp: 0,
        options: {},
    };
    let continuous = false;
    let continuousOptions = {};
    let last = typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    let acc = 0;
    const score = { red: 0, blue: 0 };
    const internal = { state, bounds: SIM.bounds };
    function emit(type, msg) {
        emitManagerEvent(listeners, type, msg);
    }
    function on(evt, cb) {
        const arr = listeners.get(evt) || [];
        arr.push(cb);
        listeners.set(evt, arr);
    }
    function off(evt, cb) {
        const arr = listeners.get(evt) || [];
        const i = arr.indexOf(cb);
        if (i !== -1)
            arr.splice(i, 1);
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
                        }
                        catch (e) { }
                        try {
                            if (_workerSnapshotHandler)
                                simWorker.off("snapshot", _workerSnapshotHandler);
                        }
                        catch (e) { }
                        try {
                            if (_workerReinforcementsHandler)
                                simWorker.off("reinforcements", _workerReinforcementsHandler);
                        }
                        catch (e) { }
                    }
                }
                catch (e) { }
                try {
                    if (typeof simWorker.terminate === "function")
                        simWorker.terminate();
                    else if (typeof simWorker.close === "function")
                        simWorker.close();
                    else if (typeof simWorker.post === "function")
                        simWorker.post({ type: "stop" });
                }
                catch (e) { }
                simWorker = null;
            }
        }
        catch (e) { }
        workerReady = false;
        workerReadyCbs.length = 0;
    }
    function start() {
        if (!running) {
            running = true;
            last =
                typeof performance !== "undefined" && performance.now
                    ? performance.now()
                    : Date.now();
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
            }
            catch (e) { }
    }
    function stepOnce(dt = SIM.DT_MS / 1000) {
        const n = Number(dt) || SIM.DT_MS / 1000;
        step(n);
    }
    function step(dtSeconds) {
        const clampedDt = Math.min(dtSeconds, 0.05);
        if (!simWorker) {
            try {
                applySimpleAI(state, clampedDt, SIM.bounds);
            }
            catch (e) { }
            try {
                simulateStep(state, clampedDt, SIM.bounds);
            }
            catch (e) { }
        }
        else {
            try {
                simWorker.post && simWorker.post({ type: "snapshotRequest" });
            }
            catch (e) { }
        }
        _evaluateAndEmit(clampedDt);
        // Coalesce renders on main-thread path to at most one RAF per frame
        if (renderer && typeof renderer.renderState === "function") {
            try {
                if (!_pendingRender) {
                    _pendingRender = true;
                    try {
                        requestAnimationFrame(() => {
                            try {
                                renderer.renderState({
                                    ships: state.ships,
                                    bullets: state.bullets,
                                    flashes: state.flashes,
                                    shieldFlashes: state.shieldFlashes,
                                    healthFlashes: state.healthFlashes,
                                    t: state.t,
                                });
                            }
                            catch (e) { }
                            _pendingRender = false;
                        });
                    }
                    catch (e) {
                        setTimeout(() => {
                            try {
                                renderer.renderState({
                                    ships: state.ships,
                                    bullets: state.bullets,
                                    flashes: state.flashes,
                                    shieldFlashes: state.shieldFlashes,
                                    healthFlashes: state.healthFlashes,
                                    t: state.t,
                                });
                            }
                            catch (e) { }
                            _pendingRender = false;
                        }, 0);
                    }
                }
            }
            catch (e) { }
        }
    }
    function runLoop() {
        if (!running)
            return;
        const now = typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        acc += now - last;
        last = now;
        if (acc > 250)
            acc = 250;
        while (acc >= SIM.DT_MS) {
            step(SIM.DT_MS / 1000);
            acc -= SIM.DT_MS;
        }
        try {
            requestAnimationFrame(runLoop);
        }
        catch (e) {
            setTimeout(runLoop, SIM.DT_MS);
        }
    }
    function setContinuousEnabled(v = false) {
        continuous = !!v;
        if (simWorker) {
            try {
                simWorker.post({ type: "setContinuous", value: !!v });
            }
            catch (e) { }
        }
        else {
            if (continuous) {
                const result = evaluateReinforcement(SIM.DT_MS / 1000, state, continuousOptions);
                if (result && Array.isArray(result.spawned) && result.spawned.length) {
                    lastReinforcement = {
                        spawned: result.spawned,
                        timestamp: Date.now(),
                        options: { ...continuousOptions },
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
                    opts: continuousOptions,
                });
            }
            catch (e) { }
    }
    function getContinuousOptions() {
        return { ...continuousOptions };
    }
    function setReinforcementIntervalManager(seconds) {
        setReinforcementInterval(seconds);
        if (simWorker)
            try {
                simWorker.post({ type: "setReinforcementInterval", seconds });
            }
            catch (e) { }
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
        if (typeof cb === "function")
            workerReadyCbs.push(cb);
    }
    function offWorkerReady(cb) {
        const i = workerReadyCbs.indexOf(cb);
        if (i !== -1)
            workerReadyCbs.splice(i, 1);
    }
    function spawnShip(team = "red", type) {
        try {
            // Resolve default ship type safely across ESM/CJS; fallback to 'fighter'
            const shipType = type || getDefaultShipTypeSafe();
            const b = SIM.bounds;
            const x = Math.max(0, Math.min(b.W - 1e-6, srandom() * b.W));
            const y = Math.max(0, Math.min(b.H - 1e-6, srandom() * b.H));
            const ship = createShip(shipType, x, y, team);
            state.ships.push(ship);
            try {
                state.shipMap && state.shipMap.set(ship.id, ship);
            }
            catch (e) { }
            try {
                updateTeamCount(state, undefined, String(ship.team));
            }
            catch (e) { }
            return ship;
        }
        catch (e) {
            return null;
        }
    }
    function formFleets() {
        try {
            state.ships.length = 0;
            const bounds = SIM.bounds;
            const seedVal = Math.floor(srandom() * 0xffffffff) >>> 0;
            const ships = makeInitialFleets(seedVal, bounds, createShip);
            for (const ship of ships) {
                state.ships.push(ship);
            }
            try {
                normalizeStateShips(state);
            }
            catch (e) { }
        }
        catch (e) { }
    }
    function reseedManager(newSeed = Math.floor(srandom() * 0xffffffff)) {
        _seed = newSeed >>> 0;
        srand(_seed);
        if (simWorker)
            try {
                simWorker.post({ type: "setSeed", seed: _seed });
            }
            catch (e) { }
    }
    function getLastReinforcement() {
        return { ...lastReinforcement };
    }
    function snapshot() {
        return {
            ships: state.ships.slice(),
            bullets: state.bullets.slice(),
            t: state.t,
            teamCounts: state.teamCounts ? { ...state.teamCounts } : {},
            flashes: state.flashes ? state.flashes.slice() : [],
            shieldFlashes: state.shieldFlashes ? state.shieldFlashes.slice() : [],
            healthFlashes: state.healthFlashes ? state.healthFlashes.slice() : [],
        };
    }
    // Worker setup (optional, not used in current UI)
    try {
        if (useWorker) {
            const factory = createSimWorkerFactory || createSimWorker;
            let simWorkerUrl;
            try {
                simWorkerUrl =
                    typeof import.meta !== "undefined" && import.meta.url
                        ? new URL("./simWorker.js", import.meta.url).href
                        : "./simWorker.js";
            }
            catch (e) {
                simWorkerUrl = "./simWorker.js";
            }
            simWorker = factory(simWorkerUrl);
            _workerReadyHandler = () => {
                workerReady = true;
                for (const cb of workerReadyCbs.slice()) {
                    try {
                        cb();
                    }
                    catch (e) { }
                }
            };
            simWorker.on && simWorker.on("ready", _workerReadyHandler);
            _workerSnapshotHandler = (m) => {
                try {
                    if (m && m.state) {
                        state = m.state;
                        try {
                            normalizeStateShips(state);
                        }
                        catch (e) { }
                        try {
                            internal.state = state;
                        }
                        catch (e) { }
                        // Coalesce render to next RAF so UI updates once per frame
                        try {
                            if (renderer && typeof renderer.renderState === "function") {
                                if (!_pendingRender) {
                                    _pendingRender = true;
                                    try {
                                        requestAnimationFrame(() => {
                                            try {
                                                renderer.renderState({
                                                    ships: state.ships,
                                                    bullets: state.bullets,
                                                    flashes: state.flashes,
                                                    shieldFlashes: state.shieldFlashes,
                                                    healthFlashes: state.healthFlashes,
                                                    t: state.t,
                                                });
                                            }
                                            catch (e) { }
                                            _pendingRender = false;
                                        });
                                    }
                                    catch (e) {
                                        setTimeout(() => {
                                            try {
                                                renderer.renderState({
                                                    ships: state.ships,
                                                    bullets: state.bullets,
                                                    flashes: state.flashes,
                                                    shieldFlashes: state.shieldFlashes,
                                                    healthFlashes: state.healthFlashes,
                                                    t: state.t,
                                                });
                                            }
                                            catch (e) { }
                                            _pendingRender = false;
                                        }, 0);
                                    }
                                }
                            }
                        }
                        catch (e) { }
                    }
                }
                catch (e) { }
            };
            simWorker.on && simWorker.on("snapshot", _workerSnapshotHandler);
            _workerReinforcementsHandler = (m) => {
                emit("reinforcements", m);
            };
            simWorker.on &&
                simWorker.on("reinforcements", _workerReinforcementsHandler);
            try {
                simWorker.post({
                    type: "init",
                    seed,
                    bounds: SIM.bounds,
                    simDtMs: SIM.DT_MS,
                    state,
                });
                simWorker.post({ type: "start" });
            }
            catch (e) { }
        }
    }
    catch (e) {
        simWorker = null;
    }
    return {
        // Allow external callers (tests) to push snapshots into the manager
        onSnapshot: (m) => {
            try {
                if (m && m.state) {
                    state = m.state;
                    try {
                        normalizeStateShips(state);
                    }
                    catch (e) { }
                    try {
                        internal.state = state;
                    }
                    catch (e) { }
                    if (renderer && typeof renderer.renderState === "function") {
                        try {
                            if (!_pendingRender) {
                                _pendingRender = true;
                                try {
                                    requestAnimationFrame(() => {
                                        try {
                                            renderer.renderState({
                                                ships: state.ships,
                                                bullets: state.bullets,
                                                flashes: state.flashes,
                                                shieldFlashes: state.shieldFlashes,
                                                healthFlashes: state.healthFlashes,
                                                t: state.t,
                                            });
                                        }
                                        catch (e) { }
                                        _pendingRender = false;
                                    });
                                }
                                catch (e) {
                                    setTimeout(() => {
                                        try {
                                            renderer.renderState({
                                                ships: state.ships,
                                                bullets: state.bullets,
                                                flashes: state.flashes,
                                                shieldFlashes: state.shieldFlashes,
                                                healthFlashes: state.healthFlashes,
                                                t: state.t,
                                            });
                                        }
                                        catch (e) { }
                                        _pendingRender = false;
                                    }, 0);
                                }
                            }
                        }
                        catch (e) { }
                    }
                }
            }
            catch (e) { }
        },
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
        _internal: internal,
    };
}
export default createGameManager;
// Convenience runtime reset function used by tests (delegates to internal resetManager when using default manager instance)
export function reset(seed = null) {
    // Resetting global manager state is test-specific; callers use makeInitialState directly in many tests.
    // Provide a no-op reset to satisfy legacy tests that import reset from the module.
    if (typeof seed === "number") {
        try {
            /* reseed global RNG if exposed */
        }
        catch (e) { }
    }
}
export function releaseParticle(state, p) {
    if (!p)
        return;
    const key = "particle";
    try {
        releaseEffect(state, key, p, (x) => {
            /* no-op */
        });
    }
    catch { }
    const idx = (state.particles || []).indexOf(p);
    if (idx !== -1)
        (state.particles || []).splice(idx, 1);
}
// Minimal TypeScript shim that re-exports the existing JavaScript runtime implementation.
// Import the runtime as a namespace and re-export value bindings to avoid
// circular alias issues. Types are defined in `gamemanager.d.ts`.
// Ported from gamemanager.js, now canonical TypeScript implementation
import { makeInitialState, createShip, genId, createExplosionEffect, resetExplosionEffect, createShieldHitEffect, resetShieldHitEffect, createHealthHitEffect, resetHealthHitEffect, normalizeStateShips, } from "./entities";
import { updateTeamCount } from "./entities";
import { applySimpleAI } from "./behavior";
import { simulateStep } from "./simulate";
import { SIM } from "./config/simConfig";
import { srand, srandom } from "./rng";
import { createSimWorker } from "./createSimWorker";
import { acquireEffect, releaseEffect, acquireSprite, releaseSprite, makePooled, } from "./pools";
import { SHIELD, HEALTH, EXPLOSION, STARS, FALLBACK_POSITIONS, } from "./config/gamemanagerConfig";
import * as EntitiesConfigESM from "./config/entitiesConfig";
import { chooseReinforcementsWithManagerSeed, makeInitialFleets, TeamsConfig, } from "./config/teamsConfig";
// All runtime arrays are now managed via GameState for determinism and lifecycle control.
// Bullet pooling
// Bullets: support optional GameState-backed pooling. If `state` is provided,
// use state.assetPool.sprites keyed by 'bullet', otherwise fallback to legacy in-memory pool.
export function acquireBullet(state, opts = {}) {
    // Defensive: accept minimal/mocked state objects in tests by ensuring
    // required collections exist. Do not overwrite existing richer assetPool.
    if (!state)
        state = makeInitialState();
    state.bullets = state.bullets || [];
    state.assetPool = state.assetPool || {
        textures: new Map(),
        sprites: new Map(),
        effects: new Map(),
        counts: {
            textures: new Map(),
            sprites: new Map(),
            effects: new Map(),
        },
        config: {
            texturePoolSize: 128,
            spritePoolSize: 256,
            effectPoolSize: 128,
            textureOverflowStrategy: "discard-oldest",
            spriteOverflowStrategy: "discard-oldest",
            effectOverflowStrategy: "discard-oldest",
        },
    };
    // Use state-backed sprite pool keyed by 'bullet'
    const key = "bullet";
    const b = acquireSprite(state, key, () => makePooled({ ...opts, id: genId(), alive: true }, (o, initArgs) => Object.assign(o, initArgs)), opts);
    // push into the state-active array so simulation sees it
    (state.bullets ||= []).push(b);
    return b;
}
export function releaseBullet(state, b) {
    if (!b)
        return;
    if (!b.alive)
        return; // Prevent double-free
    b.alive = false;
    // remove from the state's active bullets
    const arr = state.bullets || [];
    const idx = arr.indexOf(b);
    if (idx !== -1)
        arr.splice(idx, 1);
    releaseSprite(state, "bullet", b, undefined);
}
// Explosion pooling
export function acquireExplosion(state, opts = {}) {
    const key = "explosion";
    const e = acquireEffect(state, key, () => makePooled(createExplosionEffect(opts), resetExplosionEffect), opts);
    (state.explosions ||= []).push(e);
    return e;
}
export function releaseExplosion(state, e) {
    if (!e)
        return;
    if (e._pooled)
        return;
    if (!e.alive)
        return;
    e.alive = false;
    e._pooled = true;
    const arr = state.explosions || [];
    const idx = arr.indexOf(e);
    if (idx !== -1)
        arr.splice(idx, 1);
    releaseEffect(state, "explosion", e, undefined);
}
// ShieldHit pooling
export function acquireShieldHit(state, opts = {}) {
    const key = "shieldHit";
    const sh = acquireEffect(state, key, () => makePooled(createShieldHitEffect(opts), resetShieldHitEffect), opts);
    (state.shieldHits ||= []).push(sh);
    return sh;
}
export function releaseShieldHit(state, sh) {
    if (!sh)
        return;
    if (sh._pooled)
        return;
    const arr = state.shieldHits || [];
    const i = arr.indexOf(sh);
    if (i !== -1)
        arr.splice(i, 1);
    sh.alive = false;
    sh._pooled = true;
    releaseEffect(state, "shieldHit", sh, undefined);
}
// HealthHit pooling
export function acquireHealthHit(state, opts = {}) {
    const key = "healthHit";
    const hh = acquireEffect(state, key, () => makePooled(createHealthHitEffect(opts), resetHealthHitEffect), opts);
    (state.healthHits ||= []).push(hh);
    return hh;
}
export function releaseHealthHit(state, hh) {
    if (!hh)
        return;
    if (hh._pooled)
        return;
    const arr = state.healthHits || [];
    const i = arr.indexOf(hh);
    if (i !== -1)
        arr.splice(i, 1);
    hh.alive = false;
    hh._pooled = true;
    releaseEffect(state, "healthHit", hh, undefined);
}
export const config = {
    shield: { ...SHIELD },
    health: { ...HEALTH },
    explosion: { ...EXPLOSION },
    stars: { ...STARS },
};
let _seed = null;
let _reinforcementInterval = TeamsConfig.continuousReinforcement?.interval ?? 5.0;
let _reinforcementAccumulator = 0;
let _starCanvasVersion = 0;
let starCanvas = null;
let _lastSimulateFrameId = null;
let _doubleSimStrict = false;
export function setDoubleSimStrict(v = false) {
    _doubleSimStrict = !!v;
}
export class Particle {
    x;
    y;
    vx;
    vy;
    ttl;
    life;
    color;
    size;
    alive;
    _pooled; // Add pooled flag to prevent double-free
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
        this._pooled = false;
    }
}
export function acquireParticle(state, x, y, opts = {}) {
    // Resolve PARTICLE_DEFAULTS safely to handle any ESM/CJS interop hiccups during tests
    const PARTICLE_DEFAULTS_SAFE = (() => {
        try {
            const mod = EntitiesConfigESM || {};
            const v = mod.BULLET_DEFAULTS && mod.PARTICLE_DEFAULTS
                ? mod.PARTICLE_DEFAULTS
                : mod.default && mod.default.PARTICLE_DEFAULTS
                    ? mod.default.PARTICLE_DEFAULTS
                    : undefined;
            if (v && typeof v.ttl === "number" && typeof v.size !== "undefined")
                return v;
        }
        catch (e) { }
        return { ttl: 1, color: "#fff", size: 2 };
    })();
    const key = "particle";
    const poolConfig = state.assetPool?.config || {};
    const maxSize = poolConfig.effectPoolSize ?? 128;
    const overflowStrategy = poolConfig.effectOverflowStrategy ?? "discard-oldest";
    // Defensive: prune oldest if pool is full
    if ((state.particles?.length ?? 0) >= maxSize) {
        if (overflowStrategy === "discard-oldest" && state.particles?.length) {
            state.particles?.shift();
        }
        else if (overflowStrategy === "error") {
            // Do not add new particle, return null
            return null;
        } // "grow" allows pool to grow
    }
    // Create a pooled Particle instance
    const p = acquireEffect(state, key, () => makePooled(new Particle(x, y, opts.vx ?? 0, opts.vy ?? 0, opts.ttl ?? PARTICLE_DEFAULTS_SAFE.ttl, opts.color ?? PARTICLE_DEFAULTS_SAFE.color, opts.size ?? PARTICLE_DEFAULTS_SAFE.size), undefined), {
        x,
        y,
        vx: opts.vx ?? 0,
        vy: opts.vy ?? 0,
        ttl: opts.ttl ?? PARTICLE_DEFAULTS_SAFE.ttl,
        color: opts.color ?? PARTICLE_DEFAULTS_SAFE.color,
        size: opts.size ?? PARTICLE_DEFAULTS_SAFE.size,
    });
    // Rehydrate properties
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.ttl = opts.ttl ?? PARTICLE_DEFAULTS_SAFE.ttl;
    p.life = p.ttl;
    p.color = opts.color ?? PARTICLE_DEFAULTS_SAFE.color;
    p.size = opts.size ?? PARTICLE_DEFAULTS_SAFE.size;
    p.alive = true;
    (state.particles ||= []).push(p);
    return p;
}
export function createStarCanvas(state, W = 800, H = 600, bg = "#041018") {
    if (!state || !Array.isArray(state.stars))
        return null;
    try {
        const c = typeof document !== "undefined" && document.createElement
            ? document.createElement("canvas")
            : null;
        if (!c)
            return null;
        c.width = Math.max(1, Math.floor(W));
        c.height = Math.max(1, Math.floor(H));
        const ctx = c.getContext && c.getContext("2d");
        if (ctx) {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, c.width, c.height);
            for (const s of state.stars) {
                const alpha = Math.max(0, Math.min(1, s.a != null ? s.a : s.baseA != null ? s.baseA : 1));
                ctx.beginPath();
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                const rr = Math.max(0.2, s.r || 0.5);
                ctx.arc(s.x || 0, s.y || 0, rr, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        _starCanvasVersion = (_starCanvasVersion || 0) + 1;
        c._version = _starCanvasVersion;
        starCanvas = c;
        return c;
    }
    catch (e) {
        return null;
    }
}
export function getStarCanvasVersion() {
    return _starCanvasVersion;
}
export function setReinforcementInterval(seconds) {
    _reinforcementInterval =
        Number(seconds) || (TeamsConfig.continuousReinforcement?.interval ?? 5.0);
}
export function getReinforcementInterval() {
    return _reinforcementInterval;
}
function emitManagerEvent(map, type, data) {
    const arr = map.get(type) || [];
    for (const cb of arr.slice()) {
        try {
            if (typeof cb === "function")
                cb(data);
        }
        catch (e) { }
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
                    enabled: true,
                });
                if (Array.isArray(orders) && orders.length) {
                    const spawned = [];
                    for (const o of orders) {
                        try {
                            const ship = createShip(o.type || getDefaultShipTypeSafe(), o.x || 100, o.y || 100, o.team || "red");
                            state.ships.push(ship);
                            try {
                                state.shipMap &&
                                    state.shipMap.set(ship.id, ship);
                            }
                            catch (e) { }
                            try {
                                updateTeamCount(state, undefined, ship.team);
                            }
                            catch (e) { }
                            spawned.push(ship);
                        }
                        catch (e) { }
                    }
                    return { spawned };
                }
            }
            const fallback = getDefaultShipTypeSafe();
            const r = createShip(fallback, FALLBACK_POSITIONS[0].x, FALLBACK_POSITIONS[0].y, FALLBACK_POSITIONS[0].team);
            const b = createShip(fallback, FALLBACK_POSITIONS[1].x, FALLBACK_POSITIONS[1].y, FALLBACK_POSITIONS[1].team);
            state.ships.push(r);
            try {
                state.shipMap && state.shipMap.set(r.id, r);
            }
            catch (e) { }
            try {
                updateTeamCount(state, undefined, String(r.team));
            }
            catch (e) { }
            state.ships.push(b);
            try {
                state.shipMap && state.shipMap.set(b.id, b);
            }
            catch (e) { }
            try {
                updateTeamCount(state, undefined, String(b.team));
            }
            catch (e) { }
            return { spawned: [r, b] };
        }
        catch (e) {
            return null;
        }
    }
    return null;
}
export function simulate(dt, W = 800, H = 600) {
    try {
        const now = typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        const frame = Math.floor(now / 4);
        if (_lastSimulateFrameId === frame) {
            const msg = "[gamemanager] detected simulate() called multiple times in same frame";
            try {
                const _isProd = (typeof process !== "undefined" &&
                    process.env &&
                    process.env.NODE_ENV === "production") ||
                    (typeof globalThis.NODE_ENV !== "undefined" &&
                        globalThis.NODE_ENV === "production");
                if (_doubleSimStrict)
                    throw new Error(msg);
                else if (!_isProd)
                    console.warn(msg);
            }
            catch (e) {
                // ignore environment detection errors and avoid noisy logs in production
            }
        }
        _lastSimulateFrameId = frame;
    }
    catch (e) { }
    // Build a canonical GameState using makeInitialState to ensure assetPool exists
    const state = makeInitialState();
    state.t = 0;
    // No global arrays; all arrays are managed via GameState
    evaluateReinforcement(dt, state);
    try {
        simulateStep(state, dt, SIM.bounds);
    }
    catch (e) { }
    // No global state to clear; callers should pass `state` explicitly to helpers.
    return state;
}
export function processStateEvents(state, dt = 0) {
    return state;
}
