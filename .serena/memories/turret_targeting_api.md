## Turret Targeting

The `turretTargeting.ts` module provides functions for handling the logic of turret target selection. This is a key part of the AI, allowing turrets to independently choose the best enemy to engage.

### Exported Functions

- **`scoreTurretTarget(distance: number, target: Ship): number`**
  - **Purpose:** Computes a score for a potential turret target.
  - **Inputs:** `distance` to the target and the `target` ship object.
  - **Outputs:** A numerical score for the target. Higher scores are better.
  - **Logic:** The score is based on a formula that prioritizes closer targets, more damaged targets, and higher-level targets.

- **`isWithinTurretRange(distance: number, cfg: BehaviorConfig['turretConfig']): boolean`**
  - **Purpose:** Checks if a given distance is within the effective firing range of a turret.
  - **Inputs:** The `distance` to check and the `turretConfig`.
  - **Outputs:** `true` if the distance is within the minimum and maximum fire range, `false` otherwise.

- **`pickBestTurretTarget(state: GameState, ship: Ship, turret: TurretState, cfg: BehaviorConfig['turretConfig']): number | null`**
  - **Purpose:** Selects the best target for a turret to engage.
  - **Inputs:** The current `GameState`, the `ship` that owns the turret, the `turret` itself, and the `turretConfig`.
  - **Outputs:** The `id` of the best target ship, or `null` if no suitable target is found.
  - **Logic:** This function iterates through all enemy ships, checks if they are within range, calculates a score for each using `scoreTurretTarget`, and returns the ID of the ship with the highest score.