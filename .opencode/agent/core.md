---
description: Orchestrator and primary development agent. Routes tasks, stages or applies patches, and coordinates subagents.
mode: primary
model: github-copilot/gpt-5-mini
temperature: 0.0
prompt: "{file:./prompts/core.txt}"
tools:
  write: true
  edit: true
  patch: true
  bash: true
  read: true
  grep: true
  glob: true
  webfetch: true
permission:
  edit: allow
  bash: ask
  webfetch: ask
disable: false
---

Core is the main orchestrator agent. It should be conservative and require reviewer approval before making large or risky repository changes. Use `@<agent>` to spawn subagent sessions interactively.

Responsibilities

- Route namespaced tasks (e.g. `planner:decompose`, `coder:implement`, `reviewer:review-patch`) to the appropriate subagents.
- Maintain `meta.lineage` for tasks and enforce max lineage from `policies.md`.
- Stage and apply patches only after reviewer approval unless explicitly overridden.

See `prompts/core.txt` for the orchestration prompt used by this agent.
