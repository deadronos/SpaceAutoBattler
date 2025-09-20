# Major Data Flow Diagrams

This document catalogs the key runtime data flows in the project using React Three Fiber architecture. These are intended for quick orientation and system boundaries discovery.

## 1) React Application Boot + Game State Initialization

```
[main.tsx] -> [App.tsx] -> [GameProvider]
   (Root)      (Shell)      (State Context)
     |           |              |
     v           v              v
 [ReactDOM]  [Battlefield]  [createGameState]
             (R3F Canvas)   (ECS + Physics)
```

- Init: src/main.tsx renders the React app with GameProvider context
- State: GameProvider creates GameState with Rapier physics world and Miniplex ECS
- Rendering: Battlefield component provides React Three Fiber Canvas
- Physics: Rapier physics world runs on main thread integrated with ECS

Files: src/main.tsx, src/App.tsx, src/game/context.tsx, src/game/state.ts

## 2) Game Loop + Physics/Renderer Sync

```
[BattlefieldSystems] -> [updateGame] -> [Physics Step]
   (useFrame hook)      (Game Systems)   (Rapier World)
        |                    |               |
        v                    v               v
[React Components] <- [ECS Entities] <- [syncTransforms]
 (Ship/Projectile)     (Miniplex)       (Physics -> ECS)
```

- Game Loop: BattlefieldSystems component uses useFrame hook to run updateGame each frame
- Systems: updateGame runs ship AI, projectile movement, physics step, and transform sync
- Sync: syncTransforms copies Rapier rigid body positions/rotations to ECS entity transforms
- Rendering: React components read ECS entities via useArchetypeEntities hook and render via R3F

Files: src/components/Battlefield.tsx, src/game/systems.ts, src/hooks/useArchetypeEntities.ts

## 3) Entity Lifecycle (Ships/Projectiles)

```
[spawnShip] -> [ECS Entity] -> [Rapier Bodies]
 (Factory)     (Miniplex)      (Physics World)
     |            |                 |
     v            v                 v
[ShipObject] -> [Transform] -> [Visual Update]
(Component)    (Position)      (R3F Scene)
```

- Spawn: spawnShip creates ECS entity with ship component and Rapier rigid body/collider
- ECS: Entity stored in Miniplex world with ship archetype for efficient querying
- Physics: Rapier bodies provide collision detection and kinematic movement
- Rendering: ShipObject React component reads entity transform and renders via R3F

Files: src/game/ships.ts, src/game/state.ts, src/components/Ship.tsx

## 4) Combat and AI Systems

```
[findNearestEnemy] -> [Ship AI] -> [fireProjectile]
  (Target Search)    (Movement)    (Combat Action)
        |              |              |
        v              v              v
[ECS Queries] -> [Transform Update] -> [ECS Entity]
 (Ship Archetype) (Position/Rotation) (Projectile)
```

- AI: findNearestEnemy searches ECS ship entities for combat targets
- Movement: Ships orient towards targets and move within optimal range  
- Combat: fireProjectile creates projectile entities with Rapier physics bodies
- Integration: All AI decisions update ECS state, physics handles collisions

Files: src/game/systems.ts

---

## Architecture Notes

- **Determinism**: Uses src/utils/rng.ts seeded RNG for repeatable behavior
- **Canonical State**: GameState in src/types/index.ts is the single source of truth
- **ECS Integration**: Miniplex provides entity queries, Rapier handles physics simulation
- **React Integration**: React Three Fiber provides declarative 3D rendering