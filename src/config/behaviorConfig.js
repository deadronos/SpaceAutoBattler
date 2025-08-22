// Copied from spec/behaviorConfig.js - Behavior tuning constants used by Ship AI and movement code.
export const EVASIVE_DURATION = 0.8; // seconds
export const TURN_RATES = {
  default: 4.0, // radians per second typical turn rate
};
export const EVASIVE_THRUST_MULT = 1.5; // multiplier for thrust during evasive maneuvers
export const SEPARATION_MULT = 0.6; // separation force multiplier between ships

export default { EVASIVE_DURATION, TURN_RATES, EVASIVE_THRUST_MULT, SEPARATION_MULT };
