```markdown
# Agents Guide: src/game/systems

- Purpose: Small, focussed systems that run each simulation tick (prepareShips, resolveProjectiles, advanceProjectiles, etc.).
- Contracts: Systems should accept `GameState` and operate only on the state; schedule Rapier-sensitive operations via deferred queues.
- Ordering: Keep system ordering explicit and documented; changes to ordering can affect determinism and tests.
- Tests: Add deterministic unit tests that seed RNG and step a controlled `GameState` to validate behaviour.

```
