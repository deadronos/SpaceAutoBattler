# Tasks Index (Memory Bank)

This index tracks active tasks and their memory files. Use the `/memory/tasks` folder for task-specific planning. Note completed tasks can also be in `./COMPLETED` once manually moved.

## Known issues

## In Progress

- [TASK010](TASK010-thruster-trails-gpu.md) — Move thruster trails to GPU-managed instanced buffers for scalable rendering. (In Progress — design published, implementation pending) (2025-10-06)
- [TASK009](TASK009-ship-hull-visibility.md) — Restore ship hull visibility by refreshing LOD partitioning after instancing refactor. (In Progress — requirements/design in flight) (2025-10-05)

- [TASK012](TASK012-update-memory-bank.md) — Quick memory sync: inspect `src/components/PostprocessingLazy.tsx`, record findings, and update memory bank entries. (In Progress — documentation/update) (2025-10-18)
- [TASK013](TASK013-update-environment-memory.md) — Expand memory notes for `src/components/environment/*` with component summaries and engineering guidance. (In Progress — documentation) (2025-10-18)

- [TASK021](TASK021-refactor-damage-calculation.md) — Centralize damage math into `src/game/combat/damage.ts` and provide a thin adapter for applying results. (In Progress — design: DESIGN200) (2025-10-27)
- [TASK022](TASK022-extract-subsystems-module.md) — Extract subsystem lifecycle and repair logic into `src/game/subsystems.ts` and add deterministic tests. (In Progress — design: DESIGN201) (2025-10-27)
- [TASK023](TASK023-split-progression-modules.md) — Split `src/game/progression.ts` into `xp.ts`, `leveling.ts`, and `events.ts` with an index re-export. (In Progress — design: DESIGN202) (2025-10-27)

- [TASK007](TASK007-rings-bloomOnly.md) — Add `rings.bloomOnly` config flag and create follow-up wiring/tests tasks. (In Progress — wiring & tests remaining) (2025-10-03)

## Pending

- [TASK001](TASK001-instanced-particles-explosions.md) — Instanced particles & explosions (High priority) (2025-10-05)
- [TASK002](TASK002-thruster-muzzle-instancing.md) — Thruster & muzzle instancing + bloom registration (High priority) (2025-10-05)
- [TASK003](TASK003-ship-lod-impostors.md) — Ship LOD impostors & instanced distant-ship rendering (Medium priority) (2025-10-05)
- [TASK004](TASK004-debris-fragments-instancing.md) — Debris & fragment instancing (Medium priority) (2025-10-05)
- [TASK005](TASK005-material-texture-atlas.md) — Material & texture atlas for instance-friendly materials (High priority) (2025-10-05)


## Abandoned

- _None tracked._
