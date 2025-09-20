# spawn_system_api (HISTORICAL)

Last-Reviewed: 2025-09-21

Status: MARKED HISTORICAL — spawn systems were reorganized.

Notes:
- Earlier versions kept spawn-related helpers in `src/core/spawnSystem.ts`. The modern code places spawning helpers in `src/game/state.ts` (`spawnInitialFleets`) and `src/game/ships.ts` (`spawnShip`, blueprints, SHIP_STATS`).
- For spawn logic, consult `src/game/state.ts` and `src/game/ships.ts` as the authoritative sources.
