export const EVASIVE_DURATION = 0.8; // seconds
export const TURN_RATES = { default: 4.0 }; // radians per second typical turn rate
export const EVASIVE_THRUST_MULT = 1.5; // multiplier for thrust during evasive maneuvers
export const SEPARATION_MULT = 0.6; // separation force multiplier between ships
// AI logic thresholds and decision timer
export const AI_THRESHOLDS = {
    decisionTimerMin: 0.5,
    decisionTimerMax: 2.0,
    hpEvadeThreshold: 0.35,
    randomLow: 0.15,
    randomHigh: 0.85,
};
// Ship movement global defaults (used if not per-ship)
export const SHIP_MOVEMENT_DEFAULTS = {
    maxSpeed: 160,
    maxAccel: 5,
};
export default {
    EVASIVE_DURATION,
    TURN_RATES,
    EVASIVE_THRUST_MULT,
    SEPARATION_MULT,
    AI_THRESHOLDS,
    SHIP_MOVEMENT_DEFAULTS,
};
