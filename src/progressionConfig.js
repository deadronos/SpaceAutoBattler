// Progression and level-scaling constants used by Ship and progression logic.
// These are conservative defaults intended to match the original design intent.
export const XP_BASE = 100;
export const XP_GROWTH = 1.25; // multiplicative per level

// Percent increases per level (as fractions, e.g. 0.1 == +10% per level)
export const HP_PERCENT_PER_LEVEL = 0.10;
export const DMG_PERCENT_PER_LEVEL = 0.08;
export const SHIELD_PERCENT_PER_LEVEL = 0.06;

// Shield regen: percent of shieldMax per second and minimum regen amount
export const SHIELD_REGEN_PERCENT = 0.015;
export const SHIELD_REGEN_MIN = 0.5;
