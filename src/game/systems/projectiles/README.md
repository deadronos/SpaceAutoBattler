# game/systems/projectiles/ - Projectile System

Manages projectile creation, advancement, and behavior including ballistic and homing projectiles.

## Projectile Files

| File                  | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| **index.ts**          | Main projectile system orchestration                          |
| **spawn.ts**          | Creates new projectile entities from weapon firing            |
| **advance.ts**        | Updates projectile positions each frame                       |
| **beam.ts**           | Beam weapon projectile behavior (instant-hit or guided beams) |
| **homing.ts**         | Homing missile behavior with tracking algorithms              |
| **physicsAdapter.ts** | Adapts projectile motion to Rapier3D physics                  |
| **sharedTemps.ts**    | Reusable temporary vectors/matrices                           |

## Projectile Types

- **Standard Bullets** - Ballistic projectiles with travel time
- **Beam Weapons** - High-speed or instant-hit energy weapons
- **Homing Missiles** - Self-guiding projectiles with target tracking
- **Plasma Bolts** - Energy projectiles with specific physics

## Lifecycle

```
Spawn
  ↓
Advance (each frame)
  ├─ Update position
  ├─ Check homing targets
  ├─ Check collisions
  └─ Decrement lifetime
  ↓
Despawn (on impact or timeout)
```

## Integration

- Projectiles created by turret/weapon system
- Physics handled by Rapier3D collision detection
- Collision events trigger damage system
- Uses deterministic RNG for homing calculations

## Performance

- Pooled projectile entities for reuse
- Efficient batch updates each frame
- Homing calculations optimized with caching
- Collision detection leverages physics engine
