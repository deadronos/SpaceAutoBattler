---
mode: 'agent'
description: 'Cookbook: create a concise GitHub feature issue from a spec file using the feature_request template.'
---

Receipt: I'll convert the provided spec into 3 actionable GitHub issues with acceptance criteria.

Plan:
1) Extract 3 distinct deliverables from the spec (smallest valuable increments).
2) For each, provide a title, short description, acceptance criteria, and estimated difficulty (S/M/L).
3) Output as Markdown ready to paste into GitHub issues.

Assumptions: Spec is short (≤ 600 words). If longer, summarise first.

Constraints: Keep each issue to ≤ 6 lines.

Output: Markdown list of 3 issues with fields: Title, Description, Acceptance, Estimate.

Example: Spec: 'Add shield regen' → Issues: design constants (S), implement regen logic (M), add tests (S).
