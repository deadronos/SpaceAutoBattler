# game/systems/decision/ - AI Decision System

Handles AI decision-making for autonomous ships including tactical evaluation, intent generation, and command selection.

## Decision Files

| File                      | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| **manager.ts**            | Orchestrates decision-making process for all AI ships each frame         |
| **blackboard.ts**         | Shared data structure for decision context and tactical information      |
| **evaluator.ts**          | Evaluates tactical situations (threat assessment, target prioritization) |
| **intents.ts**            | Defines AI intentions (combat, formation, evasion, etc.)                 |
| **command-generators.ts** | Generates movement and firing commands from intentions                   |
| **scheduler.ts**          | Schedules decision updates with bounded catch-up to avoid overhead       |
| **smoothing.ts**          | Smooths command transitions to avoid jittery behavior                    |
| **hysteresis.ts**         | Implements hysteresis to prevent rapid decision changes                  |
| **profile-adjustment.ts** | Adjusts AI behavior based on difficulty profile                          |

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
- **Bounded catch-up**: Processes backlog up to configurable limit (default: 3 ticks) to avoid frame-time dependency
- **Metrics tracking**: Monitors caught-up and dropped ticks for performance diagnostics
- Caches evaluation results with hysteresis
- Deterministic behavior via seeded RNG
- Adjusts complexity based on entity count

## Scheduler Behavior

The scheduler implements bounded catch-up to handle long frames gracefully:

- **Normal operation**: Processes one tick per scheduler interval
- **Backlog catch-up**: When frames are slow, catches up on missed ticks (up to `maxCatchUpTicks`, default: 3)
- **Overflow protection**: Drops ticks beyond the catch-up limit to prevent unbounded work spikes
- **Metrics**: Tracks `ticksCaughtUp` and `ticksDropped` for observability

Example configuration:

```typescript
{
  tickInterval: 100,      // Time between AI ticks
  maxPerTick: 5,          // Max ships to process per tick
  maxCatchUpTicks: 3      // Max ticks to catch up per frame (optional)
}
```
