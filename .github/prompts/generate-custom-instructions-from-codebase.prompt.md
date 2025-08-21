---
mode: 'agent'
description: 'Cookbook: generate Copilot migration instructions summarizing differences between two refs and producing transformation rules and example pairs.'
---

Receipt: I'll generate short custom-instructions for an assistant by summarizing the provided code locations.

Plan:
1) Extract 3–5 high-value instructions (do/don't) specific to the repo (determinism, tests, file ownership).
2) Provide a 2-line rationale for each instruction.
3) Output as bullets ready for inclusion in `.github/CUSTOM_INSTRUCTIONS.md`.

Assumptions: User will provide file paths or repo areas to summarize.

Constraints: Keep to ≤ 10 bullets.

Example: 'Always use `srand()` for simulation randomness' with a short rationale about test determinism.
