## Turret Targeting

Last-Reviewed: 2025-09-07

This memory documents how turrets pick and track targets.

### Responsibilities

- Select nearest or highest-priority enemy within turret range and arc.
- Lead targets by predicting target movement using current velocity and projectile speed.
- Apply aim smoothing and tracking mechanics so turrets don't snap instantly.

### API

- `selectTurretTarget(turret: Turret, ship: Ship, state: GameState): Ship | null`

### Notes

- Uses spatial queries and team checks to avoid friendly fire; configurable via `behaviorConfig`.
