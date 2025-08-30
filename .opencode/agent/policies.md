---
description: Global policies and limits for the opencode agent pack.
mode: subagent
model: github-copilot/gpt-5-mini
temperature: 0.0
prompt: ""
tools:
  read: true
  write: false
permission:
  edit: deny
disable: false
---

# Policies

- `maxLineage`: 20
- `maxPatchSizeLines`: 500
- `requiredApprovalForWrite`: true
- `defaultRetryPolicy`:
  - retries: 3
  - initialDelayMs: 1000
  - multiplier: 2

Permission matrix summary:

- `core`: { edit: allow, bash: ask }
- `planner`: { edit: deny }
- `coder`: { edit: deny, patch: produce-only }
- `reviewer`: { edit: deny }
- `taskmanager`: { edit: allow }
