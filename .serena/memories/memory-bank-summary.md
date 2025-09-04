SpaceAutoBattler memory-bank summary (added 2025-09-04):

- Required memory files and locations:
  - projectbrief.md (memory/projectbrief)
  - productContext.md (memory/productContext)
  - activeContext.md (memory/activeContext)
  - systemPatterns.md (memory/systemPatterns)
  - techContext.md (memory/techContext)
  - progress.md (memory/progress)
  - tasks/ folder (memory/tasks/) with `_index.md` and individual `TASKID-*.md` files.

- Key agent rules:
  1) Agent MUST read all memory-bank files at the start of every task.
  2) When the user requests "update memory bank" the agent must review ALL memory bank files and update relevant entries.
  3) Tasks must be tracked in `memory/tasks/` and `_index.md` must be updated when task status changes.
  4) Memory Bank is canonical for project decisions, tech context, progress, and task history.

- Workflows and structure:
  - Plan Mode: read memory bank → check completeness → generate plan.
  - Act Mode: consult memory bank → execute → update memory and task files.

- Where to persist: memory/ folder in repo; use the memory API to create or update nodes.

- Notes for future agents: prefer the memory bank files for context; update `progress.md` after major changes.

