import type { ShipClass, Team, Vector3 } from '../types/index.js';

/**
 * AI Behavior Configuration System
 * Defines configurable AI patterns and behaviors for ships
 */

export type AIBehaviorMode =
  | 'aggressive'      // Always pursue and attack nearest enemy
  | 'defensive'       // Prioritize evasion and kiting
  | 'roaming'         // Free movement patterns, occasional combat
  | 'formation'       // Group with friendly ships
  | 'carrier_group'   // Carriers stay with escorts, fighters patrol
  | 'mixed';          // Dynamic behavior selection

export type AIIntent =
  | 'idle'           // No specific action
  | 'pursue'         // Move towards target
  | 'evade'          // Move away from threat
  | 'strafe'         // Circle around target
  | 'group'          // Move towards friendly ships
  | 'patrol'         // Follow patrol pattern
  | 'retreat';       // Move to safe position

export type TurretBehavior =
  | 'independent'    // Each turret targets independently
  | 'synchronized'   // All turrets target same enemy
  | 'lead_target'    // Aim ahead of moving targets
  | 'area_suppression'; // Fire in patterns to suppress areas

export interface AIPersonality {
  /** Base behavior mode */
  mode: AIBehaviorMode;
  /** How often to reevaluate intent (seconds) */
  intentReevaluationRate: number;
  /** Minimum time to maintain current intent */
  minIntentDuration: number;
  /** Maximum time to maintain current intent */
  maxIntentDuration: number;
  /** Aggressiveness (0-1): higher = more likely to engage */
  aggressiveness: number;
  /** Caution (0-1): higher = more likely to evade/retreat */
  caution: number;
  /** Group cohesion (0-1): higher = stronger formation behavior */
  groupCohesion: number;
  /** Preferred engagement range multiplier */
  preferredRangeMultiplier: number;
}

export interface TurretAIConfig {
  /** Turret targeting behavior */
  behavior: TurretBehavior;
  /** How often turrets reevaluate targets (seconds) */
  targetReevaluationRate: number;
  /** Maximum angle difference before switching targets (radians) */
  maxTargetSwitchAngle: number;
  /** Lead target prediction time (seconds) */
  leadPredictionTime: number;
  /** Minimum range before firing */
  minimumFireRange: number;
  /** Maximum range before firing */
  maximumFireRange: number;
}

export interface RoamingPattern {
  /** Pattern type */
  type: 'random' | 'circular' | 'figure_eight' | 'waypoint';
  /** Pattern radius/size */
  radius: number;
  /** Movement speed during roaming */
  speed: number;
  /** How long to maintain pattern before changing */
  duration: number;
  /** Waypoints for waypoint pattern */
  waypoints?: Vector3[];
}

export interface FormationConfig {
  /** Formation type */
  type: 'line' | 'circle' | 'wedge' | 'column' | 'sphere';
  /** Formation spacing */
  spacing: number;
  /** Formation leader (ship ID or null for dynamic) */
  leaderId?: number | null;
  /** Maximum formation size */
  maxSize: number;
  /** How tightly to maintain formation */
  cohesionStrength: number;
}

export interface BehaviorConfig {
  /** Default personality for all ships */
  defaultPersonality: AIPersonality;

  /** Ship-class specific personalities */
  shipPersonalities: Partial<Record<ShipClass, AIPersonality>>;

  /** Team-specific behavior modifiers */
  teamModifiers: Partial<Record<Team, {
    aggressiveness: number;
    caution: number;
    groupCohesion: number;
  }>>;

  /** Turret AI configuration */
  turretConfig: TurretAIConfig;

  /** Roaming patterns */
  roamingPatterns: RoamingPattern[];

  /** Formation configurations */
  formations: Record<string, FormationConfig>;

  /** Global AI settings */
  globalSettings: {
    /** Enable/disable AI completely */
    aiEnabled: boolean;
    /** Maximum ships per formation */
    maxFormationSize: number;
    /** Minimum distance to maintain from enemies */
    minimumSafeDistance: number;
    /** How far to look for formation opportunities */
    formationSearchRadius: number;
    /** Enable dynamic behavior switching */
    enableDynamicBehavior: boolean;
  };
}

/**
 * Default AI personalities for different ship classes
 */
