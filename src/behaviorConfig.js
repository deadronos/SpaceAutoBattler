// Tunable behavior constants for ships
export const EVASIVE_DURATION = 1.2; // seconds a ship remains evasive after taking damage

// Turn rates (radians per second) per ship type
export const TURN_RATES = {
  corvette: 6.5,
  frigate: 5.0,
  destroyer: 3.2,
  carrier: 2.0,
  fighter: 8.0
};

// Multipliers for thrust while evasive
export const EVASIVE_THRUST_MULT = 1.2;

// Separation strength multiplier
export const SEPARATION_MULT = 0.6;
