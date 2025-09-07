import type { ShipClass, Team, Vector3, RNG } from '../types/index.js';

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
  | 'explore'        // Scout map for enemies
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
  /** Optional dynamic behavior switching configuration */
  dynamicSwitch?: {
    /** Enable dynamic per-turret behavior switching */
    enabled: boolean;
    /** Minimum duration for a chosen behavior (seconds) */
    minDuration: number;
    /** Maximum duration for a chosen behavior (seconds) */
    maxDuration: number;
    /** Weighted options for behaviors to pick from when switching */
    options?: Array<{
      behavior: TurretBehavior;
      weight: number;
    }>;
  };
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
    
    // Combat range and engagement settings
    /** Multiplier for close range combat (default: 0.6) */
    closeRangeMultiplier: number;
    /** Multiplier for medium range combat (default: 1.2) */
    mediumRangeMultiplier: number;
    /** Distance threshold for movement completion (default: 10) */
    movementCloseEnoughThreshold: number;
    /** Distance to project forward for orientation calculation (default: 100) */
    orientationProjectionDistance: number;
    /** Distance to avoid friendly ships (default: 80) */
    friendlyAvoidanceDistance: number;
    /** Safety margin from boundaries (default: 50) */
    boundarySafetyMargin: number;
    
    // Separation behavior clustering thresholds
    /**
     * Maximum seconds into the future the turret intercept solver will consider.
     * This prevents aiming at extremely far-future intercept points for very slow projectiles
     * or pathological geometry. Can be tuned globally by designers.
     */
    maxInterceptLookahead: number;
    /** Neighbor count for very tight clusters (default: 8) */
    separationVeryTightCluster: number;
    /** Neighbor count for moderate clusters (default: 5) */
    separationModerateCluster: number;
    /** Neighbor count for mild clusters (default: 3) */
    separationMildCluster: number;
    /** Weight multiplier for very tight clusters (default: 5.0) */
    separationVeryTightWeight: number;
    /** Weight multiplier for moderate clusters (default: 2.0) */
    separationModerateWeight: number;
    /** Weight multiplier for mild clusters (default: 1.2) */
    separationMildWeight: number;
    
    // Evade behavior settings
    /** Maximum pitch angle for evade sampling in radians (default: PI * 0.5) */
    evadeMaxPitch: number;
    /** Base score for escape position calculation (default: 100) */
    evadeBaseScore: number;
    /** Weight for threat proximity penalty (default: 0.5) */
    evadeThreatPenaltyWeight: number;
    /** Weight for boundary proximity penalty (default: 2.0) */
    evadeBoundaryPenaltyWeight: number;
    /** Weight for distance improvement bonus (default: 0.3) */
    evadeDistanceImprovementWeight: number;
    /** Weight for friendly collision penalty (default: 0.2) */
    evadeFriendlyPenaltyWeight: number;
    
    // Existing separation and damage settings
    /** Distance within which separation forces apply */
    separationDistance: number;
    /** Weight of separation force relative to desired movement */
    separationWeight: number;
    /** Minimum separation between roaming anchors */
    roamingAnchorMinSeparation: number;
    /** Damage threshold to trigger evade behavior */
    damageEvadeThreshold: number;
    /** Rate at which recent damage decays per second */
    damageDecayRate: number;
    /** Number of candidate directions to sample for evade */
    evadeSamplingCount: number;
    /** Distance to move when evading */
    evadeDistance: number;
    /** Only allow evade behavior when ship has recently taken damage */
    evadeOnlyOnDamage: boolean;
    /** Time window (seconds) during which recent damage allows evade behavior */
    evadeRecentDamageWindowSeconds: number;
    /** Window (seconds) during which the last damager is eligible for kill credit */
    killCreditWindowSeconds: number;
    /** Enable periodic boundary cleanup (teleport/prune out-of-bounds entities) */
    enableBoundaryCleanup: boolean;
    /** Interval in sim ticks between boundary cleanup runs (default ~600 ticks = 10s at 60tps) */
    boundaryCleanupIntervalTicks: number;
    /** Toggle small deterministic spawn-time velocity jitter to break perfect symmetry */
    enableSpawnJitter: boolean;
    /** Short duration for damage-based evade intent (seconds) */
    intentDurationDamageEvade: number;
    /** Probability for group intent in defensive mode */
    probabilityGroupDefensive: number;
    /** Range multiplier for evade threat search */
    rangeMultiplierEvade: number;
    /** Penalty base for proximity to threat in escape scoring */
    penaltyThreat: number;
    /** Fraction of separationDistance for idle nudge */
    displacementIdleSeparation: number;
    /** Divisor for scaling idle nudge by neighbor count */
    neighborCountIdleNudgeDivisor: number;
    /** Radius for strafe movement (units) */
    strafeRadius: number;
    /** Radius to find friends for group behavior (units) */
    groupFriendRadius: number;
    /** Minimum ships for circle formation */
    formationMinGroupSize: number;
    /** Max attempts for roaming anchor assignment */
    roamingAnchorMaxAttempts: number;
    /** Threshold for releasing roaming anchor (distance) */
    roamingAnchorDistanceThreshold: number;
    /** Threshold for formation slot assignment (distance) */
    formationSlotDistanceThreshold: number;
    /** Magnitude threshold for separation vector normalization */
    separationVectorMagnitudeThreshold: number;
    /** Enable spatial index for AI proximity queries (faster neighbor/target searches) */
    enableSpatialIndex: boolean;
    /** Enable scout behavior - at least one ship per team always pursues nearest enemy */
    enableScoutBehavior: boolean;
    /** Enable alarm system - when friendlies take damage, all idle/strafing ships pursue */
    enableAlarmSystem: boolean;
    /** Time window (seconds) during which alarm system activates team-wide pursuit */
    alarmSystemWindowSeconds: number;
    /** Enable map exploration for scouts when no enemies are visible */
    enableScoutExploration: boolean;
    /** Number of exploration zones to divide the map into */
    explorationZoneCount: number;
    /** Time to spend exploring each zone before moving to the next */
    explorationZoneDuration: number;
    /** Feature flag: allow decisionEngine to influence intent selection (incremental rollout) */
    useDecisionEngineEvadeGate?: boolean;
    /** Feature flag: use extracted turret targeting helper instead of legacy inline logic */
    useTurretTargetingHelper?: boolean;
    /**
     * Per-level accuracy reduction applied to turret inaccuracy.
     * Each level reduces inaccuracy by this fraction (e.g., 0.02 = 2% per level).
     */
    turretLevelAccuracyPerLevel?: number;
    /**
     * Maximum fraction reduction of inaccuracy from leveling (clamped).
     * For example 0.5 means levels can reduce up to 50% of base inaccuracy.
     */
    turretLevelAccuracyMaxReduction?: number;
    /** Threshold for switching targets (0-1), lower is more 'sticky' */
    targetSwitchThreshold?: number;
  };
}

