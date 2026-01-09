# TASK162 - Dynamic Res Scaler: tune, document, and expose telemetry

**Status:** In Progress
**Added:** 2026-01-09
**Updated:** 2026-01-09

## Original Request
Tune `DynamicResScaler` defaults, add telemetry/HUD controls, ensure robust behavior in non-browser test envs, and document/instrument for QA/Playwright baselines.

## Acceptance criteria
- [ ] Memory entry created and linked (this file + `memory/dynamic-res-scaler.md`).
- [ ] Unit tests exist for `computeNextDpr()` (passes) and integration tests validate component mounts without throwing in test harness.
- [ ] HUD telemetry: expose EMA FPS and current DPR when `?copilot_debug=1` is enabled; add a small toggle in HUD to disable automatic DPR.
- [ ] Playwright baseline(s) added that capture representative DPR states (low DPR, high DPR) and assert no major visual regressions.
- [ ] PR includes perf capture showing how defaults affect median frame time across a small representative scenario; include recommended default values in docs.

## Implementation plan
1. Add memory note and task (done).
2. Add lightweight telemetry publishing (guarded behind `isCopilotDebugEnabled()`; publish EMA FPS + DPR + lastAdjustMs).
3. Add HUD toggle (read-only current DPR + on/off switch + small per-change log); keep it off by default.
4. Tune defaults by running a small perf script / Playwright run locally and iterate.
5. Add Playwright screenshot baselines and small visual test asserting correct render output across DPR changes.
6. Update docs and memory (update `memory/dynamic-res-scaler.md` with final recommended defaults and testing notes).

## Progress log
- 2026-01-09: Task created after component landed; unit tests present; next step is to add telemetry + HUD toggle and add Playwright baselines.

