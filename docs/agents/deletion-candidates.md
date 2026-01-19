# Deletion candidates (redundant / vague / overly obvious)

This file lists instructions currently repeated across repo docs and agent guides that may be worth deleting or rewriting.

## Redundant (the agent already knows, or duplicated elsewhere)

- “Use `const`/`let` (no `var`).”
  - Rationale: baseline modern JS/TS guidance; also covered by linting.
  - Suggested action: delete from guides unless you have frequent regressions.

- “Use semicolons; two-space indentation.”
  - Rationale: formatting is already enforced by tooling (Prettier/ESLint).
  - Suggested action: keep only if contributors routinely fight the formatter.

- “Use Playwright docs at [playwright.dev/docs/codegen](https://playwright.dev/docs/codegen).”
  - Rationale: a useful link, but doesn’t encode a repo-specific rule.
  - Suggested action: keep as a link in `docs/agents/testing.md` (already done), but avoid repeating it in multiple files.

## Too vague to be actionable

- “Avoid complex setups.”
  - Rationale: unclear threshold.
  - Suggested rewrite: specify what to prefer (e.g., Testing Library + minimal spies) and what to avoid (e.g., deep module-mocking trees).

- “Prefer pooling/re-use.”
  - Rationale: useful intent, but lacks triggers.
  - Suggested rewrite: call out specific hot paths or a perf budget, and how to validate.

## Overly obvious

- “Write clear commit messages.”
  - Rationale: true but generic.
  - Suggested action: keep a single example format (already in `docs/agents/git-and-pr.md`) and remove the rest.
