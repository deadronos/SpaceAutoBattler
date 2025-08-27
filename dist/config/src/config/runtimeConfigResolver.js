// Centralized runtime config resolver for ESM/CJS interop safety
// Provides safe accessors used by hot paths to avoid partial module init and drift
// Prefer a direct ESM import when available so bundlers include the config
// and the resolver works in browsers without Node's require.
import * as EntitiesConfigESM from "./entitiesConfig";
// ESM-safe require using Node's createRequire
let __nodeRequire;
try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { createRequire } = require("module");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    __nodeRequire = createRequire(typeof import.meta !== "undefined" ? import.meta.url : __filename);
}
catch (e) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createRequire } = require("module");
        __nodeRequire = createRequire(__filename);
    }
    catch (e2) { }
}
export function getRuntimeEntitiesModule() {
    // Memoize the successfully resolved module to avoid repeated require calls
    // across hot paths.
    // Use closure-scoped cache to preserve behavior within the same process.
    // Only cache on success so that if resolution fails once during early init,
    // subsequent calls can retry.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - attach a hidden cache symbol on the function object
    const cacheKey = "__cachedModule";
    try {
        // Use eager ESM import if present
        try {
            const esmMod = EntitiesConfigESM || {};
            if (esmMod && Object.keys(esmMod).length) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                getRuntimeEntitiesModule[cacheKey] = esmMod;
                return esmMod;
            }
        }
        catch { }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (getRuntimeEntitiesModule[cacheKey])
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return getRuntimeEntitiesModule[cacheKey];
    }
    catch { }
    try {
        if (__nodeRequire) {
            try {
                const mod = __nodeRequire("./entitiesConfig");
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                getRuntimeEntitiesModule[cacheKey] = mod;
                return mod;
            }
            catch { }
        }
    }
    catch { }
    try {
        const mod = __nodeRequire ? __nodeRequire("./entitiesConfig.ts") : undefined;
        if (mod) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeEntitiesModule[cacheKey] = mod;
            return mod;
        }
    }
    catch { }
    try {
        const mod = __nodeRequire ? __nodeRequire("./entitiesConfig.js") : undefined;
        if (mod) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeEntitiesModule[cacheKey] = mod;
            return mod;
        }
    }
    catch { }
    return undefined;
}
export function getRuntimeShipConfigSafe() {
    // Return memoized config if available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const cfgKey = "__cachedShipConfig";
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (getRuntimeShipConfigSafe[cfgKey])
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return getRuntimeShipConfigSafe[cfgKey];
    }
    catch { }
    // Try named getter first to ensure ranges are normalized
    try {
        const mod = getRuntimeEntitiesModule() || {};
        if (typeof mod.getShipConfig === "function") {
            const cfg = mod.getShipConfig();
            if (cfg && Object.keys(cfg).length) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                getRuntimeShipConfigSafe[cfgKey] = cfg;
                return cfg;
            }
        }
        if (mod.ShipConfig && Object.keys(mod.ShipConfig).length) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeShipConfigSafe[cfgKey] = mod.ShipConfig;
            return mod.ShipConfig;
        }
        if (mod.default && Object.keys(mod.default).length) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeShipConfigSafe[cfgKey] = mod.default;
            return mod.default;
        }
        if (mod && Object.keys(mod).length) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeShipConfigSafe[cfgKey] = mod;
            return mod;
        }
    }
    catch { }
    // Last-resort minimal set (fighter + carrier so carrier features work)
    // IMPORTANT: Do not cache fallback. If early resolution fails during init,
    // we want later calls to retry and obtain the full config when available.
    const fallback = {
        fighter: {
            size: "small",
            maxHp: 10,
            maxShield: 8,
            shieldRegen: 1,
            accel: 100,
            turnRate: 6,
            radius: 12,
            maxSpeed: 2200,
            cannons: [{ damage: 3, rate: 3, muzzleSpeed: 260, bulletTTL: 1.1 }],
        },
        carrier: {
            size: "large",
            maxHp: 50,
            armor: 2,
            maxShield: 30,
            shieldRegen: 0.3,
            radius: 40,
            accel: 60,
            turnRate: 1.5,
            maxSpeed: 1200,
            cannons: [{ damage: 2, rate: 0.8, muzzleSpeed: 140, bulletTTL: 2.0 }],
            carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
            turrets: [{ position: [2.0, 1.2], kind: "basic" }],
        },
    };
    return fallback;
}
export function getRuntimeSizeDefaultsSafe(size) {
    // Memoize per-size lookups to avoid repeated module calls
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const sizeCacheKey = "__cachedSizeDefaults";
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const cache = getRuntimeSizeDefaultsSafe[sizeCacheKey] || new Map();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        getRuntimeSizeDefaultsSafe[sizeCacheKey] = cache;
        if (cache.has(size))
            return cache.get(size);
    }
    catch { }
    try {
        const mod = getRuntimeEntitiesModule() || {};
        let val = {};
        if (typeof mod.getSizeDefaults === "function")
            val = mod.getSizeDefaults(size);
        else if (mod.default && typeof mod.default.getSizeDefaults === "function")
            val = mod.default.getSizeDefaults(size);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const cache = getRuntimeSizeDefaultsSafe[sizeCacheKey] || new Map();
        cache.set(size, val || {});
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        getRuntimeSizeDefaultsSafe[sizeCacheKey] = cache;
        return val || {};
    }
    catch { }
    return {};
}
export function getRuntimeBulletDefaultsSafe() {
    // Memoize bullet defaults
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const bulletKey = "__cachedBulletDefaults";
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (getRuntimeBulletDefaultsSafe[bulletKey])
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return getRuntimeBulletDefaultsSafe[bulletKey];
    }
    catch { }
    try {
        const mod = getRuntimeEntitiesModule() || {};
        if (mod && mod.BULLET_DEFAULTS) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeBulletDefaultsSafe[bulletKey] = mod.BULLET_DEFAULTS;
            return mod.BULLET_DEFAULTS;
        }
        if (mod && mod.default && mod.default.BULLET_DEFAULTS) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            getRuntimeBulletDefaultsSafe[bulletKey] = mod.default.BULLET_DEFAULTS;
            return mod.default.BULLET_DEFAULTS;
        }
    }
    catch { }
    const fallback = { damage: 1, ttl: 2.0, radius: 1.5, muzzleSpeed: 24, range: 300 };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    getRuntimeBulletDefaultsSafe[bulletKey] = fallback;
    return fallback;
}
// Shared helper: choose a default ship type safely across module systems.
// Returns the first key of the runtime ship config map, or 'fighter' as a fallback.
export function getDefaultShipTypeSafe() {
    try {
        const cfg = getRuntimeShipConfigSafe();
        const keys = Object.keys(cfg || {});
        return keys.length ? keys[0] : "fighter";
    }
    catch (e) {
        return "fighter";
    }
}
