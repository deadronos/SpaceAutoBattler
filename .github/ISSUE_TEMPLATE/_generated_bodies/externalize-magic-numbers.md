# Externalize magic numbers to configs

State now

- Several thresholds and weights exist as inlined literals across AI and physics.
- Tuning requires code edits instead of configuration changes.

Expected outcome

- Identify top 5–8 impactful constants and expose them via `behaviorConfig`, `physicsConfig`, or `rendererConfig` with typed defaults and docs.
- Replace usages to read from config; keep backward-compatible defaults.

Acceptance criteria

- A PR updates constants with config lookups and adds documentation entries.
- Unit tests cover at least two parameters showing behavior changes when values vary.
- No regressions in existing tests; build remains green.

Guidance for testing

- Write focused tests for parameters like accel/brake weights or targeting thresholds, asserting measurable deltas when configs change.
- Run full suite to ensure no regressions.
