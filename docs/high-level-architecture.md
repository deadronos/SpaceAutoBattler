# SpaceAutoBattler: High-Level Architecture Analysis

**Document Version:** 1.0  
**Analysis Date:** November 24, 2025  
**Codebase Version:** Development (dev branch)

## Executive Summary

SpaceAutoBattler is a deterministic 3D space combat auto-battler built with React Three Fiber, Rapier3D physics, and a custom Entity Component System (Miniplex). The architecture demonstrates strong separation of concerns between simulation and rendering, with a well-designed deterministic core suitable for testing and replay functionality.

### Overall Architecture Rating: **B+ (Good)**

| Category              | Rating | Notes                                        |
| --------------------- | ------ | -------------------------------------------- |
| Code Organization     | A-     | Excellent module structure, clear boundaries |
| Determinism & Testing | A      | Strong RNG discipline, testable design       |
| Physics Integration   | B+     | Safe mutation patterns, good error handling  |
| Rendering Pipeline    | B      | Effective instancing, some complexity        |
| AI System             | B+     | Sophisticated intent-based design            |
| Type Safety           | A-     | Comprehensive typing, some `any` fallbacks   |
| Performance Patterns  | B      | Good instancing, room for optimization       |
| Documentation         | B+     | Good inline docs, existing ARCHITECTURE.md   |
| Error Handling        | B-     | Defensive try-catch, inconsistent patterns   |
| Extensibility         | A-     | Well-defined extension points                |

---

## 1. Core Architecture Overview

### 1.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  React UI   │  │   R3F/drei  │  │  Postprocessing (pmndrs)│  │
│  │ (Controls,  │  │ (Canvas,    │  │  (Bloom, FXAA, Tone)    │  │
│  │  HUD, etc.) │  │  3D Scene)  │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                            ↓ Read-only                          │
├─────────────────────────────────────────────────────────────────┤
│                       STATE LAYER                               │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │    GameState         │  │       UI Store (Zustand)        │  │
│  │  - ECS World         │  │  - Pause/TimeScale             │  │
│  │  - Physics World     │  │  - Feature Toggles             │  │
│  │  - AI Blackboard     │  │  - Debug Flags                 │  │
│  │  - Seeded RNG        │  │                                 │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
│                            ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                    SIMULATION LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Systems   │  │   Physics   │  │      AI Decision        │  │
│  │  - Motion   │  │   (Rapier)  │  │  - Intent Evaluation    │  │
│  │  - Combat   │  │  - Deferred │  │  - Blackboard Pattern   │  │
│  │  - Sensors  │  │    Queues   │  │  - Profile Adjustment   │  │
│  │  - Turrets  │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                            ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Configs   │  │  Ship Data  │  │        Types            │  │
│  │  (tunable)  │  │ (blueprints)│  │  (centralized defs)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Module Organization

```
src/
├── game/           # Simulation core (deterministic)
├── components/     # React/R3F presentation
├── renderer/       # Rendering utilities & materials
├── config/         # Tunable parameters
├── types/          # TypeScript definitions
├── hooks/          # React hooks
├── utils/          # Shared utilities
├── data/           # Static game data
├── assets/         # Asset manifests
└── debug/          # Development tools
```

**Rating: A-**  
**Strengths:**

- Clear separation between `game/` (simulation) and `components/` (rendering)
- Centralized type definitions in `types/`
- Configuration-driven design in `config/`

**Areas to Improve:**

- Some boundary blurring between `renderer/` and `components/`
- `hooks/` contains both rendering and interpolation concerns that could be further separated

---

## 2. GameState: Single Source of Truth

### 2.1 Structure Analysis

```typescript
interface GameState {
  // ECS Core
  world: World<GameEntity>; // Miniplex ECS
  queries: GameQueries; // Precomputed archetype queries

  // Physics
  rapier: RapierModule;
  physicsWorld: RapierWorld;
  eventQueue: EventQueue;
  colliderLookup: Map<number, GameEntity>;

  // Lookup Tables
  shipById: Map<number, ShipEntity>;
  turretsByShip: Map<number, Set<TurretEntity>>;

  // Simulation Clock
  simulation: SimulationClock; // Fixed timestep, accumulator, diagnostics

  // AI State
  ai: AIManagerState;
  blackboard: AIBlackboard;
  sensors: SensorState;

  // Determinism
  rng: SeededRng;

  // UI Mirror
  paused: boolean;
  timeScale: number;
  uiFlags: HudUiFlags;

  // Events (pooled)
  explosions: ExplosionEvent[];
  explosionPool: ExplosionEvent[];
  progressionEvents: Map<number, ProgressionEvent[]>;
}
```

