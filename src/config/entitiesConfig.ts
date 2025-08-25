// entitiesConfig.ts - ship-type defaults and visuals helpers (typed)
//
// Tuning rationale (2025-08-24):
// - Playfield size: 1920x1080
// - Ship speeds (maxSpeed, accel): Higher speed enables kiting and rapid repositioning; slower ships are easier to flank.
// - Turn rates (turnRate): Higher turn rate allows ships to evade, flank, and respond to threats quickly; low turn rate makes ships vulnerable to flanking.
// - Weapon ranges (muzzleSpeed * bulletTTL): Longer range supports kiting and edge play; shorter range requires close engagement and rewards flanking.
// - Weapon rate (rate): Higher fire rate enables sustained pressure and kiting; lower rate rewards timing and positioning.
// - Ship radius: Larger ships are easier to hit and harder to flank; smaller ships excel at flanking and evasion.
// - Boundary options (see simConfig.ts): Enable edge play (wrap, bounce, remove) for tactical escapes and repositioning.
// - See patch history for details
import {
  getShipAsset,
  getBulletAsset,
  getTurretAsset,
} from "./assets/assetsConfig";

// CannonCfg parameters and tactical impact:
// - damage: Higher damage increases threat, rewards flanking and burst attacks.
// - rate: Higher rate supports kiting and pressure; lower rate rewards timing.
// - spread: More spread makes weapons less accurate, favors close-range flanking.
// - muzzleSpeed: Higher speed increases range and kiting potential.
// - bulletRadius: Larger radius makes shots easier to land, favors area denial.
// - bulletTTL: Longer TTL increases range, supports edge play and kiting.
export type CannonCfg = {
  damage: number;
  rate: number;
  spread?: number;
  muzzleSpeed?: number;
  bulletRadius?: number;
  bulletTTL?: number;
};

// ShipTypeCfg parameters and tactical impact:
// - maxHp, armor, maxShield: Higher values increase survivability, allow for riskier flanking and edge play.
// - shieldRegen: Faster regen supports hit-and-run and kiting.
// - damage/dmg: Higher damage rewards successful flanking and burst attacks.
// - radius: Smaller radius makes ships harder to hit and better at flanking; larger radius increases vulnerability.
// - cannons: Weapon loadout affects tactical options (see CannonCfg).
// - accel: Higher acceleration enables rapid repositioning and kiting.
// - turnRate: Higher turn rate allows for quick flanking, evasion, and edge play.
// - maxSpeed: Higher speed supports kiting and edge escapes; lower speed makes ships easier to pursue and flank.
// - turrets: Multiple turrets increase area control, make flanking harder.
// - friction: Lower friction (closer to 1) enables sustained velocity for kiting and edge play; higher friction increases tactical vulnerability to pursuit and flanking.
// All entities and events are pruned immediately upon destruction or expiration, ensuring tactical scenarios remain robust and consistent.
export type ShipTypeCfg = {
  maxHp: number;
  armor?: number;
  maxShield?: number;
  shieldRegen?: number;
  dmg?: number;
  damage?: number;
  radius?: number;
  cannons?: CannonCfg[];
  accel?: number;
  turnRate?: number;
  maxSpeed?: number;
  carrier?: {
    fighterCooldown: number;
    maxFighters: number;
    spawnPerCooldown: number;
  };
  turrets?: Array<{
    position: [number, number]; // relative to ship center, in radius units
    kind: string; // turret asset kind
    targeting?: "nearest" | "random" | "focus" | "custom"; // targeting logic
    cooldown?: number; // seconds between shots
    lastFired?: number; // timestamp of last shot
  }>;
};

export type ShipConfigMap = Record<string, ShipTypeCfg>;

export const ShipConfig: ShipConfigMap = {
  fighter: {
    maxHp: 15,
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
        },
      ],
    // Refined tuning: slightly higher accel and a moderate maxSpeed for clearer motion
      accel: 100, // ~10x accel
      turnRate: 6,
      maxSpeed: 2200, // ~10x maxSpeed
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
      },
    ],
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
        rate: 1.0,
        spread: 0.06,
    muzzleSpeed: 180, // reduced back (/10)
        bulletRadius: 2.5,
        bulletTTL: 2.0, // was 2.2
      },
    ],
      accel: 70,
      turnRate: 2.5, // was 2.2
      maxSpeed: 1500, // ~10x increased
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
    muzzleSpeed: 160, // reduced back (/10)
      bulletRadius: 2.5,
      bulletTTL: 1.8, // was 2.4
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
// NOTE: The factory that creates Ship objects (`createShip` in src/entities.ts)
// enforces a positive fallback for `maxSpeed` when the config is missing or
// set to 0. This guards against malformed saved state or partial config
// payloads which would otherwise clamp ship velocity to 0 and prevent
// translation while still allowing rotation/firing (a common source of
// confusing "ships rotate and shoot but don't move" bugs).
export function getShipConfig() {
  return ShipConfig;
}

// Bullet global defaults (used if not per-ship)
export const BULLET_DEFAULTS = {
  damage: 1,
  ttl: 2.0,
  radius: 1.5,
  muzzleSpeed: 24,
};

// Particle defaults (used for generic effects)
export const PARTICLE_DEFAULTS = {
  ttl: 1,
  color: "#fff",
  size: 2,
};

// Team fallback default

export function bulletKindForRadius(r: number): string {
  if (r < 2) return "small";
  if (r < 2.5) return "medium";
  if (r < 3.5) return "large";
  return "heavy";
}

export function getDefaultShipType(): string {
  return Object.keys(ShipConfig)[0] || "fighter";
}

export default ShipConfig;
