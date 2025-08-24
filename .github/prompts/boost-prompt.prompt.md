---
mode: agent
description: 'Prompt refinement workflow — stepwise clarifications, deliverables, and final improved prompt.'
---

# Prompt Refinement — Cookbook Template

Receipt: I'll rewrite the given prompt to be more specific, constrained, and testable.

Plan:
1) Identify ambiguities and missing constraints.
2) Add a 1-line acceptance test or expected output example.
3) Produce a tightened prompt and an optional brief justification.

Assumptions: The user wants a version that yields deterministic, code-focused results.

Constraints: Keep improved prompt ≤ 80 words. Provide an example input/output.

Output: {improvedPrompt, justification, example}

Example:
- Input: "Generate tests for simulate.js" → Improved prompt: "Generate a Vitest unit test for `src/simulate.js` that seeds RNG with `srand(1)` and asserts `state.shieldHits` length > 0 after one step."
