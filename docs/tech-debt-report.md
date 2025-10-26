---
post_title: 'Tech Debt Opportunities — October 2025'
author1: 'GitHub Copilot'
post_slug: 'tech-debt-report-oct-2025'
microsoft_alias: 'deadronos'
featured_image: '/assets/images/perf-report/hero.png'
categories:
  - engineering
tags:
  - tech-debt
  - architecture
  - cleanup
ai_note: 'Generated with GPT assistance and reviewed for repository alignment'
summary: 'Highlights five legacy compatibility paths and unused dependencies that add maintenance overhead, with severity ratings and effort estimates.'
post_date: '2025-10-26'
---

<!-- markdownlint-disable-next-line MD041 -->
## Overview

This report documents five high-value tech debt or legacy compatibility paths in the SpaceAutoBattler codebase. Each item includes a severity rating (0–100%), estimated effort, rationale, and suggested next steps. Ratings reflect expected maintenance risk or cost if the debt remains.

## Rating Scale

- **Rating (%):** Estimated impact of leaving the debt in place (higher = more urgent).
- **Effort:**
  - **S (≤0.5d)** — Up to half a day of work.
  - **M (1–2d)** — One to two days, likely requiring coordination or light refactors.
  - **L (≥3d)** — Larger change spanning multiple modules and test updates.

## Candidate Summary

| Item | Rating (%) | Effort | Snapshot |
| --- | ---: | --- | --- |
| Legacy AI fallback (`runLegacyShipBehavior`) | 85 | L (≥3d) | Old steering path remains shipped alongside AI v2 and is still exercised in tests. |
| JSX compatibility shims (`jsx-shim.d.ts`, `jsx-compat.d.ts`) | 70 | M (1–2d) | Temporary React 19 typing workarounds disable intrinsic element safety. |
| Miniplex legacy event adapters (`useArchetypeEntities`) | 60 | M (1–2d) | Hook maintains dual subscription APIs despite standardising on Miniplex v2. |
| Renderer smoothing legacy fallback (`legacyFrameDt`) | 55 | M (1–2d) | Interpolation still maps new time-constant stats into deprecated per-frame lerp values. |
| Unused Pixi dependency (`pixi.js`) | 45 | S (≤0.5d) | Heavy dependency remains in `package.json` but is only mocked in tests. |

## Findings

### Legacy AI fallback (`runLegacyShipBehavior`)

- **What it is:** `src/game/systems/shipControl.ts` still exports and invokes `runLegacyShipBehavior` whenever `state.ai.enabled` is false or an entity lacks an AI component. `GameContext` mirrors the UI toggle straight into `state.ai.enabled`, and `AI_CONFIG.v2Enabled` defaults to `true`, so most deployments run AI v2 yet continue shipping the fallback branch.
- **Evidence:**
  - Fallback selection in `prepareShips` (`shipControl.ts`, lines 37–70) choosing between `executeAICommand` and `runLegacyShipBehavior`.
  - `__aiTestHooks` re-export in `src/game/systems.ts` keeps tests such as `test/vitest/ai-regression.spec.ts` and `ai-metrics.spec.ts` exercising the legacy path explicitly.
- **Impact:** Maintainers must reason about two steering implementations, double the test surface, and guard metrics code for both behaviors. The legacy path bypasses newer intent scoring, diagnostics, and vertical clamps, making hotfixes harder.
- **Remediation outline:**
  - Confirm with design stakeholders that AI v2 is the permanent baseline.
  - Remove the `runLegacyShipBehavior` branch from `prepareShips` and `executeAICommand`, delete the function, and rewrite regression specs to target AI v2 toggles instead of legacy logic.
  - Add a guard in configuration to throw or log when the UI attempts to disable AI v2 after removal.
- **Dependencies & risks:** Requires migrating or deleting several Vitest suites (`ai-regression`, `ai-metrics`) that currently rely on the fallback. Coordinated QA sign-off needed before removal.

### JSX compatibility shims (`jsx-shim.d.ts`, `jsx-compat.d.ts`)

