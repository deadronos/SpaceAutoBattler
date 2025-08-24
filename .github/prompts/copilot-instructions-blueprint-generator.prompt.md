---
description: "Copilot instructions blueprint — concise template to generate repo-specific Copilot guidance based on detected patterns and versions." 
mode: 'agent'
---

# Copilot Instructions — Cookbook Prompt

Receipt: I'll draft a concise Copilot/GPT assistant instruction set for maintainers to include in PRs or docs.

Plan:
1) Extract the high-level intent (who, what, why).
2) Provide 6 succinct rules the assistant should follow (max 80 chars each).
3) Provide a one-paragraph rationale and a sample PR checklist entry.

Assumptions: Audience are repository maintainers and automated agents.

Constraints: Keep result under 300 words; rules should be actionable.

Output: {intent,rules:[...],rationale,prChecklist}

Example: include rules: 'State intent before edits', 'Add tests for behavior changes', 'Preserve determinism (srand)'.