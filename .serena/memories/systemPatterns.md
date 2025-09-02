# System Patterns — SpaceAutoBattler

Architecture overview
- Two-layer architecture: deterministic simulation (`src/core`) and renderer (`src/renderer`). The front-end (`src/main.ts`) orchestrates IPC with `src/simWorker.ts` for headless simulation runs.

Patterns
- Message-based simWorker protocol: small, serializable messages to update game state and request snapshots.
- AssetPool: LRU cache for assets to avoid reloading large GLTFs.
- Lock utilities: file-based locks under `src/agent/lockUtils.ts` for concurrent tooling.
- Config-driven behavior toggles: `behaviorConfig` centralizes experimental flags.

Testing patterns
- Unit tests for core logic under `test/vitest`.
- Playwright for E2E and UI tests under `test/playwright`.

Generated/updated: 2025-09-02 by Serena agent.