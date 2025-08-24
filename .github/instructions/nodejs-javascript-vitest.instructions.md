---
description: "Guidelines for writing Node.js and JavaScript code with Vitest testing"
applyTo: '**/*.js, **/*.mjs, **/*.cjs'
---


# Node.js + Vitest — Short Guide

Receipt: "Write Node.js code (ESM, Node 20+), add Vitest tests."

Plan: 1) Async/await, small pure functions. 2) 2–3 Vitest cases (happy + edge).

Checklist:
- [ ] No new deps unless justified
- [ ] All state via canonical GameState if simulation
- [ ] Tests: happy path + edge

End.
