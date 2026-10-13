# game/utils/ - Utility Functions

Helper functions and utilities for game logic calculations and AI behavior.

## Utility Files

| File                      | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| **ai-vertical.ts**        | Vertical (3D) AI maneuvers and movement calculations                     |
| **physicsFactory.ts**     | Factory for creating physics bodies and configurations                   |
| **physicsBodyManager.ts** | Creates kinematic body+collider pairs and tracks their lifecycle         |
| **rangePolicy.ts**        | Range calculation and weapon distance policies                           |
| **spatialHash.ts**        | Functional wrappers over the generic spatial grid for broadphase queries |
| **targetSelection.ts**    | Nearest-enemy selection helpers                                          |

## Helper Functions

These utilities provide:

- AI steering calculations
- Physics body creation
- Range and distance utilities
- Tactical position calculations
- Movement constraint enforcement

## Usage

These utilities are consumed by:

- Decision system for AI calculations
- Motion system for movement
- Physics system for body creation
- Combat system for range checks
