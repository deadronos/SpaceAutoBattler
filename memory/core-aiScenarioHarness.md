# Memory — core-aiScenarioHarness

File: `src/game/aiScenarioHarness.ts`

Summary

- Provides a lightweight, deterministic harness (`runAIScenario`) that wraps the AI V2 scheduler for headless scenario playback.
- Builds stub `GameState`/`ShipEntity` instances (no Rapier dependency) with configurable ship layouts, optional velocities, and seeded traits using `SeededRng`.
- Steps the scheduler via `runDecisionTick`, logs per-tick commands (intent, target, thrust, heading, score, LOD), and applies simplified kinematics so positions drift according to issued commands plus optional scripted velocities.
- Normalises logs into rounded arrays suited for JSON fixtures; used by `test/vitest/ai-scenario-harness.spec.ts` to compare against golden outputs (escort/intercept/regroup, heavy bomber intercept, artillery retreat).

Key details

- Harness ships stash optional `__harnessVelocity` vectors so intercept scenarios can simulate fast movers without physics.
- Log entries include team posture snapshots to make behavior shifts (aggressive/hold/retreat) explicit.
- Movement integration reuses pooled `Vector3` instances (`HARNESS_TEMP`) and clamps positions with `clampToWorld` for determinism.
- Intended for tooling/tests only; runtime sim still uses full `updateGame` path.

Follow-ups

- Extend fixture coverage when new intents or posture rules appear; keep scenarios short to avoid brittle logs (current set: escort/VIP defense, heavy bomber intercept, artillery retreat).
- Consider exporting helper utilities to snapshot AI debug overlay metrics for docs/QA once the HUD pipeline stabilises.
- If designers need to author scenarios directly, extract config typing to a shared location and surface CLI wrappers.

Created: 2025-09-24