- **What it is:** Two temporary type definition files under `src/types/` relax JSX intrinsic typing after React 19 upgrades. They allow any intrinsic element props (`[elemName: string]: any`) and redefine `JSX.Element` as `React.ReactNode`.
- **Evidence:** Comments explicitly state "TODO: remove this file after fixing React/@react-three type mismatches" in `jsx-shim.d.ts`, and `jsx-compat.d.ts` keeps permissive `IntrinsicElements` definitions.
- **Impact:** Type safety for JSX is effectively disabled, hiding breakages (incorrect prop names, missing `ref` forwarding, etc.) that should be caught at compile time. This undermines confidence in renderer refactors.
- **Remediation outline:**
  - Audit components that rely on the permissive definitions, update them to align with React 19 / @react-three/fiber typings, and remove the shims.
  - Re-run `tsc --noEmit` to ensure no intrinsic errors remain, adding targeted `@types/three` augmentations only where necessary.
- **Dependencies & risks:** Expect short-term friction while aligning components with stricter types, especially across renderer modules. Staged removal (per-folder) may ease adoption.

### Miniplex legacy event adapters (`useArchetypeEntities`)

- **What it is:** The hook `src/hooks/useArchetypeEntities.ts` and supporting types in `src/types/core.ts` keep compatibility with Miniplex v1’s `.add/.remove` event API while the project already depends on `miniplex@^2.0.0`.
- **Evidence:** `useArchetypeEntities` defines `tryRegister` to handle both legacy `add/remove` and modern `subscribe` signatures, and `LegacyArchetypeShape` in `core.ts` expands the archetype type union with deprecated fields.
- **Impact:** Maintaining dual pathways increases complexity, introduces more optional chaining/any casts, and obscures type guarantees for ECS event lifecycles.
- **Remediation outline:**
  - Confirm no runtime consumers still rely on `.add/.remove` (grep shows none beyond compatibility block).
  - Simplify the hook to the modern `subscribe` API, tighten typings to `ReturnType<ECSWorld['with']>`, and drop `LegacyArchetypeShape`.
  - Update affected tests to use the new subscription helpers.
- **Dependencies & risks:** Ensure internal tooling (scenario harness) creates archetypes via `world.with(...)`; otherwise supply minimal adapter functions. Low runtime risk given current dependency version.

### Renderer smoothing legacy fallback (`legacyFrameDt`)

- **What it is:** `src/config/renderer.ts` defines `RENDERER_VISUAL_CONFIG.legacyFrameDt` and maps modern motion `visual` configs back into per-frame lerp coefficients. `src/hooks/useShipInterpolation.ts` likewise converts legacy `smoothing.positionLerp` values via `legacyToAlpha`.
- **Evidence:** The helper `kToFrameLerp` comments "canonical frame time to approximate legacy per-frame mapping"; `useShipInterpolation` computes `frameDt` from `legacyFrameDt` and uses `legacyToAlpha` when `visual` constants are absent.
- **Impact:** Maintaining dual semantics complicates motion tuning and imposes unnecessary allocations (conversions every frame). It also risks divergence if hull configs mix new and legacy fields inadvertently.
- **Remediation outline:**
  - Ensure every hull’s `motion` block uses the `visual` time-constant scheme (already true for current `shipStats`).
  - Remove `legacyFrameDt`, the `smoothing` fallbacks, and associated conversion logic, updating docs to clarify the sole supported pipeline.
  - Consider a migration script or lint rule preventing reintroduction of `smoothing.*` fields.
- **Dependencies & risks:** Coordinate with tooling that may still emit `smoothing` fields (older design docs or config generators). Verify animation regressions through Playwright baselines after removal.

### Unused Pixi dependency (`pixi.js`)

- **What it is:** `package.json` depends on `pixi.js@^8.14.0`, yet repository searches show no runtime usage—only a stub mock in `test/vitest/smoke/import_all.spec.ts` and script configuration.
- **Evidence:** Grep results (`pixi`/`PIXI`) surface only the dependency declaration, the smoke test mock (`vi.mock('pixi.js', () => ({}))`), and script lists. No source files import Pixi.
- **Impact:** Adds ~4 MB of node_modules weight, slows installs, and risks supply-chain updates for an unused library.
- **Remediation outline:**
  - Remove `pixi.js` from `package.json` dependencies and regenerate the lockfile.
  - Delete the test mock entry and associated script references if no longer needed.
- **Dependencies & risks:** Minimal—validate that build/test scripts (e.g., smoke importer generator) do not implicitly rely on Pixi before removal.

## Follow-up

- Confirm whether AI v2 can become the sole path before scheduling the legacy AI removal (coordinate with gameplay owners).
- Track down or recreate the central categories manifest referenced in markdown instructions to avoid future guesswork.
- Consider adding lint rules or scripts to surface dormant dependencies and legacy compatibility code automatically.
