# game/physics/ - Physics Engine Integration

Wrapper and utility layer for Rapier3D physics engine integration with game state.

## Physics Files

| File                   | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| **index.ts**           | Main physics system; steps physics simulation and handles collisions |
| **wrappers.ts**        | Consolidated deferred and post-physics wrapper functions             |
| **safeKinematics.ts**  | Safe kinematic body manipulation without physics conflicts           |
| **mutationHelpers.ts** | Helpers for safely mutating physics bodies                           |
| **types.ts**           | TypeScript types for physics operations                              |

## Physics Integration

The physics system provides:

- Rapier3D world creation and stepping
- Collision detection and callbacks
- Rigid body management
- Deterministic physics with seeded RNG
- Safe state mutations

## World Configuration

- **WORLD_SIZE**: Size of the simulation world (8000 default)
- **WORLD_HALF**: Half-extent of world (±4000 default)
- **Gravity**: Reduced gravity or disabled for space environment
- **Colliders**: Different collision groups for ships, projectiles, debris

## Integration with Game

```text
Each Frame:
  ├─ Apply forces from movement system
  ├─ Step physics simulation (Rapier3D)
  ├─ Collect collision events
  ├─ Update ship positions from physics bodies
  └─ Trigger combat on collision hits
```

## Performance Considerations

- Physics stepping is deterministic and reproducible
- Collision queries are cached where possible
- Large-scale spatial queries use broadphase
- Bodies are pooled and reused
