---
applyTo: '**/.copilot-tracking/changes/*.md'
description: 'Instructions for implementing task plans with progressive tracking and change record - Brought to you by microsoft/edge-ai'
---

# Task Plan Implementation Instructions

You will implement your specific task plan located in `.copilot-tracking/plans/**` and `.copilot-tracking/details/**`. Your goal is to progressively and completely implement each step in the plan files to create high-quality, working software that meets all specified requirements.

Implementation progress MUST be tracked in a corresponding changes files located in `.copilot-tracking/changes/**`.

## Core Implementation Process

### 1. Plan Analysis and Preparation
```instructions
---
applyTo: '**/.copilot-tracking/changes/*.md'
description: 'Task implementation — concise checklist: read plan, implement step, update changes file, run tests.'
---

# Task Implementation — Quick Guide

Receipt (1-line): Read the plan & details, implement one task fully, append a one-line change record, run tests, repeat.

Micro-plan:
- Read the plan (./.copilot-tracking/plans/**) and the task details (./.copilot-tracking/details/**).
- Implement a single task from the plan (one task per commit).
- Update the plan checklist ([ ] → [x]) and append to the changes file in ./.copilot-tracking/changes/ with one-sentence Added/Modified/Removed entries.
- Run the test suite and fix any regressions before proceeding.

Minimal change-record template (append to changes file):
- Added: path/to/file - one-line description
- Modified: path/to/file - one-line description
- Removed: path/to/file - one-line description

One-line commit message template:
"feat: implement <plan-task-id> — <very short summary>"

Verification: After each task, run `npm test` (or the repo's test command). All tests must pass before marking the next task.

Safety notes:
- Make minimal edits and prefer tests over large refactors.
- If behavior contracts change (public APIs), update tests and include upgrade notes in the changes file.

```
**Every implementation MUST:**
