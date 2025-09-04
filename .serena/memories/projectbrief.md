# Project Brief — SpaceAutoBattler

Purpose
- Lightweight 3D space combat simulator for research and experimentation.
- Separate deterministic simulation (core/) from rendering (renderer/) so logic can be run headless and tested repeatedly.

Primary goals
- Provide a deterministic simulation core that supports fast unit tests and reproducible experiments.
- Offer a renderer and visualization layer for manual inspection and E2E testing.
- Maintain a small, testable API surface for AI controllers and game orchestration.

Key constraints
- Determinism: simulation must be reproducible when using the canonical GameState and fixed RNG seeds.
- Performance: reasonable single-threaded CPU and WebGL rendering; heavy physics offloaded to Rapier.
- Portability: run in-browser, headless test environments, and bundling for standalone builds.

Acceptance criteria
- Core simulation functions have unit tests under test/vitest.
- Message protocol between main thread and simWorker is documented and stable.
- Basic CI runs lint + tests + build without sync file reads.

Primary contacts
- Repository owner: deadronos (GitHub)

Generated/updated: 2025-09-02 by Serena agent.