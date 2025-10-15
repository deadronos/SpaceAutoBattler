# Agents Guide: src/components/explosions/effectUpdaters

- Purpose: Small pure updater functions that map explosion event parameters to per-frame instance attributes.
- Contracts: Keep each updater pure and fast; accept an input event and write into a preallocated attribute buffer.
- Performance: Avoid allocations in the update loop; reuse temp vectors and instance attribute arrays.
- Tests: Cover numeric transforms with unit tests (seeded inputs where stochastic behaviour is involved).
