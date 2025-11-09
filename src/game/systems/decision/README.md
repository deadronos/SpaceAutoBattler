# game/systems/decision/ - AI Decision System

Handles AI decision-making for autonomous ships including tactical evaluation, intent generation, and command selection.

## Decision Files

| File | Purpose |
|------|---------|
| **manager.ts** | Orchestrates decision-making process for all AI ships each frame |
| **blackboard.ts** | Shared data structure for decision context and tactical information |
| **evaluator.ts** | Evaluates tactical situations (threat assessment, target prioritization) |
| **intents.ts** | Defines AI intentions (combat, formation, evasion, etc.) |
| **command-generators.ts** | Generates movement and firing commands from intentions |
| **scheduler.ts** | Schedules decision updates to avoid overhead per frame |
| **smoothing.ts** | Smooths command transitions to avoid jittery behavior |
| **hysteresis.ts** | Implements hysteresis to prevent rapid decision changes |
| **profile-adjustment.ts** | Adjusts AI behavior based on difficulty profile |

## Intent Types

The decision system generates various intents:
- **Combat Intents** - Attack, pursue, retreat
- **Formation Intents** - Maintain formation, spread out
- **Tactical Intents** - Flanking, positioning
- **Evasion Intents** - Dodge incoming fire
- **Vertical Maneuvers** - Three-dimensional movement tactics

## Decision Flow

```
Each AI Ship:
  ↓
  Decision Manager
    ├─ Gather blackboard data (threats, allies, targets)
    ├─ Evaluate tactical situation
    ├─ Generate intents based on AI profile
    ├─ Apply hysteresis and smoothing
    └─ Generate movement/firing commands
  ↓
  Command Generators
    └─ Create specific movement and weapon commands
```

## Performance Optimization

- Uses scheduler to spread decision updates across frames
- Caches evaluation results with hysteresis
- Deterministic behavior via seeded RNG
- Adjusts complexity based on entity count
