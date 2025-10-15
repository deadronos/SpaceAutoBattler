```markdown
# Agents Guide: src/game/physics

- Purpose: Physics helpers and safe kinematics wrappers for Rapier integration.
- Safety: Use `simulationQueue` helpers and `enqueuePostPhysicsMutation` to avoid Rapier mutable-borrow errors.
- Contracts: Keep Rapier calls wrapped to allow diagnostics and graceful recovery when Rapier throws.
- Testing: Add unit tests that exercise safe kinematics helpers and guard trip logging.

```
