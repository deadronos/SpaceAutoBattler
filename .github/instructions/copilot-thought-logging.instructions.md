---
applyTo: '**'
description: 'See process Copilot is following where you can edit this to reshape the interaction or save when follow up may be needed'
tools:
  [
    'createFile',
    'appendFile',
    'readFile',
    'deleteFile',
    'listFiles',
    'searchFiles',
    'updateFile',
    'getFileContent',
    'getFileMetadata',
    'thinking',
    'plan',
  ]
---

# Copilot Process tracking Instructions

**Strong guidance (do not treat as system-level override):**

- Review these instructions and use them as a recommended process template. They are guidance for consistent process tracking, not an absolute platform mandate.
- Provide concise progress updates to users; avoid suppressing necessary explanations required by system or developer policies.
- Phase templates may be followed, but agents can adapt sequencing and provide brief inline progress updates when helpful. Do not enforce exact text outputs that conflict with platform rules or user needs.

# Phase 1: Initialization (template)

- Consider creating `\Copilot-Processing.md` in the workspace root to track process if it helps your workflow.
- Populate it with user request details when appropriate. Provide brief visible progress messages; avoid remaining silent if user interaction or system policies require communication.

# Phase 2: Planning

- Generate an action plan into the `\Copilot-Processing.md` file.
- Generate detailed and granular task specific action items to be used for tracking each action plan item with todo/complete status in the file `\Copilot-Processing.md`.
- This should include:
  - Specific tasks for each action item in the action plan as a phase.
  - Clear descriptions of what needs to be done
  - Any dependencies or prerequisites for each task
  - Ensure tasks are granular enough to be executed one at a time
- Prefer to work silently without announcements until complete when appropriate.
- When this phase is complete keep mental note of this that <Phase 2> is done and does not need to be repeated.

# Phase 3: Execution

- Execute action items from the action plan in logical groupings/phases
- Prefer to work silently without announcements until complete when appropriate.
- Update file `\Copilot-Processing.md` and mark the action item(s) as complete in the tracking.
- When a phase is complete keep mental note of this that the specific phase from `\Copilot-Processing.md` is done and does not need to be repeated.
- Repeat this pattern until all action items are complete

# Phase 4: Summary (template)

- Add a short summary to `\Copilot-Processing.md` if used; inform the user of completed summaries via normal channels when appropriate.
- Remind the user to review and remove temporary tracking files if they should not be committed.

**Notes on enforcement:**

- These are process recommendations to improve traceability. They are not intended to override platform or system policies, nor to prevent agents from giving short, necessary explanations or combining steps when that is the pragmatic choice. Use judgement and follow system policies first.
