# Task Plan — Memory Bank Refresh

## Objective

Execute the memory bank refresh defined in `design.md`, ensuring documentation and task indices reflect the celestial environment feature set.

## Task Breakdown

1. **Baseline verification**

    - Confirm links and file structure for `memory/tasks/COMPLETED/`.
    - Capture current content snapshots (for reference only).

1. **Active context rewrite**

    - Update `memory/activeContext.md` to highlight celestial environment workstreams (lighting, rim glow, billboards, tests).
    - Record actionable next steps (perf capture, QA screenshots).

1. **Progress log refresh**

    - Replace top entries of `memory/progress.md` with chronological updates from the environment push (config, textures, materials, tests).
    - Cross-link task IDs where appropriate.

1. **Task index alignment**

    - Rewrite `memory/tasks/_index.md` to group tasks by status and ensure links include the `COMPLETED/` prefix.
    - Adjust any task files (e.g., TASK117–TASK119) whose status text conflicts with actual completion.

1. **Core reference authoring**

    - Create `memory/core-celestialEnvironment.md` capturing config schema, component responsibilities, hook behavior, and related tests.
    - Summarise deterministic rotation safeguards and texture fallback.

1. **Cross-check & validation**

    - Proof-read updated files for stale AI references.
    - Optionally run `npm test` to ensure referenced suites pass (already present in repo).
    - Prepare summary for final handoff (requirements coverage, follow-ups).

## Dependencies

- Steps 2–5 depend on insights from step 1 (baseline verification).
- Step 6 depends on completion of edits in steps 2–5.

## Deliverables

- Updated memory documents (`activeContext`, `progress`, `tasks/_index`, task statuses).
- New `memory/core-celestialEnvironment.md` reference.
- Validation notes captured in final summary.

---

## Task 133 — Build/Test Resilience

**Description:** Restore `npm test` and `npm run build` by migrating smoke imports to TypeScript loaders, consolidating projectile geometry configuration, and hardening Vitest mocks/type guards.

**Expected Outcome:** Unit tests and webpack builds complete without module resolution or TypeScript errors; projectile geometry stays aligned with configuration across bullet types.

**Dependencies:**

- Access to `src/components/Projectile.tsx`, `src/config/projectiles.ts`, and associated Vitest specs.
- Ability to run validation commands locally (`npm run typecheck`, `npm test`, `npm run build`).

---

## Task 139 — Star Disk Haze Taper

**Description:** Implement camera-aware haze taper for the star disk so the rim fades at grazing angles without flattening the core glow.

**Expected Outcome:** Configurable haze controls wired through `CelestialEnvironmentConfig`, updated shader/material uniforms, and validation (unit + visual) confirming edge attenuation.

**Dependencies:** Follow-up to TASK138; relies on existing view-alignment uniform plumbing and shader asset pipeline.
