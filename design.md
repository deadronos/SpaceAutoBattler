# Design — Memory Bank Refresh

## 1. Overview

We will refresh the `memory/` knowledge base so it reflects the celestial environment feature set that now ships on branch `celestialenvironment`. The update rewrites focus areas, progress history, and task tracking to emphasize renderer/environment work, while pruning stale AI V2 rollout notes. We will also add a dedicated reference document for the celestial environment module so future contributors can quickly recover its structure.

## 2. Current State

- `memory/activeContext.md` still lists AI V2 rollout milestones even though the current branch delivers celestial environment work.
- `memory/progress.md` and task records emphasise AI deliverables from 2025-09-22 to 2025-09-25; they do not list the newly added planet texture hook, rim material, lighting, and Playwright baselines.
- `memory/tasks/_index.md` references tasks without matching physical file paths (e.g., entries listed outside the `COMPLETED/` folder) and mixes "In Progress" text with completed notes.
- No `memory/core-*` document summarises the celestial environment components (`CelestialEnvironment`, `StarLight`, `PlanetBody`, `ParallaxBillboard`, hooks, and config schema).

## 3. Target State

- Active context spotlights celestial environment polish (star disk, rim glow, billboards) and performance/test tracking, with actionable next steps.
- Progress log captures chronological entries for planet config, texture loader, rim material, deterministic rotation, and test automation (Vitest + Playwright) dated through 2025-09-25.
- Task index matches the filesystem layout (`COMPLETED/`) and corrects statuses (e.g., TASK117–TASK119 currently marked "In Progress" despite landing in code).
- New `memory/core-celestialEnvironment.md` (name TBD) summarises config, component responsibilities, hooks, and related tests.
- All changes are documented with clear links between config (`src/config/environment.ts`), components, and tests.

## 4. Data Flow & Interactions

```text
Repo Source (src/config/environment.ts,
             src/components/environment/*,
             src/hooks/usePlanetTexture.ts,
             tests)
        │
        ▼
Memory Updates (activeContext, progress, core-celestialEnvironment)
        │
        ├─ Task Index refresh ensures entries align with COMPLETED folder
        │
        └─ Progress log references the new core doc and tasks for traceability
```

- `activeContext` consumes summaries from config/components/tests.
- `progress.md` consumes commit-level milestones derived from tasks and source inspection.
- `memory/tasks/_index.md` and the task files themselves must stay in sync (status text + folder path).
- The new core doc references relevant source files (`src/components/environment/*`, `src/config/environment.ts`, `src/hooks/usePlanetTexture.ts`, `test/vitest/celestial-environment.spec.ts`, `test/playwright/celestial-visual-baseline.spec.ts`).

## 5. Interfaces & Contracts

| Artifact | Contract |
| --- | --- |
| `memory/activeContext.md` | Provide short-term focus, recent changes, and next steps; no stale AI-focused items. |
| `memory/progress.md` | Chronological log entries describing completed celestial tasks, referencing task IDs when applicable. |
| `memory/tasks/_index.md` | Lists tasks grouped by status; completed items link into `COMPLETED/` subfolder; no "??" placeholders. |
| `memory/core-celestialEnvironment.md` (new) | Documents config schema, component responsibilities, hooks, and related tests for the celestial environment. |
| Existing task files | Update status lines to match actual completion (e.g., TASK117–119). |

## 6. Error Handling Matrix

| Scenario | Detection | Impact | Mitigation |
| --- | --- | --- | --- |
| Task index references non-existent path | Manual verification (open link, list directory) | Confusing navigation; stale knowledge | Update `_index.md` links to include `COMPLETED/` prefix and prune phantom entries. |
| Memory documents retain AI V2 focus | Manual review of activeContext/progress | Misleads collaborators about current priorities | Rewrite sections to emphasise celestial environment and remove AI-specific next steps. |
| Missing reference doc for new subsystem | Contributors unable to quickly onboard to environment code | Increased ramp time and inconsistent updates | Author `core-celestialEnvironment.md` summarising config, components, hooks, and tests. |
| Texture loader failures undocumented | Ops lacks fallback guidance | Trouble reproducing render issues | Document texture fallback behavior and tests in core doc and progress log. |
| Tests unsynchronised with docs | Docs reference nonexistent suites | Broken trust in documentation | Cross-check `test/vitest` and `test/playwright` files before referencing them; update task files accordingly. |

## 7. Unit & Validation Strategy

- Documentation-only change: no build artifacts alter runtime. Validation will focus on consistency checks.
- Run `npx tsc --noEmit` and `npm test` after edits if any TypeScript updates occur (not expected, but optional confirmation).
- Manually verify hyperlinks in `memory/tasks/_index.md` and ensure new core doc references correct file paths.
- Spot-check Playwright spec names and Vitest suite references mentioned in documentation.

## 8. Implementation Plan (summary)

See `tasks.md` for an execution checklist covering the edits described above.
