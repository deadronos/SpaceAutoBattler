# game/systems/shipControl/ - Ship Command Execution

Executes AI commands and applies movement/weapon directives to ships.

## Command Execution Files

| File                 | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| **index.ts**         | Main ship control system export                             |
| **aiExecutor.ts**    | Executes AI-generated commands on ships                     |
| **movementApply.ts** | Applies movement commands to ships (acceleration, rotation) |
| **weapons.ts**       | Executes weapon firing commands                             |
| **lifecycle.ts**     | Manages ship lifecycle states                               |
| **aiSafety.ts**      | Safety checks and constraints on AI commands                |
| **sharedTemps.ts**   | Reusable temporary vectors/matrices                         |

## Command Flow

```
AI Decision System
  ↓
  Generate Commands
    ├─ MovementCommand (acceleration, rotation target)
    ├─ FireCommand (weapon, target)
    └─ SpecialCommand (boost, special ability)
  ↓
  Ship Control Executor
    ├─ aiSafety checks for valid commands
    ├─ movementApply updates ship motion
    ├─ weapons.ts fires weapon if available
    └─ Updates ship state
```

## Safety Features

- Validates command targets exist
- Checks weapon cooldowns before firing
- Ensures movement constraints honored
- Prevents command spam
- Validates ammo/energy resources

## Integration

- Works with decision system output
- Updates ship motion via motion system
- Triggers weapon effects via weapon system
- Part of shipControl.ts system
