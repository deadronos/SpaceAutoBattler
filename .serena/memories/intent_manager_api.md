# intent_manager_api (HISTORICAL)

Last-Reviewed: 2025-09-21

Status: MARKED HISTORICAL

Notes:

- Intent management used to be a discrete module; current code integrates intent-like decisions into small helpers within `src/game/systems.ts` and `src/game/ships.ts`.
- For active logic, inspect `updateGame`/`prepareShips` in `src/game/systems.ts`.