**Rating: A**  
**Strengths:**

- Comprehensive state encapsulation
- Pooled event arrays for determinism
- Clear lookup table design (`shipById`, `turretsByShip`)
- Proper seeded RNG integration

**Areas to Improve:**

- `turretsByShip` is optional (`?`) which creates null-checking overhead
- Consider freezing readonly portions of state for safety

---

## 3. Determinism & RNG System

### 3.1 Implementation

```typescript
// src/utils/rng.ts
export class SeededRng {
  private state = 1;

  constructor(seed: number) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    // Lehmer RNG with glibc parameters
    this.state = (this.state * 48271) % 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  // range(), int(), pick(), normal() methods...
}
```

**Rating: A**  
**Strengths:**

- Lehmer RNG provides fast, deterministic randomness
- Box-Muller transform for Gaussian distribution
- All simulation code uses `state.rng`
- AI traits seeded deterministically from ship spawn

**Areas to Improve:**

- No state serialization for save/load functionality
- Consider adding `getState()`/`setState()` for replay recording

---

## 4. Physics Integration (Rapier3D)

### 4.1 Safe Mutation Pattern

```typescript
// src/game/simulationQueue.ts - Deferred mutation queues
flushDeferredMutations(state); // Before physics step
state.physicsWorld.step(); // Synchronized step
flushPostPhysicsMutations(state); // After physics step

// src/game/physics/safeKinematics.ts - Safe wrappers
export function safeSetTranslation(body: RigidBody, pos: Vector3): void {
  // Deferred or guarded implementation
}
```

### 4.2 Diagnostics Tracking

```typescript
interface RapierDiagnostics {
  deferredMutationFailures: number;
  guardTrips: number;
  stepPanics: number;
  subsystemFailures: number;
  // ... timestamps, error messages, stack traces
}
```

**Rating: B+**  
**Strengths:**

- Deferred mutation queues prevent mid-step corruption
- Comprehensive diagnostics for debugging physics issues
- Guard system catches Rapier panics gracefully

**Areas to Improve:**

- Heavy reliance on try-catch in `entityLifecycle.ts` suggests fragile cleanup
- Consider using Rapier's event-driven collision callbacks more extensively
- Some defensive coding patterns mask underlying issues rather than fixing them

---

## 5. Entity Component System (Miniplex)

### 5.1 Entity Structure

```typescript
interface GameEntity extends TransformComponent {
  id: number;
  rigidBody: RigidBody;
  collider: Collider;
  ship?: ShipComponent;
  projectile?: ProjectileComponent;
  turret?: TurretComponent;
  carrier?: CarrierComponent;
  ai?: AIState;
  // ... model, shieldRipples, muzzleFlashes
}
```

### 5.2 Query System

```typescript
queries: {
  ships: world.with('ship'),
  shipsWithCommands: world.with('ship', 'ai'),
  projectiles: world.with('projectile'),
  turrets: world.with('turret'),
}
```

**Rating: B+**  
**Strengths:**

- Clean archetype-based queries
- Optional components allow flexible entity composition
- Efficient iteration via Miniplex queries

**Areas to Improve:**

- Heavy use of optional components (`ship?`, `ai?`) creates runtime null-checking
- No component pooling for frequently created/destroyed entities (projectiles)
- Entity lifecycle in `entityLifecycle.ts` has defensive try-catch blocks suggesting instability

---

## 6. AI Decision System

### 6.1 Architecture

```
Decision Flow:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Blackboard  │───▶│    Intent    │───▶│   Command    │
│   Refresh    │    │  Generation  │    │  Execution   │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
  Team posture,       Combat/Kite/       Thrust, weapons,
  threat analysis     Escort/Flee        steering output
```

### 6.2 Key Components

| Component  | File                     | Purpose                                |
| ---------- | ------------------------ | -------------------------------------- |
| Manager    | `decision/manager.ts`    | Orchestrates tick-based evaluation     |
| Blackboard | `decision/blackboard.ts` | Shared AI world-state                  |
| Intents    | `decision/*-intents.ts`  | Intent generation (Attack, Kite, etc.) |
| Profiles   | `aiProfiles.ts`          | Behavior presets per ship hull         |
| Scheduler  | `decision/scheduler.ts`  | Round-robin ship processing            |
| Interrupts | `decision/interrupts.ts` | Event-driven behavior changes          |

**Rating: B+**  
**Strengths:**

- Sophisticated intent-based AI with scoring and prioritization
- Blackboard pattern enables shared tactical awareness
- Configurable behavior profiles per ship type
- Interrupt system for reactive behaviors

**Areas to Improve:**

