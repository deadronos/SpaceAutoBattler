/**
 * Types of ship subsystems that can be damaged.
 */
export type SubsystemType = 'engine' | 'weapons' | 'shields';

/**
 * Possible operational statuses for a subsystem.
 */
export type SubsystemStatus = 'online' | 'damaged' | 'offline';

/**
 * Types of morale-based status effects.
 */
export type MoraleEffectType = 'aggression_boost' | 'repair_boost' | 'accuracy_boost';

/**
 * Record of a significant event in a ship's progression history.
 */
export interface ProgressionEvent {
  /** Timestamp of the event in epoch ms. */
  ts: number;
  /** The type of event that occurred. */
  type: 'damage' | 'kill' | 'levelup' | 'other';
  /** The amount of XP gained or lost (usually positive). */
  deltaXp?: number;
  /** The source of the event (e.g., attacker ID or weapon name). */
  source?: string;
  /** Additional details or description of the event. */
  details?: string;
}

/**
 * State of a specific subsystem on a ship.
 */
export interface Subsystem {
  /** Current hit points of the subsystem. */
  hp: number;
  /** Maximum hit points of the subsystem. */
  maxHp: number;
  /** Current operational status. */
  status: SubsystemStatus;
  /** Rate at which the subsystem is repaired (hp per second). */
  repairRate: number;
}

/**
 * Cumulative bonuses applied to a ship based on its level.
 */
export interface ShipLevelBonuses {
  /** Bonus multiplier for hull HP. */
  hull: number;
  /** Bonus multiplier for shield capacity. */
  shield: number;
  /** Bonus multiplier for weapon damage. */
  damage: number;
  /** Bonus multiplier for shield regeneration rate. */
  shieldRegen: number;
  /** Bonus multiplier for subsystem repair rate. */
  repairRate: number;
  /** Bonus multiplier for weapon fire rate. */
  fireRate: number;
}

/**
 * Represents a special ability triggered by high morale.
 */
export interface MoraleAbility {
  /** Time remaining in seconds until the ability can be used again. */
  cooldownRemaining: number;
  /** Total cooldown time in seconds. */
  maxCooldown: number;
  /** Duration of the ability effect in seconds. */
  duration: number;
  /** The specific effect provided by the ability. */
  effect: MoraleEffectType;
  /** Whether the ability is currently active. */
  isActive: boolean;
  /** Game time when the active effect will expire. */
  activeUntil: number;
}

/**
 * Represents a captain assigned to a ship, providing bonuses.
 */
export interface Captain {
  /** Multiplier for weapon hit chance (0.8 - 1.2). */
  accuracy: number;
  /** Multiplier for subsystem repair rate (0.8 - 1.2). */
  repairSpeed: number;
  /** Optional morale-based ability possessed by the captain. */
  moraleAbility?: MoraleAbility;
}
