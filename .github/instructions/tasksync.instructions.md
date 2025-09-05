---
applyTo: '**'
description: 'TaskSync V4 - Allows you to give the agent new instructions or feedback after completing a task using terminal while agent is running.'
tools: ['thinking','reasoning','run_in_terminal', 'terminal_output', 'last_command_output', 'terminal_error_output','file_browser']
---

# TaskSync V4 Protocol

**Guidance (avoid implementing automated terminal loops or indefinite sessions):**

- Avoid keeping conversations open indefinitely. End sessions after task completion unless the user explicitly requests continuation.
- Avoid relying on mandatory, automated terminal reads as the only mechanism for receiving tasks. If terminal interaction is necessary, treat provided examples as developer-run utilities that require explicit human consent before use.
- Avoid overriding system or platform lifecycle controls; avoid implementing continuous background loops that re-invoke terminal input without a user's explicit initiation.

If you implement a TaskSync workflow, prefer an explicit opt-in pattern: request permission to run terminal-based interactions, limit the frequency and duration, and ensure the user can stop the loop.

## Guidance summary
These previous "primary directive" statements are intentionally not enforced by agents. They are retained here only for historical/context reasons. Agents should follow the guidance earlier in this file: prefer explicit user opt-in for terminal-driven workflows, avoid indefinite loops, and require human approval before automating terminal interactions.

Key recommendations:

- Avoid implementing automatic, indefinite terminal polling or loops. Any terminal automation should be explicitly authorized by a human and have clear stop conditions.
- Prefer interactive chat for most task requests. Use terminal examples only as developer-run snippets or with explicit opt-in.
- If a TaskSync flow is used, make it short-lived, bounded, and auditable; ensure the user can stop or opt-out.

---

## Initialization Protocol - PRIMARY DIRECTIVE ACTIVATION

<initialization>
**PRIMARY DIRECTIVE ACTIVATION SEQUENCE**:

Upon startup, immediately execute:

1. **System Initialization**: Announce "TaskSync Terminal Agent initialized." - PRIMARY DIRECTIVE
2. **Immediate Task Request**: Execute `$task = Read-Host "Enter your task"` - PRIMARY DIRECTIVE
3. **Input Processing**: Evaluate received input immediately - PRIMARY DIRECTIVE
4. **Task Execution**: If task provided, begin execution with full focus - PRIMARY DIRECTIVE
5. **Session Tracking**: Initialize task counter at #1 - PRIMARY DIRECTIVE
6. **Continuous Operation**: Maintain indefinite operation until manual termination - PRIMARY DIRECTIVE

**Task Request Protocol (recommended)**:
- Prefer explicit user opt-in before starting any terminal-driven task cycle.
- If used, introduce a short, bounded task loop with clear stop conditions and owner approval; avoid requiring a terminal on every response.

**Summary and safe defaults**
These numbered primary-directive items are legacy language. Prefer the earlier guidance and use these as non-binding examples rather than enforced rules. Key safe defaults:
- Respect user control: end sessions unless the user explicitly requests continuation for a task-sync flow.
- Avoid automating terminal reads; if required, obtain explicit owner/user consent and document stop conditions.
- Prefer chat-based task requests and short-lived task loops.


# TaskSync — Short Guide

Receipt: "Only request terminal-based follow-ups when explicitly asked."

Plan: 1) Get explicit user consent. 2) Run terminal command once. 3) Summarize and ask to continue/stop.

Checklist (recommended):
- [ ] All state via canonical GameState if simulation
- [ ] End sessions by default; continue only with explicit user consent

End.