# Intent System Architecture (After Refactoring)

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                     intents.ts (198 lines)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Orchestration & Coordination                          │  │
│  │  • selectIntent() - Intent selection                  │  │
│  │  • computeLod() - Level of detail                     │  │
│  │  • writeCommand() - Command dispatch                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ combat-intents   │  │ tactical-intents │  │formation-intents │
│ (scoring)        │  │ (scoring)        │  │ (scoring)        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│command-generators│  │vertical-maneuvers│  │metrics-diagnostics│
│   (243 lines)    │  │   (80 lines)     │  │   (57 lines)     │
│                  │  │                  │  │                  │
│ • Attack         │  │ • Vertical       │  │ • Focus fire     │
│ • Intercept      │  │   perturbation   │  │   metrics        │
│ • Reposition     │  │ • Elevation      │  │ • Band           │
│ • Regroup        │  │   preferences    │  │   stickiness     │
│ • Escort         │  │ • Hull-specific  │  │                  │
│ • Kite           │  │   constraints    │  │                  │
│ • Flee           │  │ • Metrics        │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  intent-utils    │
                    │  (shared utils)  │
                    │                  │
                    │ • Vector math    │
                    │ • Scoring        │
                    │ • Tie-breaking   │
                    └──────────────────┘
```

## Call Flow Example: Attack Intent

```
User → GameState → AI Manager
                      │
                      ▼
            ┌─────────────────────┐
            │  selectIntent()     │ ← intents.ts
            │  • Score candidates │
            │  • Tie-break        │
            └─────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │ scoreAttackIntent() │ ← combat-intents.ts
            │  • Range check      │
            │  • HP ratio         │
            │  • Posture          │
            └─────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │  writeCommand()     │ ← intents.ts
            │  • Switch on intent │
            └─────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │computeAttackCommand │ ← command-generators.ts
            │  • Heading calc     │
            │  • Thrust adjust    │
            │  • Fire decision    │
            └─────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │applyVertical        │ ← vertical-maneuvers.ts
            │Perturbation()       │
            │  • RNG seed         │
            │  • Elevation pref   │
            │  • Clamping         │
            └─────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │updateBandStickiness │ ← metrics-diagnostics.ts
            │  • Range check      │
            │  • Persist heading  │
            └─────────────────────┘
                      │
                      ▼
                  Command Output
            (thrust, heading, fire)
```

## Testing Strategy

### Unit Tests (Recommended to Add)

```
command-generators.ts
├── computeAttackCommand()
│   ├── ✓ maintains range when in band
│   ├── ✓ approaches when too far
│   ├── ✓ retreats when too close
│   └── ✓ fires only within range
├── computeInterceptCommand()
│   ├── ✓ leads moving targets
│   ├── ✓ handles stationary targets
│   └── ✓ clamps prediction time
└── ... (other intents)

vertical-maneuvers.ts
├── applyVerticalPerturbation()
│   ├── ✓ uses deterministic RNG
│   ├── ✓ respects hull constraints
│   ├── ✓ applies elevation preferences
│   └── ✓ clamps heading.y correctly

metrics-diagnostics.ts
├── recordFocusDiagnostics()
│   └── ✓ tracks focus fire ratios
└── updateBandStickiness()
    ├── ✓ persists heading in band
    └── ✓ clears when out of band
```

### Integration Tests (Existing - All Pass ✅)

```
ai-determinism.spec.ts
├── ✓ produces identical command streams for identical seeds

ai-scorer.spec.ts  
├── ✓ intent scoring logic
└── ✓ candidate selection

ai-executor.spec.ts
├── ✓ command execution
└── ✓ state updates

ai-intercept.spec.ts
├── ✓ intercept heading calculation
└── ✓ lead time computation

ai-vertical.spec.ts
├── ✓ vertical maneuver constraints
└── ✓ elevation behavior

ai-metrics.spec.ts
└── ✓ metrics collection
```

## Benefits Summary

### Before Refactoring
```
intents.ts (~449 lines)
├── selectIntent()
├── computeLod()
├── writeCommand()
│   ├── switch (intent)
│   │   ├── case 'Attack': [~40 lines]
│   │   ├── case 'Intercept': [~30 lines]
│   │   ├── case 'Reposition': [~50 lines]
│   │   ├── case 'Regroup': [~30 lines]
│   │   ├── case 'Escort': [~25 lines]
│   │   ├── case 'Kite': [~20 lines]
│   │   └── case 'Flee': [~20 lines]
│   ├── applyVerticalPerturbation() [~80 lines]
│   └── band stickiness logic [~30 lines]
├── recordFocusDiagnostics() [~30 lines]
└── updateBandStickiness() [~25 lines]

❌ Hard to test individual behaviors
❌ Mixed concerns (tactics + 3D + metrics)
❌ Large function cognitive load
```

### After Refactoring
```
intents.ts (198 lines) - Orchestration
├── selectIntent() [~50 lines]
├── computeLod() [~10 lines]
└── writeCommand() [~70 lines] - Simplified dispatch

command-generators.ts (243 lines) - Pure command logic
├── computeAttackCommand() [~30 lines]
├── computeInterceptCommand() [~30 lines]
├── computeRepositionCommand() [~50 lines]
├── computeRegroupCommand() [~25 lines]
├── computeEscortCommand() [~30 lines]
├── computeKiteCommand() [~25 lines]
└── computeFleeCommand() [~25 lines]

vertical-maneuvers.ts (80 lines) - 3D combat
└── applyVerticalPerturbation() [~80 lines]

metrics-diagnostics.ts (57 lines) - Diagnostics
├── recordFocusDiagnostics() [~30 lines]
└── updateBandStickiness() [~25 lines]

✅ Each function independently testable
✅ Clear separation of concerns
✅ Easy to reason about individual behaviors
✅ Ready for unit test coverage
```

## Code Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines in intents.ts | ~449 | 198 | 56% reduction |
| Largest function | ~200 | ~70 | 65% reduction |
| Module count | 1 | 4 | Better organization |
| Testability score | Low | High | Unit test ready |
| Cognitive complexity | High | Medium | Easier to reason |
| Single Responsibility | ❌ | ✅ | Clear ownership |

## Conclusion

The refactoring successfully decomposed a monolithic 449-line file with mixed concerns into a clean, modular architecture with:

- **Clear ownership**: Each module has one job
- **Better testability**: Pure functions ready for unit tests
- **Maintained behavior**: All existing tests pass
- **Improved maintainability**: Easier to understand and modify
- **Foundation for growth**: Clear patterns for adding new intents

✅ All validation gates passed
✅ Zero behavioral regressions detected
✅ Ready for production deployment
