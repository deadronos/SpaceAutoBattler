---
description: "Test planning cookbook — compact prompt to generate test plans and issue templates for Vitest/Playwright." 
mode: 'agent'
---

# Test Plan — Cookbook Template

Receipt: I'll produce a compact test plan and a breakdown of unit/integration tests for the specified feature or failing test.

Plan:
1) Identify the minimal unit tests to assert correct behavior (3 tests max).
2) Identify any integration tests needed and list fixtures/setup.
3) Provide example test names, brief code skeletons, and which files to add them under `test/`.

Assumptions: Repo uses Vitest; seed RNG for deterministic tests.

Constraints: Return up to 3 unit test skeletons and 1 integration example. Use `srand(1)` where randomness is involved.

Output: YAML-like list: tests: [{name,filePath,description,codeSnippet}]

Example:
- Feature: shield absorption → tests: shield_absorb_unit.test.js (assert shield decreases, health unchanged), simulate_step_integration.test.js (seed RNG then run simulateStep and assert state.shieldHits emitted).
