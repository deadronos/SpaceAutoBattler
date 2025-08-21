# Copilot Chat Prompt Templates for SpaceAutoBattler

This file contains vetted prompt templates to use with Copilot Chat when working on the SpaceAutoBattler repository. Use these templates verbatim or as a starting point — they enforce the repo's deterministic-simulation contracts, minimal edits, and testing-first workflow.

---

## 1) Small deterministic gameplay change (Prompt Builder)

Use when you want a minimal gameplay tweak that maintains determinism.

```text
You ARE the Prompt Builder for the SpaceAutoBattler repo. I need a minimal change that does [brief goal: e.g., increase ship base damage by 10%] without breaking determinism.

Requirements:
 - Update only the smallest number of files.
 - Add or update unit tests (Vitest) that seed the RNG via srand(seed) and assert deterministic result.
 - Preserve simulateStep event shapes (explosions, shieldHits, healthHits).
 - Do not use Math.random() for logic; use `src/rng.js` functions for any randomness.

Deliverables:
 - Files to modify with a short rationale comment in code.
 - Tests added/updated under `test/` that run quickly.
 - A one-line commit message prefixed with `feat:`.
 - Run `npm run ai:smoke` (or `npm run test:ci` + `node ./scripts/build-standalone.mjs`) and include the output summary.
```

---

## 2) Test-only validation (Prompt Tester)

Use this when you want Copilot Chat to only run tests and summarize failures.

```text
You ARE the Prompt Tester. I will:
 1. Run `npm run test:ci` (Vitest) and capture output.
 2. Seed RNG where relevant (e.g., call `srand(12345)` in tests or test setup).
 3. Document failing tests with stack traces and minimal repro steps.

Output: JSON-like summary
{
  status: pass|fail,
  failures: [ { testName, message, file, line, snippet } ]
}
```

---

## 3) Fix failing test (Prompt Builder)

Use when a test fails and you want Copilot Chat to propose a minimal fix.

```text
You ARE the Prompt Builder. Fix the failing test named "[testName]" which fails with "[error message]".
Constraints:
 - Preserve determinism: do not replace RNG usage with Math.random().
 - Add a short comment in the changed file explaining root cause.
 - Update or add a unit test to cover the fix.
 - Keep changes minimal and surgical; update only files necessary.
Deliverables:
 - Files changed, a one-line commit message "fix: <brief>", and test output after running `npm run test:ci`.
```

---

## 4) Renderer-only visual tweak (Prompt Builder)

Use for purely visual changes that must not alter simulation state.

```text
You ARE the Prompt Builder. Make a visual-only change in the renderer (e.g., particle color, shield arc width) and ensure simulateStep and game logic are untouched.
Rules:
 - Do not change `simulate.js`, `entities.js`, or progression logic.
 - Add visual-only tests where applicable (render smoke test that checks the renderer produced expected event arrays after simulateStep).
Deliverables:
 - Renderer file edits and a short rationale comment.
 - Optional: small Playwright or headless-render test that verifies no simulation state changes.
```

---

## 5) WebGL capture & diagnosis (Prompt Builder)

Use when diagnosing WebGL draw/instancing issues in the `webgl-streaming-instancing` branch.

```text
You ARE the Prompt Builder. Provide a step-by-step plan to capture a single-frame WebGL trace (Spector.js preferred), list the exact points in code to instrument (file and function), and propose a minimal code patch to log instance buffer contents before draw calls.
Rules:
 - Only add dev-only instrumentation guarded by a `DEBUG_WEBGL` flag.
 - Do not alter simulation contracts or event shapes.
Deliverables:
 - A short patch (dev-only) and the exact Spector capture steps.
```

---

## 6) PR / Commit etiquette template

```text
When proposing changes, use this checklist in the PR description:
 - [ ] Small, focused commit(s).
 - [ ] Tests added/updated and passing locally (`npm run test:ci`).
 - [ ] Built standalone file (`node ./scripts/build-standalone.mjs`) if build-affecting.
 - [ ] Renderer changes documented as visual-only if applicable.
 - [ ] Determinism preserved: RNG seeded in tests and no Math.random() in logic.
```

---

Add more templates as needed; keep this file under version control so Copilot Chat and contributors have a canonical set of prompts to reuse.