- Complex intent scoring logic spread across multiple files
- Heavy configuration surface in `AI_CONFIG` (30+ parameters)
- Some oscillation concerns documented in `aiProfiles.ts` comments suggest tuning challenges

---

## 7. Rendering Pipeline

### 7.1 Component Hierarchy

```
Battlefield.tsx (Canvas)
├── StarsField (background)
├── BattleSceneContent
│   ├── fog + CelestialEnvironment
│   ├── ShipsLayer → ShipLODManager
│   │   ├── ShipObject (near)
│   │   └── ShipImpostorLayer (far)
│   ├── TurretsLayer
│   ├── ProjectilesLayer → ProjectilesInstancedLayer
│   ├── ExplosionsLayer
│   ├── ParticleTrails
│   └── Postprocessing (optional)
├── BattlefieldSystems (simulation tick integration)
└── HudOverlayCollector
```

### 7.2 Key Patterns

| Pattern             | Implementation                                   | Purpose                        |
| ------------------- | ------------------------------------------------ | ------------------------------ |
| Instanced Rendering | `ProjectilesInstancedLayer`, `ShipImpostorLayer` | Batch similar geometries       |
| LOD System          | `ShipLODManager`                                 | Distance-based detail levels   |
| Material Registry   | `materialRegistry.tsx`                           | Shared material caching        |
| Selective Bloom     | `BloomProvider.tsx`                              | Layer-based bloom registration |

**Rating: B**  
**Strengths:**

- Instanced rendering for projectiles and far ships
- LOD system with hysteresis prevents thrashing
- Selective bloom implementation with layer management

**Areas to Improve:**

- `BloomProvider.tsx` is 350+ lines with complex colorWrite management
- Postprocessing toggle logic has defensive try-catch blocks suggesting edge cases
- Material disposal patterns unclear in some components
- `__copilot_` prefixed userData flags suggest ad-hoc solutions

---

## 8. Configuration System

### 8.1 Structure

```
src/config/
├── renderer.ts       # Postprocessing, quality presets
├── explosions.ts     # Visual explosion parameters
├── projectiles.ts    # Projectile appearance
├── hudHealth.ts      # HUD styling
├── progression.ts    # XP, leveling, damage types
├── environment.ts    # Celestial bodies
├── carriers.ts       # Carrier launch system
├── motion.ts         # Movement smoothing
├── shields.ts        # Shield visuals
└── experiments.ts    # Feature flags
```

### 8.2 Runtime Configuration

```typescript
// src/game/config.ts
export const AI_CONFIG = {
  v2Enabled: boolean,
  tickRateHz: number,
  maxPerTick: number,
  verticalEnabled: boolean,
  smoothingEnabled: boolean,
  // ... 25+ more parameters
};

// URL query param support
function readQueryParam(name: string): string | null { ... }
function readBooleanParam(name: string, defaultValue: boolean): boolean { ... }
```

**Rating: B+**  
**Strengths:**

- Centralized configuration prevents magic numbers
- Environment variable and URL query param overrides
- Feature flag system for experiments

**Areas to Improve:**

- `AI_CONFIG` has grown very large (30+ fields)
- Some configs duplicate information (e.g., vertical clamp per ship type)
- No validation on config values at startup

---

## 9. Type System

### 9.1 Central Type Organization

```
src/types/
├── index.ts          # Re-exports all types
├── simulation.ts     # GameState, SimulationClock
├── ship.ts           # ShipComponent, GameEntity
├── ai.ts             # AI types (re-exports from ai/*.ts)
├── ai/
│   ├── state.ts      # AIState, AIBlackboard
│   ├── doctrine.ts   # DoctrineCard, DoctrineState
│   └── metrics.ts    # AIMetrics, KPI summaries
├── combat.ts         # Projectile, Turret types
├── gameplay.ts       # Team, ShipHull, MotionStats
├── progression.ts    # XP, Captain, Subsystems
├── renderer.ts       # ExplosionEvent
└── core.ts           # Rapier re-exports
```

**Rating: A-**  
**Strengths:**

- Centralized imports via `types/index.ts`
- Good separation of type domains (AI, combat, progression)
- Comprehensive type coverage

**Areas to Improve:**

- Some `any` type usage in renderer code (bloom registration)
- AI types spread across multiple files with complex re-exports
- Missing strict null checks in some defensive code paths

---

## 10. Error Handling

### 10.1 Patterns Observed

```typescript
// Pattern 1: Silent catch (common in rendering)
try {
  (obj as any).traverse((child: any) => { ... });
} catch { /* ignore */ }

// Pattern 2: Diagnostic recording (physics)
catch (error) {
  recordSubsystemFailure(state, name, error, snap);
}

// Pattern 3: Defensive return
if (!state?.ai) return;
```

