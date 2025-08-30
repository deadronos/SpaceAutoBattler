---
title: Opencode Agents for SpaceAutoBattler (canonical agent folder)
---

This folder contains per-project OpenCode agent definitions and supporting prompts tailored for the SpaceAutoBattler repository. Files here follow OpenCode's markdown agent format (YAML frontmatter + body). The agent files are intentionally conservative with permissions; adjust `permission` and `tools` per your risk posture.

Quick pointers

- Default folder used by opencode: `.opencode/agent/` (singular). This repository also contains `.opencode/agents/` (plural) for convenience; keep the canonical copies here for the opencode CLI.
- Routing conventions (see `policies.md`): use namespaced task types like `planner:decompose`, `coder:implement`, `reviewer:review-patch`.
- Prompts are stored in `prompts/` and referenced in frontmatter via `prompt: "{file:./prompts/<name>.txt}"`.

Files in this folder

- `core.md` — orchestrator / primary agent
- `planner.md` — decomposition & task creation
- `coder.md` — patch generation (prefers producing patches)
- `reviewer.md` — read-only reviews and approvals
- `taskmanager.md` — task store / claims API (documented interface)
- `memory.md` — memory KV and summarization guidance
- `communicator.md` — external I/O guidance
- `policies.md` — global policies and limits (lineage, patch size, retries)
- `prompts/` — human-written prompt files referenced above

Suggested workflow

1. Create a top-level task (Planner-friendly description).
2. `core` routes to `planner` which emits subtasks.
3. `coder` produces patches.
4. `reviewer` inspects and approves.
5. `core` applies patches via controlled write/patch tools after approval.

Adjust the frontmatter `model` field to change provider or model (these files use `gpt-5-mini` by default as requested).