export const DEFAULT_PERSONALITIES: Record<ShipClass, AIPersonality> = {
  fighter: {
    mode: 'aggressive',
    intentReevaluationRate: 0.5,
    minIntentDuration: 2,
    maxIntentDuration: 8,
    aggressiveness: 0.9,
    caution: 0.1,
    groupCohesion: 0.3,
    preferredRangeMultiplier: 0.8
  },
  corvette: {
    mode: 'mixed',
    intentReevaluationRate: 1.0,
    minIntentDuration: 3,
    maxIntentDuration: 12,
    aggressiveness: 0.7,
    caution: 0.3,
    groupCohesion: 0.5,
    preferredRangeMultiplier: 1.0
  },
  frigate: {
    mode: 'formation',
    intentReevaluationRate: 1.5,
    minIntentDuration: 4,
    maxIntentDuration: 15,
    aggressiveness: 0.6,
    caution: 0.4,
    groupCohesion: 0.7,
    preferredRangeMultiplier: 1.2
  },
  destroyer: {
    mode: 'carrier_group',
    intentReevaluationRate: 2.0,
    minIntentDuration: 5,
    maxIntentDuration: 20,
    aggressiveness: 0.5,
    caution: 0.5,
    groupCohesion: 0.8,
    preferredRangeMultiplier: 1.5
  },
  carrier: {
    mode: 'carrier_group',
    intentReevaluationRate: 3.0,
    minIntentDuration: 8,
    maxIntentDuration: 30,
    aggressiveness: 0.3,
    caution: 0.7,
    groupCohesion: 0.9,
    preferredRangeMultiplier: 2.0
  }
};

/**
 * Default turret AI configuration
 */
export const DEFAULT_TURRET_CONFIG: TurretAIConfig = {
  behavior: 'independent',
  targetReevaluationRate: 0.3,
  maxTargetSwitchAngle: Math.PI / 3, // 60 degrees
  leadPredictionTime: 0.5,
  minimumFireRange: 50,
  maximumFireRange: 800
};

/**
 * Default roaming patterns
 */
export const DEFAULT_ROAMING_PATTERNS: RoamingPattern[] = [
  { type: 'random', radius: 200, speed: 50, duration: 10 },
  { type: 'circular', radius: 300, speed: 40, duration: 15 },
  { type: 'figure_eight', radius: 250, speed: 45, duration: 12 }
];

/**
 * Default formation configurations
 */
export const DEFAULT_FORMATIONS: Record<string, FormationConfig> = {
  line: {
    type: 'line',
    spacing: 80,
    leaderId: null,
    maxSize: 8,
    cohesionStrength: 0.7
  },
  circle: {
    type: 'circle',
    spacing: 100,
    leaderId: null,
    maxSize: 12,
    cohesionStrength: 0.8
  },
  wedge: {
    type: 'wedge',
    spacing: 90,
    leaderId: null,
    maxSize: 6,
    cohesionStrength: 0.9
  },
  escort: {
    type: 'sphere',
    spacing: 120,
    leaderId: null,
    maxSize: 4,
    cohesionStrength: 0.95
  }
};

/**
 * Default behavior configuration
 */
export const DEFAULT_BEHAVIOR_CONFIG: BehaviorConfig = {
  defaultPersonality: {
    mode: 'mixed',
    intentReevaluationRate: 1.0,
    minIntentDuration: 3,
    maxIntentDuration: 10,
    aggressiveness: 0.6,
    caution: 0.4,
    groupCohesion: 0.5,
    preferredRangeMultiplier: 1.0
  },
  shipPersonalities: DEFAULT_PERSONALITIES,
  teamModifiers: {
    red: { aggressiveness: 1.1, caution: 0.9, groupCohesion: 1.0 },
    blue: { aggressiveness: 0.9, caution: 1.1, groupCohesion: 1.0 }
  },
  turretConfig: DEFAULT_TURRET_CONFIG,
  roamingPatterns: DEFAULT_ROAMING_PATTERNS,
  formations: DEFAULT_FORMATIONS,
  globalSettings: {
    aiEnabled: true,
    maxFormationSize: 8,
    minimumSafeDistance: 150,
    formationSearchRadius: 500,
    enableDynamicBehavior: true
  }
};

/**
 * Get the effective personality for a ship class, considering team modifiers
 */
export function getEffectivePersonality(
  config: BehaviorConfig,
  shipClass: ShipClass,
  team: Team
): AIPersonality {
  const basePersonality = config.shipPersonalities[shipClass] || config.defaultPersonality;
  const teamModifier = config.teamModifiers[team];

  if (!teamModifier) {
    // Always return a new object for immutability
    return { ...basePersonality };
  }

  const clamp = (value: number) => Math.max(0, Math.min(1, value));

  return {
    ...basePersonality,
    aggressiveness: clamp(basePersonality.aggressiveness * teamModifier.aggressiveness),
    caution: clamp(basePersonality.caution * teamModifier.caution),
    groupCohesion: clamp(basePersonality.groupCohesion * teamModifier.groupCohesion)
  };
}

/**
 * Select a random roaming pattern
 */
export function selectRoamingPattern(config: BehaviorConfig): RoamingPattern {
  return config.roamingPatterns[Math.floor(Math.random() * config.roamingPatterns.length)];
}

/**
 * Get a formation configuration by name
 */
export function getFormationConfig(config: BehaviorConfig, name: string): FormationConfig | undefined {
  return config.formations[name];
}