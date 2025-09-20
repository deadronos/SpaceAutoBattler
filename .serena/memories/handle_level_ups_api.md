# handle_level_ups_api (HISTORICAL)

Last-Reviewed: 2025-09-21

Status: MARKED HISTORICAL

Notes:
- Level-up and XP processing logic is now implemented as part of the simulation step in `src/game/systems.ts` (search for `processDeathsAndXP`, `handleLevelUps`, or similar names).
- Use `src/game/systems.ts` and `src/game/ships.ts` for authoritative logic.
