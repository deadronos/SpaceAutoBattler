import { getRuntimeShipConfigSafe, getRuntimeSizeDefaultsSafe, getDefaultShipTypeSafe, } from "./config/runtimeConfigResolver";
// Lazily resolve entitiesConfig to avoid partial module initialization during test interop.
// Support ESM environments by creating a CommonJS-like require.
let __nodeRequire;
try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Node ESM global
    const { createRequire } = require("module");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta in TS transpiled output
    __nodeRequire = createRequire(typeof import.meta !== "undefined" ? import.meta.url : __filename);
}
catch (e) {
    try {
        // Fallback if native require exists (CJS paths)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createRequire } = require("module");
        __nodeRequire = createRequire(__filename);
    }
    catch (e2) { }
}
function __resolveEntitiesConfigModule() {
    try {
        // Prefer explicit .js when available (CJS consumers / runtime that resolve to compiled files)
        if (__nodeRequire) {
            try {
                return __nodeRequire("./config/entitiesConfig.js");
            }
            catch { }
            try {
                return __nodeRequire("./config/entitiesConfig");
            }
            catch { }
        }
    }
    catch { }
    try {
        const mod = __nodeRequire
            ? __nodeRequire("./config/entitiesConfig.ts")
            : undefined;
        if (mod)
            return mod;
    }
    catch { }
    try {
        // As a last resort, attempt ESM namespace import already transpiled
        // Note: In many bundlers, this path will be rewritten; keep as safety.
        return __nodeRequire
            ? __nodeRequire("./config/entitiesConfig.js")
            : undefined;
    }
    catch { }
    return undefined;
}
// Delegate to centralized runtime resolver (memoized) to avoid repeated module work
const getShipConfigSafe = () => getRuntimeShipConfigSafe();
const getSizeDefaultsSafe = (size) => getRuntimeSizeDefaultsSafe(size);
// (Removed duplicate getShipConfigSafe)
// pooling helpers moved to src/pools; importers should use that module now
import { TEAM_DEFAULT } from "./config/teamsConfig";
import Pool from "./pools/pool";
// Pooling helpers were moved to `src/pools` — import from there directly.
let nextId = 1;
export function genId() {
    return nextId++;
}
export function createShip(type = undefined, x = 0, y = 0, team = TEAM_DEFAULT) {
    const shipCfg = getShipConfigSafe();
    const availableTypes = Object.keys(shipCfg || {});
    const resolvedType = type && shipCfg[type]
        ? type
        : availableTypes.length
            ? availableTypes[0]
            : getDefaultShipTypeSafe();
    const rawCfg = (shipCfg[resolvedType] ||
        shipCfg[getDefaultShipTypeSafe()]);
    // Merge in per-size defaults for any fields not explicitly provided by the
    // ship type config. This keeps configs concise while ensuring sensible
    // defaults for armor/shields per size class.
    const sizeVal = rawCfg.size ||
        (rawCfg.radius && rawCfg.radius >= 36
            ? "large"
            : rawCfg.radius && rawCfg.radius >= 20
                ? "medium"
                : "small");
    const sizeDefaults = getSizeDefaultsSafe(sizeVal);
    const cfg = Object.assign({}, sizeDefaults, rawCfg);
    const ship = {
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
        // Shallow-clone cannons to avoid mutating config and avoid expensive JSON roundtrip
        cannons: Array.isArray(cfg.cannons)
            ? cfg.cannons.map((c) => (c && typeof c === "object" ? { ...c } : c))
            : [],
        // Keep raw turret defs here for now; we'll normalize below via helper so
        // normalization logic is centralized and reusable by snapshot handlers.
        turrets: cfg.turrets || [],
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
        trail: undefined,
        shieldPercent: 1,
        hpPercent: 1,
    };
    // Ensure turrets are normalized to the object shape (idempotent)
    try {
        normalizeTurrets(ship);
    }
    catch (e) { }
    return ship;
}
// normalizeTurrets
// Converts turret shorthand arrays ([x,y]) into normalized turret objects
// with default runtime fields. This function is idempotent and safe to call
// on ships coming from snapshots or network/worker messages.
export function normalizeTurrets(ship) {
    try {
        if (!ship)
            return;
        const tarr = ship.turrets;
        if (!Array.isArray(tarr))
            return;
        ship.turrets = tarr.map((t) => {
            if (Array.isArray(t) && t.length === 2) {
                return {
                    position: t,
                    angle: 0,
                    targetAngle: 0,
                    kind: "basic",
                    spread: 0,
                    barrel: 0,
                    cooldown: 1.0,
                };
            }
            // If it's already an object turret, shallow-copy and ensure runtime defaults
            if (t && typeof t === "object") {
                const copy = Object.assign({}, t);
                if (typeof copy.angle !== "number")
                    copy.angle = 0;
                if (typeof copy.targetAngle !== "number")
                    copy.targetAngle = 0;
                if (typeof copy.spread !== "number")
                    copy.spread = 0;
                if (typeof copy.barrel !== "number")
                    copy.barrel = 0;
                if (typeof copy.cooldown !== "number")
                    copy.cooldown = copy.cooldown || 1.0;
                return copy;
            }
            return t;
        });
    }
    catch (e) { }
}
// normalizeStateShips
// Normalizes turrets for every ship in the provided state, rebuilds a
// shipMap for quick lookups and recomputes teamCounts (keeps red/blue keys).
export function normalizeStateShips(state) {
    if (!state || typeof state !== "object")
        return;
    try {
        const ships = Array.isArray(state.ships) ? state.ships : [];
        // Normalize each ship's turret defs
        for (const s of ships) {
            try {
                normalizeTurrets(s);
            }
            catch (e) { }
        }
        // Rebuild shipMap
        try {
            state.shipMap = new Map();
            for (const s of ships)
                if (s && typeof s.id !== "undefined")
                    state.shipMap.set(s.id, s);
        }
        catch (e) { }
        // Recompute teamCounts, preserve red/blue keys default
        try {
            const counts = { red: 0, blue: 0 };
            for (const s of ships) {
                try {
                    const t = String((s && s.team) || "");
                    if (t)
                        counts[t] = (counts[t] || 0) + 1;
                }
                catch (e) { }
            }
            state.teamCounts = counts;
        }
        catch (e) { }
    }
    catch (e) { }
}
const bulletPool = new Pool(() => ({
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    team: TEAM_DEFAULT,
    ownerId: null,
    damage: 0,
    ttl: 0,
    prevX: 0,
    prevY: 0,
    _prevX: 0,
    _prevY: 0,
}), (b) => {
    /* reset */ b.id = 0;
    b.x = 0;
    b.y = 0;
    b.vx = 0;
    b.vy = 0;
    b.team = TEAM_DEFAULT;
    b.ownerId = null;
    b.damage = 0;
    b.ttl = 0;
    b.prevX = 0;
    b.prevY = 0;
    b._prevX = 0;
    b._prevY = 0;
});
export function createBullet(x, y, vx, vy, team = TEAM_DEFAULT, ownerId = null, damage = 1, ttl = 2.0) {
    const b = bulletPool.acquire();
    b.id = genId();
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.team = team;
    b.ownerId = ownerId;
    b.damage = damage;
    b.ttl = ttl;
    b.prevX = x;
    b.prevY = y;
    b._prevX = x;
    b._prevY = y;
    b.alive = true;
    return b;
}
export function releaseBullet(b) {
    try {
        b.alive = false;
    }
    catch { }
    bulletPool.release(b);
}
export function createExplosionEffect(init) {
    return {
        x: init?.x ?? 0,
        y: init?.y ?? 0,
        r: init?.r,
        alive: true,
        _pooled: false,
        ...init,
    };
}
export function resetExplosionEffect(obj, init) {
    obj.x = init?.x ?? 0;
    obj.y = init?.y ?? 0;
    obj.r = init?.r;
    obj.alive = true;
    obj._pooled = false;
    Object.assign(obj, init);
}
export function createShieldHitEffect(init) {
    return {
        x: init?.x ?? 0,
        y: init?.y ?? 0,
        magnitude: init?.magnitude,
        alive: true,
        _pooled: false,
        ...init,
    };
}
export function resetShieldHitEffect(obj, init) {
    obj.x = init?.x ?? 0;
    obj.y = init?.y ?? 0;
    obj.magnitude = init?.magnitude;
    obj.alive = true;
    obj._pooled = false;
    Object.assign(obj, init);
}
export function createHealthHitEffect(init) {
    return {
        x: init?.x ?? 0,
        y: init?.y ?? 0,
        amount: init?.amount,
        alive: true,
        _pooled: false,
        ...init,
    };
}
export function resetHealthHitEffect(obj, init) {
    obj.x = init?.x ?? 0;
    obj.y = init?.y ?? 0;
    obj.amount = init?.amount;
    obj.alive = true;
    obj._pooled = false;
    Object.assign(obj, init);
}
// Provide a default initial GameState for simulation and tests
export function makeInitialState() {
    return {
        t: 0,
        ships: [],
        // fast lookup map kept in sync with ships[] where possible
        shipMap: new Map(),
        // Cached counts per team to avoid per-frame filter allocations
        teamCounts: { red: 0, blue: 0 },
        bullets: [],
        explosions: [],
        shieldHits: [],
        healthHits: [],
        // optional event arrays used by GameState contract
        particles: [],
        flashes: [],
        shieldFlashes: [],
        healthFlashes: [],
        engineTrailsEnabled: true,
        assetPool: {
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
        },
    };
}
// Update team counts safely. oldTeam/newTeam may be undefined when adding or removing.
export function updateTeamCount(state, oldTeam, newTeam) {
    try {
        if (oldTeam) {
            state.teamCounts[oldTeam] = Math.max(0, (state.teamCounts[oldTeam] || 0) - 1);
        }
        if (newTeam) {
            state.teamCounts[newTeam] = (state.teamCounts[newTeam] || 0) + 1;
        }
    }
    catch (e) { }
}
