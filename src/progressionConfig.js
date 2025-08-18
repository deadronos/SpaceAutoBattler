// Progression tuning constants
export const XP_PER_DAMAGE = 0.05; // XP awarded per 1 point of damage dealt
export const KILL_XP_BASE = 20; // flat XP awarded on a kill
export const KILL_XP_PER_TARGET_LEVEL = 0.2; // additional XP per level of the killed target

// XP curve for levels: xpToNext = BASE_XP * growth^(level-1)
export const XP_BASE = 100;
export const XP_GROWTH = 1.35;

// Per-level percent gains (applied multiplicatively per level above 1)
export const HP_PERCENT_PER_LEVEL = 0.10; // +10% HP per level
export const DMG_PERCENT_PER_LEVEL = 0.06; // +6% damage per level
export const SHIELD_PERCENT_PER_LEVEL = 0.08; // +8% shield per level

// Shield regen tuning
export const SHIELD_REGEN_PERCENT = 0.06; // fraction of shieldMax restored per second
export const SHIELD_REGEN_MIN = 0.5; // minimum shield regen per second

// Exports default config object for convenience
export default {
  XP_PER_DAMAGE,
  KILL_XP_BASE,
  KILL_XP_PER_TARGET_LEVEL,
  XP_BASE,
  XP_GROWTH,
  HP_PERCENT_PER_LEVEL,
  DMG_PERCENT_PER_LEVEL,
  SHIELD_PERCENT_PER_LEVEL,
  SHIELD_REGEN_PERCENT,
  SHIELD_REGEN_MIN
};