/**
 * Default AI personalities for different ship classes
 */
export const DEFAULT_PERSONALITIES: Record<ShipClass, AIPersonality> = {
  fighter: {
    mode: 'aggressive',
    intentReevaluationRate: 0.3,
    minIntentDuration: 0.3,
    maxIntentDuration: 1,
    aggressiveness: 0.9,
    caution: 0.1,
    groupCohesion: 0.3,
    preferredRangeMultiplier: 0.8
  },
  corvette: {
    mode: 'aggressive',
    intentReevaluationRate: 0.3,
    minIntentDuration: 0.3,
    maxIntentDuration: 1,
    aggressiveness: 0.7,
    caution: 0.3,
    groupCohesion: 0.5,
    preferredRangeMultiplier: 1.0
  },
  frigate: {
    mode: 'aggressive',
    intentReevaluationRate: 0.3,
    minIntentDuration: 0.3,
    maxIntentDuration: 1,
    aggressiveness: 0.6,
    caution: 0.4,
    groupCohesion: 0.7,
    preferredRangeMultiplier: 1.2
  },
  destroyer: {
    mode: 'mixed',
    intentReevaluationRate: 0.3,
    minIntentDuration: 0.3,
    maxIntentDuration: 1,
    aggressiveness: 0.5,
    caution: 0.5,
    groupCohesion: 0.8,
    preferredRangeMultiplier: 1.5
  },
  carrier: {
    mode: 'mixed',
    intentReevaluationRate: 0.3,
    minIntentDuration: 0.3,
    maxIntentDuration: 1,
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
  ,
  // Dynamic switching is disabled by default to preserve existing behavior
  dynamicSwitch: {
    enabled: true,
    minDuration: 0.2,
    maxDuration: 2.0,
    options: [
      { behavior: 'independent', weight: 50 },
      { behavior: 'synchronized', weight: 20 },
      { behavior: 'lead_target', weight: 20 },
      { behavior: 'area_suppression', weight: 10 }
    ]
  }
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
    intentReevaluationRate: 0.5,
    minIntentDuration: 3,
    maxIntentDuration: 10,
    aggressiveness: 0.8,
    caution: 0.4,
    groupCohesion: 0.5,
    preferredRangeMultiplier: 1.0
  },
  shipPersonalities: DEFAULT_PERSONALITIES,
  teamModifiers: {
    red: { aggressiveness: 1.1, caution: 0.9, groupCohesion: 0.8 },
    blue: { aggressiveness: 0.9, caution: 1.1, groupCohesion: 0.8 }
  },
  turretConfig: DEFAULT_TURRET_CONFIG,
  roamingPatterns: DEFAULT_ROAMING_PATTERNS,
  formations: DEFAULT_FORMATIONS,
  globalSettings: {
    aiEnabled: true,
    maxFormationSize: 8,
    minimumSafeDistance: 10,
    formationSearchRadius: 500,
    enableDynamicBehavior: true,
    closeRangeMultiplier: 0.6,
    mediumRangeMultiplier: 1.2,
    movementCloseEnoughThreshold: 10,
    orientationProjectionDistance: 100,
    friendlyAvoidanceDistance: 80,
    boundarySafetyMargin: 50,
    separationVeryTightCluster: 8,
    separationModerateCluster: 5,
    separationMildCluster: 3,
    separationVeryTightWeight: 5.0,
    separationModerateWeight: 2.0,
    separationMildWeight: 1.2,
    separationDistance: 120,
    separationWeight: 0.3,
    roamingAnchorMinSeparation: 150,
    killCreditWindowSeconds: 5,
    enableBoundaryCleanup: true,
    boundaryCleanupIntervalTicks: 600,
    enableSpawnJitter: true,
    intentDurationDamageEvade: 3.0,
    probabilityGroupDefensive: 0.7,
    rangeMultiplierEvade: 1.5,
    penaltyThreat: 200,
    displacementIdleSeparation: 0.05,
    neighborCountIdleNudgeDivisor: 5,
    strafeRadius: 150,
    groupFriendRadius: 300,
    formationMinGroupSize: 3,
    roamingAnchorMaxAttempts: 20,
    roamingAnchorDistanceThreshold: 1.0,
    formationSlotDistanceThreshold: 1.0,
    separationVectorMagnitudeThreshold: 0.0001,
    damageEvadeThreshold: 0.2,
    damageDecayRate: 0.5,
    evadeSamplingCount: 8,
    evadeDistance: 200,
    evadeOnlyOnDamage: false,
    evadeRecentDamageWindowSeconds: 2.0,
    evadeBaseScore: 100,
    evadeThreatPenaltyWeight: 0.5,
    evadeBoundaryPenaltyWeight: 2.0,
    evadeDistanceImprovementWeight: 0.3,
    evadeFriendlyPenaltyWeight: 0.2,
    evadeMaxPitch: Math.PI * 0.5,
    enableSpatialIndex: true,
    enableScoutBehavior: true,
    enableAlarmSystem: true,
    alarmSystemWindowSeconds: 5.0,
    enableScoutExploration: true,
    explorationZoneCount: 6,
    explorationZoneDuration: 8.0
    ,
    // Feature flag default: keep disabled to ensure zero behavior change unless explicitly enabled
    useDecisionEngineEvadeGate: true,
    // Turret targeting helper enabled by default after parity testing
    useTurretTargetingHelper: true,
  // Per-level accuracy scaling: each level reduces inaccuracy by 2%, up to 50%
  turretLevelAccuracyPerLevel: 0.02,
  turretLevelAccuracyMaxReduction: 0.5,
  targetSwitchThreshold: 0.8,
    /**
     * Maximum seconds into the future the turret intercept solver will consider.
     * This prevents aiming at extremely far-future intercept points for very slow projectiles
     * or pathological geometry. Can be tuned globally by designers.
     */
    maxInterceptLookahead: 5.0
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
export function selectRoamingPattern(config: BehaviorConfig, rng: RNG): RoamingPattern {
  const idx = rng.int(0, config.roamingPatterns.length - 1);
  return config.roamingPatterns[idx];
}

/**
 * Get a formation configuration by name
 */
export function getFormationConfig(config: BehaviorConfig, name: string): FormationConfig | undefined {
  return config.formations[name];
}
