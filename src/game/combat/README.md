# game/combat/ - Combat Mechanics

Core damage calculation and combat-related utilities.

## Combat Files

| File                     | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| **damage.ts**            | Damage calculation including armor, shields, and armor penetration  |
| **damageMath.ts**        | Pure per-component damage math (breaks results down by component)   |
| **damageApplication.ts** | Applies calculated damage to a ship entity and invokes callbacks    |
| **aiming.ts**            | Aiming/targeting helpers (ship velocity extraction, intercept math) |

## Damage System

Provides:

- Armor and shield damage calculations
- Armor penetration mechanics
- Critical hit chance
- Damage type interactions
- Ship health management

## Damage Flow

```
Projectile hits ship
  ↓
Calculate damage based on:
  ├─ Projectile damage value
  ├─ Ship armor (reduction)
  ├─ Ship shields (absorption)
  ├─ Weapon type bonuses
  └─ Distance/falloff
  ↓
Apply damage:
  ├─ Shield damage (if active)
  ├─ Armor damage
  └─ Health damage
  ↓
Trigger effects:
  ├─ Explosion (if destroyed)
  └─ Screen flash (if hit)
```

## Integration

- Called by collision detection system
- Updates ship state in GameState
- Triggers damage events
- Used by progression system for XP
