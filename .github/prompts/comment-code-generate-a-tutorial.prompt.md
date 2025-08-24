---
description: "Comment & tutorial generator — create beginner-friendly comments and a short README from provided code." 
mode: 'agent'
---

# Comment Code & Generate Tutorial — Cookbook Template

Receipt: I'll generate a short tutorial from the provided code snippet or file.

Plan:
1) Extract intent and public API from the code.
2) Produce a 6-step tutorial with code snippets and expected outputs.
3) Provide a short checklist of prerequisites and a one-line summary for README.

Assumptions: Input is a JS file or function; tutorial should be beginner-friendly.

Constraints: Keep tutorial under 700 words; code blocks ≤ 40 lines.

Output: Title, Prereqs, Steps (with code), Example run, One-line summary for README.

Example: "Tutorial for `src/simulate.js` — show how to seed RNG, construct minimal `state`, call `simulateStep`, and inspect `state.explosions`."
