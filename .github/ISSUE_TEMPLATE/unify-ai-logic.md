---
name: Unify AI logic paths (make AIController authoritative)
about: Remove duplicated movement/targeting logic and centralize behavior in AIController
title: "Unify AI logic paths: make AIController authoritative"
assignees: []
---

State now

- Movement/targeting and some AI decisions exist in both `src/core/aiController.ts` and `src/core/gameState.ts` (e.g., `stepShipAI`).
- Two sources of truth risk conflicting updates, harder debugging, and brittle balance.

Expected outcome

- `AIController` is the single authority for AI intents, steering, and turret decisions.
- `GameState` retains plumbing only (state mutation, events, damage/XP), not strategic AI decisions.
- Documentation reflects the single-path architecture.

Acceptance criteria

- `stepShipAI` is removed or reduced to thin delegation into `AIController` without behavior duplication.
- All existing Vitest suites pass with no functional regressions.
- A smoke scenario (10–20 ships per side, 10s sim) shows consistent trajectories relative to baseline.
- Code owners agree on the API boundary between GameState and AIController (short doc note committed).

Guidance for testing

- Add/adjust unit tests where needed to target intent reevaluation and steering outputs.
- Run full Vitest; monitor AI-related tests for behavior changes.
- Optional smoke: run `tmp/smoke-render-check.cjs` or project’s debug scripts to visually confirm consistent behavior.
