# Configuration Parameters Documentation

## Magic Numbers Externalization

The following magic numbers have been externalized to configuration files to improve tunability without requiring code changes.

### AI Behavior Configuration (`behaviorConfig.ts`)

#### Combat Range Settings
- `closeRangeMultiplier` (default: 0.6) - Multiplier for close range combat decisions relative to preferred range
- `mediumRangeMultiplier` (default: 1.2) - Multiplier for medium range combat decisions relative to preferred range
- `movementCloseEnoughThreshold` (default: 10) - Distance threshold for considering movement complete
- `friendlyAvoidanceDistance` (default: 80) - Distance ships try to maintain from friendly ships
- `boundarySafetyMargin` (default: 50) - Safety margin from map boundaries in all directions

#### Separation Behavior Clustering Thresholds
These parameters control how ships respond to clustering based on nearby neighbor counts:

- `separationVeryTightCluster` (default: 8) - Neighbor count threshold for very tight clusters
- `separationModerateCluster` (default: 5) - Neighbor count threshold for moderate clusters  
- `separationMildCluster` (default: 3) - Neighbor count threshold for mild clusters
- `separationVeryTightWeight` (default: 5.0) - Weight multiplier applied to very tight clusters
- `separationModerateWeight` (default: 2.0) - Weight multiplier applied to moderate clusters
- `separationMildWeight` (default: 1.2) - Weight multiplier applied to mild clusters

#### Evade Behavior Configuration
These parameters control how ships evaluate and choose escape directions:

- `evadeMaxPitch` (default: π*0.5) - Maximum pitch angle in radians for evade direction sampling (±45°)
- `evadeBaseScore` (default: 100) - Base score for escape position evaluation
- `evadeThreatPenaltyWeight` (default: 0.5) - Weight for threat proximity penalty in scoring
- `evadeBoundaryPenaltyWeight` (default: 2.0) - Weight for boundary proximity penalty in scoring
- `evadeDistanceImprovementWeight` (default: 0.3) - Weight for distance improvement bonus in scoring
- `evadeFriendlyPenaltyWeight` (default: 0.2) - Weight for friendly collision penalty in scoring

### Physics Configuration (`physicsConfig.ts`)

#### World Settings
- `timestep` (default: 1/60) - Physics simulation timestep in seconds
- `maxVelocityIterations` (default: 8) - Maximum velocity constraint iterations per physics step
- `maxPositionIterations` (default: 4) - Maximum position constraint iterations per physics step
- `defaultRaycastDistance` (default: 1000) - Default maximum distance for raycasting operations
- `defaultCollider` (default: {width: 5, height: 2, depth: 5}) - Default collider dimensions when ship class not found

## Usage Examples

### Tuning Combat Behavior
```typescript
// Make ships engage at closer range
config.globalSettings.closeRangeMultiplier = 0.4;

// Make ships more conservative about medium range combat
config.globalSettings.mediumRangeMultiplier = 1.5;
```

### Adjusting Separation Behavior
```typescript
// Reduce clustering by lowering thresholds
config.globalSettings.separationModerateCluster = 3;
config.globalSettings.separationMildCluster = 2;

// Increase separation force for tight clusters
config.globalSettings.separationVeryTightWeight = 8.0;
```

### Modifying Evade Sensitivity
```typescript
// Make evade behavior more sensitive to threats
config.globalSettings.evadeThreatPenaltyWeight = 1.0;

// Reduce boundary avoidance (allow closer to edges)
config.globalSettings.evadeBoundaryPenaltyWeight = 1.0;
```

### Physics Tuning
```typescript
// Higher fidelity physics simulation
config.world.maxVelocityIterations = 12;
config.world.maxPositionIterations = 6;

// Faster physics timestep
config.world.timestep = 1/120; // 120 FPS physics
```

## Testing

Configuration changes can be validated using the test suite in `test/vitest/config-externalization.spec.ts` which verifies that parameter changes produce measurable behavioral differences.

Run specific config tests:
```bash
npx vitest test/vitest/config-externalization.spec.ts
```

## Backward Compatibility

All parameters maintain their original default values, ensuring existing gameplay behavior is preserved while allowing for customization.