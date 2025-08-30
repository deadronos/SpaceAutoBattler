---
description: Decompose high-level work into concrete subtasks with acceptance criteria and estimates.
mode: subagent
model: gpt-5-mini
temperature: 0.1
prompt: "{file:./prompts/planner.txt}"
tools:
  read: true
  grep: true
  glob: true
  webfetch: true
  write: false
  edit: false
  bash: false
permission:
  edit: deny
  bash: deny
  webfetch: ask
disable: false
---

Planner produces structured subtasks. Each subtask must include `id`, `type`, `payload`, and `meta` with `priority` and `estimate` (minutes).

Example output (JSON):

```json
[
  { "id": "T1-spec", "type": "planner:create-spec", "payload": {"feature":"X"}, "meta":{"priority":70, "estimate":30} },
  { "id": "T1-impl", "type": "coder:implement", "payload": {"feature":"X"}, "meta":{"priority":60, "estimate":120} }
]
```
