# Anchored roaming and formation slot assignment

Labels: enhancement, ai, medium-impact

State now
---------
- `AIController.chooseRoamingIntent` assigns roaming patterns but `executePatrol` uses `ship.pos` as the center for random/circular patterns. That means ships that start close pick overlapping patrol targets.
- `findBestFormation` returns a formation but there's no explicit slot allocation; multiple ships may attempt the same position.

Expected outcome
----------------
- Roaming uses a persistent `aiState.roamingAnchor` assigned from a distributed pool to avoid overlapping patrol centers.
- Formation code computes explicit slot positions for a formation and assigns/reserves them for ships so slots are unique and stable.

Acceptance criteria
-------------------
1. `aiState.roamingAnchor` is assigned when a ship enters roaming and freed when it leaves (or after timeout). A global per-team anchor registry avoids anchors that are too close (`roamingAnchorMinSeparation`).
2. Formation slot generation at formation acquisition time produces N slots (using formation spacing) and assigns each nearby ship a unique slot (stored in `aiState.formationSlotIndex` and `aiState.formationPosition`).
3. Tests: vitest verifies distinct roaming anchors for ships spawned near each other and verifies formation slot uniqueness.

Vitest guidance
---------------
- `test/vitest/ai-roaming-formation.spec.ts`:
  - Spawn several ships near each other, switch them to `roaming` mode, step sim and assert anchors differ by at least `roamingAnchorMinSeparation`.
  - Create a formation with 4 slots and assert 4 ships get unique slot indices and maintain those positions for a short duration.

Notes
-----
- Anchor allocation can use simple grid/quadrant hashing or a random sample + rejection strategy (Poisson-disc) for simplicity.
- Keep anchor registry per-team to avoid cross-team collision of anchors.