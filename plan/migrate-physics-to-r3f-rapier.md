# Migrate physics from worker to r3f Rapier — High-level plan

Goal

- Remove the dedicated simulation worker approach and run deterministic physics on the main thread using the react-three-fiber Rapier integration (`@react-three/rapier`).
- Replace worker-message-based transform streaming with in-thread Rapier bodies synchronized with the canonical `GameState` (miniplex ECS). Use ECS queries for updates (health, acceleration, thrust, etc.).
- Preserve deterministic behavior where applicable and provide a clear migration path; keep tests and performance validation.

Principles and constraints

- Preserve the canonical `GameState` type as the single source of truth for runtime state.
- Avoid module-level runtime state outside `GameState` where possible.
- Keep deterministic RNG usage (`src/utils/rng.ts`) for simulation logic.
- Prefer incremental migration: keep the worker until parity tests pass, then remove.
- Maintain or improve performance: where single-threaded physics could become a bottleneck, outline mitigations (LOD, simplified colliders, sub-stepping, culling).

High-level architecture (post-migration)

- Rendering: `@react-three/fiber` remains the renderer.
- Physics: `@react-three/rapier` provides Rapier integration on the main thread. A Rapier provider component will mount once and expose the physics world to systems.
- ECS: `miniplex` remains the canonical ECS. Systems will query `GameState.world` to create, update, and remove Rapier bodies/ colliders to mirror ECS entities.
- AI: AI may continue to run on a worker optionally, but its commands (velocities, fire intents) will be applied to ECS state which then drives physics bodies in-thread.

Major components to add/modify

1. RapierProvider (React component)
   - Wraps the scene and initializes r3f Rapier context with deterministic settings.
   - Exposes accessors/hooks for low-level body creation (for systems) and provides a stable update tick event.

2. Physics adapter system (ECS system)
   - Responsible for creating Rapier bodies when ECS entities spawn, updating body properties from ECS (position, velocity, apply force/impulse), and writing back physics results (predicted position, velocity) into the ECS components.
   - Uses `miniplex` queries to find ships, projectiles, and other collidables.
   - Runs at a fixed timestep (configurable via `src/config/simConfig.ts`).

3. r3f-rapier body factories
   - Small helpers to create RigidBody and Collider based on entity `ShipComponent` and `ProjectileComponent` data.
   - Keep collider shapes simple (sphere/box) to reduce CPU cost.

4. ECS-driven update loop
   - An orchestrator that runs the physics step, then queries entities and writes back transforms and derived properties (health changes from collisions, TTL for projectiles, etc.).
   - Ensure changes to `GameState` are batched or atomic to avoid render-time glitches.

5. AI and input integration
   - AI worker (if still used) posts intents to main thread APIs (not direct physics), which update ECS state.
   - For deterministic local-only AI, provide an in-thread fallback controlled by config.

6. Tests and determinism checks
   - Unit tests verifying that physics step produces consistent transforms for same seed and inputs.
   - Smoke tests replacing simWorker-based tests.

Incremental migration strategy (step-by-step)

Phase 0 — Preparatory
- Add `plan` and `migration` tasks (this document).
- Add feature flag config: `sim.useWorker` (default: true during migration).
- Write integration tests that assert current worker-driven behavior (baseline). Keep them passing.

Phase 1 — Provider & adapter scaffolding (non-destructive)
- Add `RapierProvider` component that mounts r3f Rapier runtime but does not yet drive entities.
- Add physics adapter API surface: `createBodyForEntity`, `updateBodyForEntity`, `destroyBodyForEntity` (no-op while worker enabled).
- Add `physics` namespace in `GameState` for mapping ECS entity -> Rapier body IDs.

Phase 2 — ECS sync for passive entities
- Start mirroring non-interactive entities (e.g., static obstacles) into in-thread physics via adapter and validate.
- Keep worker for active entities.

Phase 3 — Ships and projectiles
- Implement full adapter logic for ships and projectiles; when `sim.useWorker === false`, the adapter owns body lifecycle and steps physics.
- Add write-back from physics into ECS transforms (position, velocity).
- Port bullet creation: instead of posting to worker, create projectile entity and create Rapier body via adapter.

Phase 4 — Replace worker stepping
- Disable worker stepping when flag is false and let the main-thread Rapier step run at configured tick rate.
- Run simulation tests to compare outputs with worker baseline; iterate until parity or acceptable differences with documented reasons.

Phase 5 — Cleanup
- Remove worker code, tests, and scripts dependent on the worker.
- Update docs (README.md, AGENTS.md, memory files) with new architecture notes.

Acceptance criteria

- All unit tests pass (update or rewrite worker-dependent tests).
- Deterministic scenarios produce the same results across runs (with same seed), or differences documented and covered by tests.
- Performance remains acceptable for target platforms; document any regressions and mitigations.
- `GameState` remains canonical; no global runtime state leaks.

Key tradeoffs and notes

- Pros of removing worker and using r3f Rapier:
  - Easier integration with React and react-three-fiber components.
  - Simplified debugging (no cross-thread message complexity).
  - Ability to use r3f helpers (hooks, colliders, event handlers) and tighter integration with scene graph.

- Cons:
  - Physics runs on main thread; could hurt frame-rate on low-end devices. Mitigations: lower physics update rate, simplify colliders, use LODs, optionally run AI in worker.
  - May require reworking some deterministic assumptions if worker timing previously provided strong isolation.

Developer checklist for implementing changes

- [ ] Add feature flag `sim.useWorker` and default to `true` until migration finished.
- [ ] Implement `RapierProvider` using `@react-three/rapier` and wire configuration from `src/config/simConfig.ts`.
- [ ] Implement physics adapter API and integrate with `GameState` (mapping entities -> bodies).
- [ ] Replace `simWorker` message producers with direct adapter calls (create/update/destroy).
- [ ] Port AI integration so intents update ECS instead of posting to worker.
- [ ] Port projectile lifecycle and TTL management to ECS + Rapier collider callbacks (use event handlers from r3f rapier).
- [ ] Update tests: port worker-based tests to new in-thread tests.
- [ ] Run `npx tsc --noEmit` and `npm test` and fix issues.

Open questions (decision points)

- Keep AI in worker? (Recommended: keep AI in worker initially to preserve CPU distribution, but have clear UI/IPC to apply intents to ECS.)
- How strict must determinism be compared to worker version? Full bit-for-bit parity may be impossible; define acceptable divergence and tests.
- Which Rapier build to prefer? `@dimforge/rapier3d-compat` or `@react-three/rapier`'s peer dependency — pick consistent package and single import surface.

Milestones & timelines

- Week 0: Plan, feature flag, add RapierProvider scaffolding.
- Week 1: Implement adapter, mirror static entities, smoke tests.
- Week 2: Port ships/projectiles, run parity tests, fix issues.
- Week 3: Disable worker, run full test-suite and performance tuning.
- Week 4: Clean up worker artifacts, finalize docs.

Appendix: Quick anti-patterns to avoid

- Do not introduce module-level physics world state outside `GameState`.
- Do not call heavy physics APIs directly from React render without using effects/hooks and stable refs.
- Avoid attaching complex game logic to Rapier callbacks that mutate `GameState` outside controlled batches.

-- End of plan
