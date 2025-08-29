Title: Separation steering: add separation force to reduce clumping

Labels: enhancement, ai, medium-impact

State now
---------
- `AIController.executeGroup` moves ships toward the center of nearby friends using `calculateGroupCenter`, with no separation force. This causes ships to clump tightly, overlap visually, and sometimes collide or block each other.
- `executePatrol` creates patrol targets relative to `ship.pos` which also encourages local clustering when many ships spawn together.

Expected outcome
----------------
- Ships maintain comfortable spacing when moving in groups or formations, reducing pile-ups and improving visual clarity and tactical movement.
- Formation movement and patrols remain coherent but avoid overlapping positions.

Acceptance criteria
-------------------
1. New configuration parameters exist in `BehaviorConfig` (e.g., `separationDistance`, `separationWeight`) with sensible defaults.
2. `AIController.moveTowards` (or a new helper) adds a separation vector computed from nearby friendly ships and combines it with the desired movement direction.
3. When multiple ships start in the same area and run the sim for several seconds, the number of ships within half the `separationDistance` radius around any ship is significantly reduced compared to current behavior (target: 50% reduction).
4. Formation cohesion is still possible (i.e., ships converge to their formation slot without oscillation). Unit tests must validate both separation and formation slot maintenance.

Vitest validation guidance
-------------------------
- Create `test/vitest/ai-separation.spec.ts` with tests:
  - Spawn N (e.g., 10) fighters close together, step the simulation (e.g., 5s of simulated time with small dt), and assert average neighbor count within `separationDistance/2` decreases by ~50% vs baseline (document baseline in the test setup).
  - Create a mock formation (3–5 ships) and assert they acquire distinct formation slot positions and maintain them for a duration (no two ships assigned to the same slot).

Notes
-----
- Keep the separation calculation limited to a fixed radius (e.g., `separationDistance`) to avoid O(N^2) behaviour for large fleets; consider a small k-NN or radius-limited neighbor scan.
- Tune `separationWeight` so separation reduces clumping but doesn't break formation cohesion.