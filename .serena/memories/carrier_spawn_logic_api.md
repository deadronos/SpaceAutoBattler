## Carrier Spawn Logic

Last-Reviewed: 2025-09-07

This memory describes the logic carriers use to spawn fighters and manage their spawn queues.

### Responsibilities

- Maintain a spawn timer per carrier and spawn fighters when the timer elapses.
- Respect max fighters per carrier and global caps from `carrierSpawnConfig`.
- Assign `parentCarrierId` to spawned fighters and increment `spawnedFighters` counters.

### Notes

- Spawning is deterministic and tied to `state.time` and carrier timers.
