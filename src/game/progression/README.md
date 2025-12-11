# game/progression/ - Ship Progression & Leveling

Manages ship progression system including experience, leveling, talents, and ship advancement.

## Progression Files

| File            | Purpose                                          |
| --------------- | ------------------------------------------------ |
| **index.ts**    | Main progression system export and orchestration |
| **events.ts**   | Progression-related game events and triggers     |
| **leveling.ts** | Ship leveling system and experience thresholds   |
| **xp.ts**       | Experience point calculation and application     |

## Progression System

The progression system provides:

- Experience point tracking per ship
- Leveling milestones and thresholds
- Talent/skill selection system
- Ship stat progression
- Rewards for achievements

## XP Sources

Ships gain experience from:

- Dealing damage to enemies
- Defeating other ships
- Mission completion
- Kill participation
- Combat achievements

## Leveling

- Each level increases ship capabilities
- Unlocks new weapons or abilities
- Improves ship stats (armor, shields, speed)
- May unlock special talents

## Integration

- Progression tracked in GameState.ships
- Updated by combat system on damage/kills
- UI displays progression in ProgressionPanel
- Used by difficulty scaling systems
