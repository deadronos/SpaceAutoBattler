// Core ECS and Physics types
export type {
  RapierModule,
  RapierWorld,
  Collider,
  EventQueue,
  RigidBody,
  EntityId,
  Archetype,
} from './core.js';

// Gameplay types
export type {
  Team,
  ShipHull,
  StatusEffectTag,
  TransformComponent,
  ShipBlueprint,
  MotionStats,
  MotionSmoothingConfig,
  DamageType,
  ShipStats,
  SensorProfile,
} from './gameplay.js';

// Combat types
export type {
  DamageEffectiveness,
  ProjectileComponent,
  TurretSpec,
  TurretState,
  TurretComponent,
  MuzzleFlash,
} from './combat.js';

// Progression types
export type {
  SubsystemType,
  SubsystemStatus,
  MoraleEffectType,
  ProgressionEvent,
  Subsystem,
  ShipLevelBonuses,
  MoraleAbility,
  Captain,
} from './progression.js';

// Ship and Entity types
export type {
  CarrierLaunchSlot,
  CarrierLaunchConfig,
  CarrierComponent,
  ShipComponent,
  ShieldRipple,
  GameEntity,
  ShipEntity,
  ProjectileEntity,
  TurretEntity,
  GameQueries,
} from './ship.js';

// AI types
export type {
  AIIntent,
  AICommand,
  AITraits,
  AIState,
  BehaviorProfile,
  TeamPosture,
  AIBlackboard,
  AITeamAssignments,
  EscortAssignment,
  AIIntentSnapshot,
  PrioritisedTarget,
  AIInterruptReason,
  IntentInterruptEvent,
  AIInterruptState,
  AIShotHistogram,
  AIInBandStats,
  AIInBandSummary,
  AIInBandSummaryByHull,
  AIFirstShotSummary,
  AIOpeningAggressionSummary,
  AIVerticalSummary,
  AIDecisionLatencySummary,
  AIFocusFireSummary,
  AIHeadingAmplitudeSummary,
  AITieSummary,
  AIKpiSummary,
  AIManagerState,
  AIMetrics,
  DoctrineCardId,
  DoctrineCard,
  DoctrineState,
  DoctrineProfileModifiers,
  DoctrineThreatModifiers,
  DoctrineSquadDirectives,
  DoctrineSensorModifiers,
  SensorVisibility,
  SensorState,
} from './ai.js';

// Renderer types
export type { ExplosionEvent, ExplosionConfigEntry } from './renderer.js';

// Simulation types
export type {
  DeferredMutation,
  RapierDiagnostics,
  SimulationClock,
  HudUiFlags,
  GameState,
} from './simulation.js';
