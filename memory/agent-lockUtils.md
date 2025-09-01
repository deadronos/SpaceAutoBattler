# agent-lockUtils.md

Purpose
-------
Short memory for `src/agent/lockUtils.ts` describing simple file-based locking and audit helpers used by local agent tooling.

Location
--------
src/agent/lockUtils.ts

Summary
-------
This module implements a small file-based lock mechanism for cooperative agent tooling in the repository root. It writes a `.ai-lock.json` file (atomic write via temp+rename) to claim ownership, provides `readLock`, `acquireLock`, `releaseLock`, `isLockStale` helpers, and writes audit entries into `.ai-history/` for traceability.

Key Functions
-------------
- `readLock()` — reads `.ai-lock.json` and returns parsed lock object or null.
- `acquireLock(lock)` — attempts atomic create of `.ai-lock.json` (fails if file exists), returns boolean success.
- `releaseLock()` — removes lock file if present.
- `isLockStale(lock)` — checks TTL (seconds) against timestamp to see if lock expired.
- `appendAudit(entry)` — writes an audit JSON file into `.ai-history/` to record operations.

Integration Points
------------------
- Used by local agent scripts and tooling to coordinate single-writer operations (e.g., memory writes, codegen).
- Assumes repo root is `process.cwd()`.

Notes & Safety
--------------
- `acquireLock` uses a naive check (exists) so there's a potential race if two processes check and try to write simultaneously; the temp+rename approach reduces corruption but doesn't guarantee fairness.
- `isLockStale` provides a way to break stale locks based on timestamp + TTL.

Where to look
-------------
- `.ai-lock.json` and `.ai-history/` in repo root are runtime artifacts created by this module.