**Rating: B-**  
**Strengths:**

- Physics diagnostics system captures failures for debugging
- Subsystem guards prevent single system failure from crashing simulation

**Areas to Improve:**

- Many silent `catch { /* ignore */ }` blocks mask potential issues
- Inconsistent error handling patterns across modules
- No centralized error reporting/logging system
- Comments like "ignore" don't explain why errors are expected

---

## 11. Performance Patterns

### 11.1 Implemented Optimizations

| Optimization      | Location                                         | Effectiveness |
| ----------------- | ------------------------------------------------ | ------------- |
| Instanced Mesh    | `ProjectilesInstancedLayer`, `ShipImpostorLayer` | ✅ High       |
| LOD System        | `ShipLODManager`                                 | ✅ High       |
| Material Caching  | `materialRegistry.tsx`                           | ✅ Medium     |
| Pooled Events     | `explosionPool` in GameState                     | ✅ Medium     |
| Fixed Timestep    | `BattlefieldSystems.tsx`                         | ✅ High       |
| Archetype Queries | Miniplex queries                                 | ✅ High       |

### 11.2 Performance Concerns

| Concern                  | Location                    | Impact |
| ------------------------ | --------------------------- | ------ |
| Per-frame allocations    | Vector3 temps in AI         | Medium |
| Heavy blackboard refresh | Every AI tick               | Medium |
| Bloom layer iteration    | On register/unregister      | Low    |
| Map iteration            | `shipById`, `turretsByShip` | Low    |

**Rating: B**  
**Strengths:**

- Good use of instancing for large entity counts
- LOD system reduces draw calls for distant ships
- Fixed timestep prevents spiral-of-death

**Areas to Improve:**

- Some per-frame Vector3 allocations in hot paths
- Consider object pooling for frequently spawned entities
- Blackboard refresh could be incremental rather than full rebuild

---

## 12. Areas for Improvement (Prioritized)

### High Priority

1. **Error Handling Consistency**
   - Replace silent catch blocks with proper error handling
   - Add centralized error logging
   - Document expected vs unexpected errors

2. **Entity Lifecycle Stability**
   - Investigate and fix root causes of defensive try-catch in `destroyEntity()`
   - Consider using Rapier's built-in entity removal callbacks
   - Add entity lifecycle tests for edge cases

3. **BloomProvider Complexity**
   - Refactor 350+ line component into smaller, focused modules
   - Extract colorWrite management into separate utility
   - Document the layer allocation strategy

### Medium Priority

4. **AI Configuration Management**
   - Split `AI_CONFIG` into logical groups
   - Add runtime validation for config values
   - Consider using a schema-based config system

5. **Performance Optimization**
   - Audit and eliminate per-frame allocations
   - Implement entity pooling for projectiles
   - Profile and optimize blackboard refresh

6. **Type Safety**
   - Replace `any` casts with proper types
   - Add stricter null checks in rendering code
   - Consider branded types for entity IDs

### Low Priority

7. **Module Boundaries**
   - Clarify responsibilities between `renderer/` and `components/`
   - Consider moving interpolation hooks to a dedicated module

8. **Testing Coverage**
   - Add integration tests for entity lifecycle
   - Add visual regression tests for bloom behavior
   - Add performance regression tests

9. **Documentation**
   - Add JSDoc for public APIs
   - Document the deferred mutation pattern
   - Create a troubleshooting guide

---

## 13. Recommendations Summary

### Quick Wins (1-2 hours each)

1. Add config validation in `createGameState()`
2. Replace `/* ignore */` comments with specific error explanations
3. Add `@deprecated` tags to legacy patterns

### Medium Effort (1-2 days each)

1. Refactor `BloomProvider.tsx` into smaller modules
2. Implement entity pooling for projectiles
3. Add comprehensive lifecycle tests

### Strategic Improvements (1+ weeks)

1. Design a centralized error handling/logging system
2. Implement incremental blackboard updates
3. Create a performance profiling dashboard

---

## Appendix: File Metrics

| Module      | Files | LOC (approx) | Complexity |
| ----------- | ----- | ------------ | ---------- |
| game/       | 45+   | ~3500        | High       |
| components/ | 35+   | ~2500        | Medium     |
| renderer/   | 20+   | ~1500        | Medium     |
| types/      | 15+   | ~1200        | Low        |
| config/     | 15+   | ~800         | Low        |
| hooks/      | 12+   | ~500         | Medium     |
| utils/      | 15+   | ~400         | Low        |

---

_This document provides a point-in-time analysis. Architecture evolves; re-evaluate quarterly._
