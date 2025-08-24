---
mode: 'agent'
description: 'Cookbook: generate GitHub issues from an implementation plan (one issue per phase) using feature/chore templates.'
---

Receipt: I'll generate GitHub issues from the given implementation plan.

Plan:
1) Break the plan into 4–6 issues (each deliverable small and testable).
2) For each issue provide Title, Description, Acceptance, Files to edit, Estimate.
3) Output as Markdown-ready issues for copy/paste.

Assumptions: Implementation plan lists tasks in order.

Constraints: Prefer issues no larger than 'M' difficulty.

Output: Markdown with issues numbered and succinct fields.

Example: Plan: Add Playwright tests + CI → Issues: Add Playwright scaffold (M), Add tests for login (S), CI step for Playwright (S).
