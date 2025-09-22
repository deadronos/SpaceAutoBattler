# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Land AI v2 skeleton: deterministic decision system, blackboard scheduling, and profile-driven ship commands behind feature flag.
- Validate gameplay after 2025 rewrite (main-thread Rapier + R3F + Miniplex) while preserving legacy behavior when AI v2 is disabled.
- Improve unit test coverage for AI intent scoring/movement and projectile resolution.

Recent changes:

- Added `GameState.ai` manager + blackboard scaffolding seeded from `config.ai` (v2 disabled by default).
- Implemented `updateDecisionSystem` in `systems.ts`, per-ship AI components, and new behavior profiles (`src/game/aiProfiles.ts`).
- Refactored `prepareShips` to execute AI commands while retaining legacy nearest-enemy fallback; embedded turret logic shared across both paths.

Next steps:

- Author deterministic Vitest suites for AI scoring (posture/escort influence) and confirm command streams remain stable per seed.
- Wire a UI/config toggle for QA to enable/disable AI v2 at runtime (if not already exposed).
- Extend perf harness to measure AI tick budget under 300-ship load with new scheduler.

Updated: 2025-09-22
