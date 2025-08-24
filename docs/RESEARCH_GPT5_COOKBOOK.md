# Research: GPT-5 Cookbook (prompting & tooling best practices)

This concise cookbook collects practical, copyable prompt patterns and tool-use etiquette for working with GPT-style coding assistants in this repository. It's tuned for code-first workflows: small, test-backed iterations; clear assumptions; and reproducible tool calls.

Purpose
-------
- Help engineers and contributors produce high-signal prompts for common repository tasks (specs, tasks, tests, PRs, refactors, Playwright tests, and prompt-building).
- Provide safe tool-call patterns and short templates you can copy/paste into chat or automation.

Sources
-------
- OpenAI Cookbook — GPT-5 prompting guide: https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
- Repo-specific prompts: .github/prompts/*.prompt.md (use these as canonical templates for repo activities)

Core principles (quick)
----------------------
- Short receipt + tiny plan: begin with a one-line "I will..." and a 1–3 step plan.
- Be explicit: state assumptions and expected outputs (file paths, formats).
- Iterate small: make minimal changes, add focused tests, run targeted tests, repeat.
- Tool-aware: announce commands before running them and summarize results after.
- Safety first: never exfiltrate secrets or run unsafe external commands without explicit approval.

Fast utility section (why this file exists)
-----------------------------------------
- Purpose: a compact, actionable cookbook of prompt templates and patterns you can copy/paste when working with GPT-style coding assistants in this repo.

Core recipe patterns
--------------------

1) One-line receipt + 3-step plan (for edits)

- Receipt: "I'll update `path/to/file` to <change summary>."
- Plan: "Plan: 1) change X, 2) add/update tests Y, 3) run tests and report results." 

When to use: code edits, bug fixes, small features.

2) Assumption + fallback (when inputs are missing)

- Pattern: "Assumption: <assumed value>. If this is wrong, tell me the correct value and I'll update the edit." 

Example: "Assumption: the browser viewport is 800x600 unless you tell me otherwise."

3) Tool-call etiquette (before/after)

- Before: "I'll run: <command> to <purpose> (expected outcome: ...)."
- After: "Ran: <command>. Result: <short summary>." Include failing assertions or error lines when tests fail.

Concrete prompt templates (copy/paste)
------------------------------------

1) Create a short spec (requirements.md)

Prompt:
"Write a short `requirements.md` for feature: <feature-name>. Use EARS format. Include 3 testable acceptance criteria and 2 edge cases. Keep it under 200 words."

2) Create an implementation plan (tasks.md)

Prompt:
"Produce a `tasks.md` for implementing <feature-name>. Include: (a) 6 ordered steps, (b) files to edit, (c) tests to add, (d) a low-risk rollout plan. Keep it concise." 

3) Generate a Playwright test (follow repo Playwright rules)

Prompt:
"Generate a Playwright TypeScript test `tests/<feature>.spec.ts` that follows the project's Playwright guidelines: role-based locators, `test.step()`, and web-first assertions. Scenario: <short scenario>. Include 3 assertions and a brief `beforeEach` that navigates to the page." 

4) Review & refactor code (safe, minimal)

Prompt:
"Review `path/to/file.js` and propose a minimal refactor that improves readability and performance without changing public APIs. Provide a 1-paragraph rationale and a patch (diff) with tests if behavior changes." 

5) Create a PR description template

Prompt:
"Generate a PR body for a change that does: <one-line summary>. Include: Summary, Testing steps, Rollback instructions, and 'Risk & Mitigation' (3 bullets). Keep to ~200-350 words." 

6) Prompt-builder (meta-prompt for generating prompts)

Template:
"Create a concise prompt for: <task>. The prompt must start with a single-line receipt, include a 2-step plan, and an explicit assumption section (1 sentence). Keep the final prompt under 120 words." 

Representative conversions from `.github/prompts`
------------------------------------------------
- `create-specification.prompt.md` → Use the spec template above.
- `playwright-generate-test.prompt.md` → Use the Playwright test template and follow the project's Playwright instructions.
- `create-github-issue-feature-from-specification.prompt.md` → "From the following spec, create 3 GitHub issue titles with short descriptions and acceptance criteria."
- `review-and-refactor.prompt.md` → Use the review & refactor template; request a patch and small tests.
- `prompt-builder.prompt.md` → Use the prompt-builder meta-template.

Short, high-signal prompt patterns (1-liners)
-------------------------------------------
- Fix a failing test: "Find and fix the failing test `test/path.test.js` — show the failing assertion, propose a minimal change, and add a regression test." 
- Add instrumentation: "Add console traces to `path/to/file` around <function> to help diagnose timing issues; keep them behind a `DEBUG` flag and add a test that toggles the flag." 
- Create a minimal demo page: "Produce `demo/<feature>.html` that loads `src/renderer.js` and demonstrates the feature with a toggle button." 

Prompt safety and non-goals
--------------------------
- Never ask the assistant to run unapproved external network calls or exfiltrate repository secrets. 
- Avoid open-ended 'do everything' prompts — add boundaries (time, line limits, files to touch).

Playbook: iterate safely on code changes (3-step loop)
--------------------------------------------------
1) Small change + test: Make the smallest change that could fix the issue and add a focused test. 
2) Run targeted tests: Run only relevant tests (e.g., `test/entities.*.test.js`) and capture failing output. 
3) Repeat: If failing, adjust only the minimal code needed; if green, prepare PR with summary and small risk notes.

Templates for tool invocation logging (before/after)
--------------------------------------------------
- Before running tests locally: "I'll run `npm test -- tests/entities.*.test.js` to validate the change (expect: 1 failing test to be fixed)."
- After: "Ran `npm test -- tests/entities.*.test.js`. Results: 12 passed, 1 failed — failure: `entities.shields.test.js` line 42: expected X to equal Y." 

Cheat-sheet: Which `.github/prompts` to use for common activities
----------------------------------------------------------------
- New feature spec → `create-specification.prompt.md`
- Small code change & tests → `breakdown-test.prompt.md`, `review-and-refactor.prompt.md`
- PR/issue generation → `create-github-issue-feature-from-specification.prompt.md`, `create-github-issues-feature-from-implementation-plan.prompt.md`
- Playwright tests → `playwright-generate-test.prompt.md`, `playwright-automation-fill-in-form.prompt.md`
- Prompt creation/meta → `prompt-builder.prompt.md`, `code-exemplars-blueprint-generator.prompt.md`

Quick reference: A minimal, reproducible prompt template
------------------------------------------------------
Use this when you want code changes and tests in one iteration:
"Receipt: I'll change `path/to/file.js` to <one-line>.
Plan: 1) implement small change, 2) add 1 unit test, 3) run targeted tests.
Assumption: <brief assumption>. If wrong, tell me.
Output: show the patch and the test output (only the lines with failures or PASS)."

Next steps and recommended follow-ups
------------------------------------
- Add repository-specific prompt templates into `.github/prompts/` as you find common patterns — keep them short and canonical.
- For complex changes, follow the Spec-Driven Workflow in `.github/instructions/spec-driven-workflow-v1.instructions.md` (write `requirements.md`, `design.md`, `tasks.md`).

Appendix: Short examples (copyable)
----------------------------------
1) Playwright test prompt (example):
"Generate a Playwright test `tests/login.spec.ts` that navigates to `/login`, fills the username and password fields, submits the form, and asserts the URL changed to `/dashboard` and that the main heading contains the username. Use role-based locators and `test.step()`." 

2) PR body prompt (example):
"Write a PR body for 'feat: improve shield damage calculation' including Summary, Files changed, How I tested (commands), Rollback, and Risk (3 bullets)."

3) Prompt-builder example:
"Create a prompt that asks an assistant to produce a unit test for `src/simulate.js` that verifies `simulateStep` emits `state.shieldHits` when shields absorb damage. Include seed `srand(1)` and a short test harness."
