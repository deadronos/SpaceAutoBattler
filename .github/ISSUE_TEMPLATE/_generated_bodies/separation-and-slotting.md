# Add separation steering + unique formation slotting

State now

- Ships cluster because cohesion/group movement lacks a separation force.
- Formation targets are not uniquely assigned; multiple ships can chase the same slot.

Expected outcome

- Separation steering applies a repulsive component from nearby allies.
- Config adds `separationDistance` and `separationWeight` (documented defaults).
- Formation logic assigns unique `aiState.formationSlotIndex` and `aiState.formationPosition` per ship.

Acceptance criteria

- Unit test demonstrates increased median nearest-neighbor distance after 3–5 seconds in a clustered spawn.
- No two ships share the same formation slot index when a formation is active.
- New config keys exist and are wired; changing them measurably affects behavior.

Guidance for testing

- Add a small AI behavior test that spawns N ships at the same point and steps the sim, asserting NN-distance increase.
- Add a test around formation selection ensuring unique slot indices across members.
- Run a smoke scenario (formations enabled) to visually verify spacing.
