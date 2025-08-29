# AI System Architecture and API Boundaries

## Overview

The SpaceAutoBattler AI system has been unified to make `AIController` the single authority for all AI decisions, steering, and movement logic. This document defines the API boundaries between `GameState` and `AIController`.

## API Boundaries

### AIController Responsibilities (Authoritative)

**AI Decision Making:**
- Intent evaluation and selection (pursue, evade, strafe, etc.)
- Personality-based behavior modes (aggressive, defensive, formation, etc.)
- Target acquisition and prioritization
- Turret AI and independent targeting
- Formation and group coordination
- Roaming and patrol patterns

**Movement and Physics:**
- 3D orientation calculations and turn rate limiting
- Velocity updates using forward vectors
- Speed damping and clamping using `PhysicsConfig` constants
- Position integration
- Boundary physics enforcement (`applyBoundaryPhysics`)

**State Management:**
- AI state initialization and maintenance
- Intent timing and duration management
- Recent damage tracking for evasion decisions

### GameState Responsibilities (Plumbing Only)

**State Mutation and Events:**
- Ship creation and spawning (`spawnShip`)
- Health, shield, and level management
- Bullet creation and lifecycle
- Score tracking and kill credit assignment
- XP calculation and level-ups

**Configuration Management:**
- Loading and providing `BehaviorConfig`
- Providing `PhysicsConfig` constants
- Simulation bounds and boundary behavior configuration

**Coordination Functions:**
- Calling `AIController.updateAllShips()` for advanced AI
- Calling `stepShipAI()` for legacy AI (now delegates to AIController)
- Turret firing coordination (`fireTurrets`)
- Bullet physics updates
- Carrier spawning logic

**Utility Functions:**
- Shared boundary physics (`applyBoundaryPhysics`)
- Helper functions like `findNearestEnemy`

## Legacy AI Compatibility

The `stepShipAI` function has been converted to thin delegation that:
1. Sets up minimal AI state for AIController compatibility
2. Uses simple target acquisition logic
3. Delegates all movement to `AIController.updateShipAI()`
4. Handles shield regeneration (not yet moved to AIController)

This ensures:
- **No logic duplication** between AI paths
- **Consistent physics and boundary handling** across all AI modes
- **Single source of truth** for all movement and AI decisions
- **Backward compatibility** for systems that disable advanced AI

## Migration Path

### Current State (After Unification)
- ✅ AIController handles all movement and physics
- ✅ Shared boundary physics function
- ✅ Unified physics constants via `PhysicsConfig`
- ✅ Legacy AI delegates to AIController

### Future Improvements
- Move shield regeneration into AIController for complete unification
- Consider removing legacy AI path entirely if not needed
- Enhance AIController to handle special cases currently in GameState

## Testing

The unification includes comprehensive tests that verify:
- Boundary physics work correctly for both AI paths
- Movement logic produces consistent results
- No regressions in existing AI behavior
- Physics constants are properly unified

See `test/vitest/ai-boundary-physics.spec.ts` for boundary physics validation.