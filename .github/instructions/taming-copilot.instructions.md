---
applyTo: '**'
description: 'Taming Copilot — Compact rules to keep automated edits safe, minimal, and test-backed.'
---

# Taming Copilot — Quick Guide

Receipt (1-line): Before changing code, read related files and tests, state a concise intent, make the smallest surgical edit, add/adjust tests if behavior changes, then run the test suite.

Tiny plan:
- Inspect affected files and existing tests.
- Announce intent (one sentence) before any edit.
- Make a single, minimal change (one logical concern per commit).
- Add or update unit tests for behavior changes.
- Run tests; fix regressions; push with a descriptive commit message.

Assumptions:
- Repository uses standard JS/Node tooling (Vitest/npm). If uncertain, confirm before running commands.

Do / Don't checklist:
- DO state intent before using tools or editing files.
- DO prefer small, test-covered changes over large refactors.
- DO run the test suite and fix failures locally before committing.
- DO use seeded RNG from src/rng.js for logic randomness.
- DON'T edit many files in one commit without a clear migration plan.
- DON'T change public simulation contracts (simulateStep, event shapes) without adding tests and updating consumers.
- DON'T exfiltrate secrets or run external network calls without explicit approval.

One-line intent template:
"I'll update <file> to <short change>, add test <test-name>, run tests, and push if all pass."

Verification: run the project's test script (npm test) and confirm all tests pass; include a short summary in the commit/PR.
