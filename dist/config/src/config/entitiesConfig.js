export const ShipConfig = {
    fighter: {
        maxHp: 15,
        // size classification used for armor/shield tuning
        size: "small",
        armor: 0,
        maxShield: 8,
        shieldRegen: 1.0,
        dmg: 3,
        damage: 3,
        radius: 12,
        cannons: [
            {
                damage: 3,
                rate: 3,
                spread: 0.1,
                muzzleSpeed: 260, // reduced back (/10)
                bulletRadius: 1.5,
                bulletTTL: 1.1, // was 1.2
                // effective range (muzzleSpeed * bulletTTL) scaled to engine units
                range: Math.round(260 * 1.1),
            },
        ],
        // Refined tuning: slightly higher accel and a moderate maxSpeed for clearer motion
        accel: 100, // ~10x accel
        turnRate: 6,
        maxSpeed: 2200, // ~10x maxSpeed
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
        turnRate: 3.5, // was 3
        maxSpeed: 1800, // ~10x increased
        cannons: [
            {
                damage: 6,
                rate: 1.2,
                spread: 0.05,
                muzzleSpeed: 180, // reduced back (/10)
                bulletRadius: 2,
                bulletTTL: 1.8, // was 2.0
                range: Math.round(180 * 1.8),
            },
        ],
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
                rate: 1.0,
                spread: 0.06,
                muzzleSpeed: 180, // reduced back (/10)
                bulletRadius: 2.5,
                bulletTTL: 2.0, // was 2.2
                range: Math.round(180 * 2.0),
            },
        ],
        accel: 70,
        turnRate: 2.5, // was 2.2
        maxSpeed: 1500, // ~10x increased
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
            muzzleSpeed: 160, // reduced back (/10)
            bulletRadius: 2.5,
            bulletTTL: 1.8, // was 2.4
            range: Math.round(160 * 1.8),
        })),
        accel: 60,
        turnRate: 2.0, // was 1.6
        maxSpeed: 1300, // ~10x increased
        turrets: [
            {
                position: [1.2, 0.8],
                kind: "basic",
                targeting: "nearest",
                cooldown: 0.8,
                // turret effective range (units)
                range: 300,
            },
            {
                position: [-1.2, 0.8],
                kind: "basic",
                targeting: "nearest",
                cooldown: 0.8,
            },
            {
                position: [1.2, -0.8],
                kind: "basic",
                targeting: "nearest",
                cooldown: 0.8,
            },
            {
                position: [-1.2, -0.8],
                kind: "basic",
                targeting: "nearest",
                cooldown: 0.8,
            },
            {
                position: [0, 1.5],
                kind: "basic",
                targeting: "nearest",
                cooldown: 0.8,
            },
            {
                position: [0, -1.5],
                kind: "basic",
                targeting: "nearest",
                cooldown: 0.8,
            },
        ],
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
            muzzleSpeed: 140, // reduced back (/10)
            bulletRadius: 3,
            bulletTTL: 2.2, // was 2.8
            range: Math.round(140 * 2.2),
        })),
        accel: 55,
        turnRate: 1.2, // was 0.8
        maxSpeed: 1100, // ~10x increased
        carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
        turrets: [
            {
                position: [2.0, 1.2],
                kind: "basic",
                targeting: "nearest",
                cooldown: 1.0,
                range: 300,
            },
            {
                position: [-2.0, 1.2],
                kind: "basic",
                targeting: "nearest",
                cooldown: 1.0,
            },
            {
                position: [2.0, -1.2],
                kind: "basic",
                targeting: "nearest",
                cooldown: 1.0,
            },
            {
                position: [-2.0, -1.2],
                kind: "basic",
                targeting: "nearest",
                cooldown: 1.0,
            },
        ],
    },
};
// Per-size defaults to provide consistent tuning shortcuts. These values are
// applied when a ShipTypeCfg omits explicit armor/shield tuning. They make it
// easy to adjust broad balance by class (small/medium/large) in one place.
export const SIZE_DEFAULTS = {
    small: {
        armor: 0,
        maxShield: 8,
        shieldRegen: 1.0,
        radius: 12,
        turnRate: 6,
        accel: 100,
        maxSpeed: 2200,
    },
    medium: {
        armor: 1,
        maxShield: 40,
        shieldRegen: 0.5,
        radius: 24,
        turnRate: 3.5,
        accel: 80,
        maxSpeed: 1800,
    },
    large: {
        armor: 2,
        maxShield: 120,
        shieldRegen: 0.25,
        radius: 40,
        turnRate: 2.0,
        accel: 60,
        maxSpeed: 1300,
    },
};
export function getSizeDefaults(size) {
    return SIZE_DEFAULTS[size] || SIZE_DEFAULTS.small;
}
// Runtime configuration helpers: update per-size defaults in-place.
export function setSizeDefaults(size, patch) {
    SIZE_DEFAULTS[size] = Object.assign({}, SIZE_DEFAULTS[size], patch);
}
export function setAllSizeDefaults(patch) {
    SIZE_DEFAULTS.small = Object.assign({}, SIZE_DEFAULTS.small, patch);
    SIZE_DEFAULTS.medium = Object.assign({}, SIZE_DEFAULTS.medium, patch);
    SIZE_DEFAULTS.large = Object.assign({}, SIZE_DEFAULTS.large, patch);
}
// NOTE: The factory that creates Ship objects (`createShip` in src/entities.ts)
// enforces a positive fallback for `maxSpeed` when the config is missing or
// set to 0. This guards against malformed saved state or partial config
// payloads which would otherwise clamp ship velocity to 0 and prevent
// translation while still allowing rotation/firing (a common source of
// confusing "ships rotate and shoot but don't move" bugs).
export function getShipConfig() {
    // Normalize weapon ranges at runtime so configs may omit 'range'.
    // For cannons: range = Math.round(muzzleSpeed * bulletTTL) or BULLET_DEFAULTS.range
    // For turrets: if missing, inherit first cannon range or BULLET_DEFAULTS.range
    Object.keys(ShipConfig).forEach((key) => {
        const cfg = ShipConfig[key];
        if (cfg.cannons) {
            cfg.cannons.forEach((c) => {
                if (c.range == null) {
                    const ms = c.muzzleSpeed ?? BULLET_DEFAULTS.muzzleSpeed;
                    const ttl = c.bulletTTL ?? BULLET_DEFAULTS.ttl;
                    const computed = Number.isFinite(ms) && Number.isFinite(ttl)
                        ? Math.round(ms * ttl)
                        : BULLET_DEFAULTS.range;
                    c.range = computed || BULLET_DEFAULTS.range;
                }
            });
        }
        // Turret range fallback: prefer existing turret.range, else try first cannon, else BULLET_DEFAULTS.range
        if (cfg.turrets) {
            const firstCannonRange = cfg.cannons && cfg.cannons.length
                ? cfg.cannons[0].range || BULLET_DEFAULTS.range
                : BULLET_DEFAULTS.range;
            cfg.turrets.forEach((t) => {
                if (t.range == null) {
                    t.range = firstCannonRange;
                }
            });
        }
    });
    return ShipConfig;
}
// Bullet global defaults (used if not per-ship)
export const BULLET_DEFAULTS = {
    damage: 1,
    ttl: 2.0,
    radius: 1.5,
    muzzleSpeed: 24,
    // default effective range (units)
    range: 300,
};
// Particle defaults (used for generic effects)
export const PARTICLE_DEFAULTS = {
    ttl: 1,
    color: "#fff",
    size: 2,
};
// Team fallback default
export function bulletKindForRadius(r) {
    if (r < 2)
        return "small";
    if (r < 2.5)
        return "medium";
    if (r < 3.5)
        return "large";
    return "heavy";
}
export function getDefaultShipType() {
    return Object.keys(ShipConfig)[0] || "fighter";
}
export default ShipConfig;
if (typeof module !== "undefined" && module.exports) {
    // assign named exports to module.exports for CommonJS consumers
    try {
        const existing = module.exports || {};
        Object.defineProperty(existing, "ShipConfig", {
            value: ShipConfig,
            enumerable: true,
        });
        Object.defineProperty(existing, "getShipConfig", {
            value: getShipConfig,
            enumerable: true,
        });
        Object.defineProperty(existing, "SIZE_DEFAULTS", {
            value: SIZE_DEFAULTS,
            enumerable: true,
        });
        Object.defineProperty(existing, "getSizeDefaults", {
            value: getSizeDefaults,
            enumerable: true,
        });
        Object.defineProperty(existing, "setSizeDefaults", {
            value: setSizeDefaults,
            enumerable: true,
        });
        Object.defineProperty(existing, "setAllSizeDefaults", {
            value: setAllSizeDefaults,
            enumerable: true,
        });
        Object.defineProperty(existing, "BULLET_DEFAULTS", {
            value: BULLET_DEFAULTS,
            enumerable: true,
        });
        Object.defineProperty(existing, "PARTICLE_DEFAULTS", {
            value: PARTICLE_DEFAULTS,
            enumerable: true,
        });
        Object.defineProperty(existing, "bulletKindForRadius", {
            value: bulletKindForRadius,
            enumerable: true,
        });
        Object.defineProperty(existing, "getDefaultShipType", {
            value: getDefaultShipType,
            enumerable: true,
        });
        // ensure default also exists without reassigning module.exports entirely
        try {
            Object.defineProperty(existing, "default", {
                value: ShipConfig,
                enumerable: true,
            });
        }
        catch (e) { }
        // merge back to module.exports if possible
        try {
            module.exports = existing;
        }
        catch (e) { }
    }
    catch (e) { }
}
