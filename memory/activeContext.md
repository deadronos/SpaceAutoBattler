# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Finish AI v2 rollout: trait-driven scoring variance, runtime metrics, and documentation to support QA/debugging.
- Validate gameplay after 2025 rewrite (main-thread Rapier + R3F + Miniplex) while preserving legacy behavior when AI v2 is disabled.
- Improve unit test coverage for AI intent scoring/movement and projectile resolution.

Recent changes:

- Added trait multipliers (`generateTraitsFromSeed`) so aggression/patience/dodge vary per ship while staying deterministic.
- Instrumented `state.ai.metrics` to record decision counts, skipped ships, and budget hits per tick.
- Refreshed docs/memory to explain trait usage and debug counters.

Next steps:

- Author deterministic Vitest suites for AI scoring (posture/escort influence) and confirm command streams remain stable per seed.
- Wire a UI/config toggle for QA to enable/disable AI v2 at runtime (if not already exposed).
- Extend perf harness to measure AI tick budget under 300-ship load with new scheduler.

Updated: 2025-09-22
