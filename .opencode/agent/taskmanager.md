---
description: Task store and status manager. Documents the task API used by core and subagents.
mode: subagent
model: github-copilot/gpt-5-mini
temperature: 0.0
prompt: ""
tools:
  read: true
  write: true
permission:
  edit: allow
  bash: deny
  webfetch: deny
disable: false
---

# Task Manager

Interfaces (documented):

- `task:add(taskMessage)` - add a new TaskMessage to the queue
- `task:claim(taskId)` - claim a task for processing (returns boolean)
- `task:update(taskId, statusObject)` - update task status
- `task:fetch(taskId)` - fetch task payload and meta
- `task:history(taskId)` - return array of status events

TaskMessage schema (recommended):

```json
{ "id": "T123", "type": "planner:decompose", "payload": {...}, "meta": { "lineage": ["T0"], "priority": 50, "retries":0, "createdAt":"..." } }
```
