# TASK106 - Unify capped history helpers

**Status:** In Progress  
**Added:** 2025-10-29  
**Updated:** 2025-10-29

## Original Request

Identify duplicate code paths that append to capped history buffers and refactor them into a shared helper so diagnostics, metrics, and progression events follow the same FIFO semantics.

## Thought Process

Manual `push`/`shift` loops appear in four hotspots (`simulationQueue`, `damage`, `metrics/recorders`, and the star disk debug hook`). Each implementation subtly differs (while-loop vs single shift, missing guard for `cap <= 0`). A shared utility in `src/utils` can enforce consistent trimming, simplify future audits, and let tests focus on one surface. `progression/events.appendCappedHistory` already expresses the same behavior but rebuilds an array copy manually; delegating to an immutable helper keeps parity without bespoke logic.

## Implementation Plan

1. Implement `appendCappedMutable` and `appendCappedImmutable` helpers inside `src/utils/cappedBuffer.ts` per DESIGN055.  
2. Replace manual capping logic in the four identified call sites and in `appendCappedHistory`.  
3. Add Vitest coverage to assert helper behavior (cap trimming, order preservation, guard rails).  
4. Run `npx tsc --noEmit` and targeted Vitest suites (`test/utils/cappedArray.spec.ts`, existing progression/debug specs) to confirm parity.  
5. Update documentation/memory artifacts with final outcomes.

## Subtasks

| ID      | Description                                                                                 | Status       | Updated    | Notes        |
|---------|---------------------------------------------------------------------------------------------|--------------|------------|--------------|
| 415.1   | Create helper module and ensure TypeScript typings match consumer expectations              | Completed    | 2025-10-29 | DESIGN055    |
| 415.2   | Refactor `simulationQueue`, `damage`, `metrics/recorders`, and star disk hook to use helper | Completed    | 2025-10-29 |              |
| 415.3   | Update `appendCappedHistory` to delegate to immutable helper                                | Completed    | 2025-10-29 |              |
| 415.4   | Author unit tests covering mutating/immutable helpers and guard rails                       | Completed    | 2025-10-29 |              |
| 415.5   | Run typecheck/tests and document results                                                    | Blocked      | 2025-10-29 | Vitest run fails: missing optional @rollup native binary (npm issue #4828) |

## Progress Log

### 2025-10-29

- Logged duplicate capped-buffer logic locations and drafted DESIGN055 describing the shared helper approach, data flow, interfaces, and testing plan.  
- Captured EARS requirements in `memory/requirements.md` to anchor acceptance criteria and resilience expectations.
- Implemented `appendCappedMutable`/`appendCappedImmutable`, replaced manual loops across diagnostics, shield ripples, metrics, and progression events, and added dedicated Vitest coverage.  
- `npx tsc --noEmit` succeeds; `npx vitest run test/utils/cappedBuffer.spec.ts` currently blocked by missing optional `@rollup/rollup-linux-x64-gnu` dependency from npm optional install (documented upstream).
