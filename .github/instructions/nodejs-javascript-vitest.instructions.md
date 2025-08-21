---
description: "Guidelines for writing Node.js and JavaScript code with Vitest testing"
applyTo: '**/*.js, **/*.mjs, **/*.cjs'
---

# Code Generation Guidelines

## Coding standards
- Use JavaScript with ES2022 features and Node.js (20+) ESM modules
- Use Node.js built-in modules and avoid external dependencies where possible
- Ask the user if you require any additional dependencies before adding them
- Always use async/await for asynchronous code, and use 'node:util' promisify function to avoid callbacks
- Keep the code simple and maintainable
- Use descriptive variable and function names
- Do not add comments unless absolutely necessary, the code should be self-explanatory
- Never use `null`, always use `undefined` for optional values
- Prefer functions over classes

---
description: "Node.js + Vitest cookbook-style quick guide: short receipts, minimal plan, and test templates."
applyTo: '**/*.js, **/*.mjs, **/*.cjs'
---

# Node.js + Vitest — Quick Guide

Receipt: "Generate or modify Node.js code and provide a small Vitest suite: one-line task + 2-step plan."

Plan (use this pattern):
- 1) State environment & inputs (Node 20+, ESM). 2) Implement feature (async/await, small functions). 3) Add 2–3 Vitest cases (happy path + edge case).

Assumptions:
- Default runtime: Node.js 20+ (ESM).  
- Prefer built-ins; ask before adding deps.  

Minimal coding rules:
- Use async/await for async flows.  
- Favor small pure functions and avoid mutation where possible.  
- Use undefined (not null) for optional values if project convention uses it.  

Testing pattern (tiny template):
// Test file structure (Vitest)
import { test, expect } from 'vitest';
import { fnUnderTest } from './module.js';

test('happy path', () => {
	expect(fnUnderTest(validInput)).toEqual(expected);
});

test('edge: invalid input', () => {
	expect(() => fnUnderTest(badInput)).toThrow();
});

Guidelines checklist before committing:
- [ ] Receipt & plan included in PR description.  
- [ ] Env specified (Node version, ESM/CJS).  
- [ ] Tests: happy path + ≥1 edge case.  
- [ ] No new deps without justification.  
- [ ] Lint/format matches repo conventions.

Notes:
- If a change is hard to test, add a small wrapper or seam (without changing existing behavior) and test the wrapper. Ask user if seam is acceptable.
