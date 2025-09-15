## Spawn System

Last-Reviewed: 2025-09-15

The Spawn System handles carrier-produced fighter spawning, fleet spawns, and timed reinforcements. It's responsible for creating new `Ship` entities, assigning them ids, and updating parent/child relationships when a carrier spawns fighters.

### Responsibilities

- Check carriers for spawn timers and create fighters when spawn conditions are met.
- Assign unique ids to spawned ships and set `parentCarrierId` where applicable.
- Update `state.spawnQueue` and relevant counters like `spawnedFighters` on carrier state.
- Respect maximum active fighters per carrier as configured in `carrierSpawnConfig`.

### Inputs & Outputs

- Inputs: `state` (GameState), `dt` (delta time)
- Outputs: Mutates `state.ships`, `state.spawnQueue`, carrier counters

### Edge cases

- Ensures that spawn doesn't exceed configured caps. If a carrier is destroyed during spawn processing, spawned fighters are still created but may be immediately re-parented or left without parent depending on game logic.

Session note: Reviewed and confirmed on 2025-09-15 during Batch 5 sweep.
