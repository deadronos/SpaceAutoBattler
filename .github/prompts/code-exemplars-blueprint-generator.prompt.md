---
description: "Code exemplars generator — concise prompt to find and document representative, high-quality code samples in a repo." 
mode: 'agent'
---

# Code Exemplars — Blueprint Generator

Receipt: I'll produce 2–3 minimal code exemplars demonstrating the requested API or pattern.

Plan:
1) Provide a short explanation of the pattern (1–2 lines).
2) Give 2 small code examples (happy path and edge case), each ≤ 20 lines.
3) Suggest file names and where to place them in the repo.

Assumptions: Language defaults to JavaScript unless specified.

Constraints: Keep each example self-contained and runnable where possible.

Output: sections: Summary, Examples (with filenames), Notes.

Example: "Exemplar: seeded RNG usage" → Example 1: `test/rng.seeded.test.js` with `srand(1)` and deterministic output; Example 2: show failure case handling when seed not set.
