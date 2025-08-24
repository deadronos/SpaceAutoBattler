---
mode: 'agent'
description: 'Cookbook: generate a concise, machine-readable implementation plan for a specified purpose.'
---

Receipt: I'll create a concise implementation plan for the requested feature.

Plan:
1) Produce 6 ordered tasks (design → tests → implement → validate → docs → PR).
2) For each task list files to change, an acceptance test, and estimated effort.
3) Provide a short rollback/backout plan.

Assumptions: Feature is medium complexity; adjust if user provides scale/constraints.

Constraints: Keep plan to ≤ 6 tasks and ≤ 300 words.

Output: Numbered tasks with file references and acceptance criteria.

Example: 'Add XP crediting for bullet owner' → tasks: design constants, update Bullet(ownerId), award XP in simulateStep, tests, docs, PR.

