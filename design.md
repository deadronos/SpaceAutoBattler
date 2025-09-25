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

---

## 9. Star Disk Shader Control Exposure — 2025-09-26

### 9.1 Overview

Expose the remaining StarDisk shader controls through `CelestialEnvironment` so art direction can tune corona, core, rim, glow, and texture motion without editing shader source. Extend shader, material helpers, and defaults while preserving deterministic fallbacks.

### 9.2 Architecture

- **Config Layer:** `StarDiskShaderConfig` gains new fields (strength, blend, tiling, scroll speeds). `CELESTIAL_ENVIRONMENT` documents defaults.
- **Material Builder:** `buildStarDiskMaterialConfig` clamps inputs, derives colours, and outputs `StarDiskUniformValues` with new entries.
- **Renderer:** `createStarDiskMaterial` injects uniforms, `updateStarDiskUniforms` keeps them in sync, and the fragment shader consumes them for visual control.
- **Component:** `StarDisk.tsx` continues to memoise the material and propagate updated config/uniforms.

### 9.3 Data Flow

```text
CelestialEnvironment.starDisk.shader
        │ (clamped by)
        ▼
buildStarDiskMaterialConfig → StarDiskUniformValues
        │                      │
        ▼                      ▼
createStarDiskMaterial   updateStarDiskUniforms
        │
        ▼
starDisk.fragment.glsl (samplers + scaling)
```

### 9.4 Interfaces & Schemas

| Interface | Additions |
| --- | --- |
| `StarDiskShaderConfig` | `coreStrength`, `rimStrength`, `coronaStrength`, `outerGlowStrength`, `alphaStrength`, `coronaColorBlend`, `organicTiling`, `organicScrollSpeed`, `noiseTiling`, `noiseScrollSpeed`, `noiseDriftSpeed`. |
| `StarDiskUniformValues` | Matching numeric properties (floats) used to drive fragment shader calculations. |
| GLSL Uniforms | `uCoreStrength`, `uRimStrength`, `uCoronaStrength`, `uOuterGlowStrength`, `uAlphaStrength`, `uCoronaColorBlend`, `uOrganicTiling`, `uOrganicScrollSpeed`, `uNoiseTiling`, `uNoiseScrollSpeed`, `uNoiseDriftSpeed`. |

### 9.5 Error Handling Matrix (Incremental)

| Scenario | Detection | Impact | Mitigation |
| --- | --- | --- | --- |
| Config supplies out-of-range intensity or tiling values | Vitest clamp assertions or visual regression | Shader blows out brightness or aliases | Clamp values in `buildStarDiskMaterialConfig` (0–4 for intensities, 0.25–4 for tiling, 0–5 for speeds). |
| Missing textures with new uniforms | Runtime fallback textures | Potential dim output | Preserve baseline defaults and ensure uniform multipliers keep brightness > 0; covered in fallback test. |
| Shader uniform mismatch | WebGL compile errors or undefined uniform warnings | Star disk renders incorrectly or not at all | Keep TS uniform map and GLSL sync; lifecycle test checks uniform presence after updates. |

### 9.6 Testing Strategy

- Extend Vitest clamp and lifecycle tests to assert new uniform values.
- Manual spot-check by tweaking `CELESTIAL_ENVIRONMENT.starDisk.shader` values and verifying in render preview (post-merge).
- Maintain `npm run typecheck` and `npm test` as minimum validation gates.

---

## 10. Star Disk Palette Offsets — 2025-09-26

### 10.1 Overview

Expose the palette skew used when deriving core, rim, and corona colours from the star light. Allow hue/saturation/lightness multipliers to be configured per colour channel while keeping defaults aligned with the fiery baseline.

### 10.2 Architecture

- **Config Layer:** `StarDiskShaderConfig.paletteOffsets` supplies optional hue/saturation/lightness offsets for core, primary, and secondary colours.
- **Material Builder:** `buildColorPalette` clamps offsets, applies them when explicit colour overrides are absent, and falls back to defaults otherwise.
- **Shader:** Continues to consume the resolved colours; no new uniforms required.
- **Defaults:** `CELESTIAL_ENVIRONMENT` documents the prior hard-coded offsets for easy adjustment.

### 10.3 Data Flow

```text
StarLight.color → base Color → buildColorPalette
      │                                  │
      └─ paletteOffsets (config) ────────┘
                │ (clamped offsets)
                ▼
        Derived palette (core, primary, secondary)
```

### 10.4 Interfaces & Schemas

| Interface | Additions |
| --- | --- |
| `StarDiskShaderConfig` | New `paletteOffsets` property referencing `StarDiskPaletteOffsetsConfig`. |
| `StarDiskPaletteColorOffsetConfig` | Encapsulates optional `hue`, `saturation`, and `lightness` adjustments. |
| `StarDiskPaletteOffsetsConfig` | Groups offsets for `core`, `primary`, and `secondary` derived colours. |

### 10.5 Error Handling Matrix (Incremental)

| Scenario | Detection | Impact | Mitigation |
| --- | --- | --- | --- |
| Offsets set beyond safe range | Vitest clamp test failure | Colours wrap or produce NaNs in shader | Clamp offsets between -1 and 1 before application. |
| Offsets applied alongside explicit colour overrides | Visual mismatch vs expectation | Provided overrides ignored | Skip offset application when explicit hex colours are supplied. |
| Missing defaults after refactor | Regression back to desaturated palette | Inconsistent art direction | Keep defaults in `CELESTIAL_ENVIRONMENT` matching previous constants. |

### 10.6 Testing Strategy

- Vitest cases cover clamp behaviour (ensuring HSL stays in range) and custom offset application.
- Manual verification remains optional; runtime behaviour unchanged aside from palette tuning.
- Continue running `npm run typecheck` and `npm test` after edits.

---

## 11. Star Disk Render Capture Workflow — 2025-09-26

### 11.1 Overview

Establish a deterministic Playwright workflow that captures "before" and "after" star disk screenshots for documentation. The test toggles shader overrides at runtime, ensuring the before image represents the pre-radial preset while the after image uses the new defaults.

### 11.2 Architecture

- **Debug Interface:** `window.__STAR_DISK_DEBUG__` exposes `shaderOverrides` consumed by the celestial environment bootstrapping code.
- **Renderer Hook:** `applyStarDiskDebugOverrides` merges overrides into the material config before the `StarDisk` component builds uniforms.
- **Playwright Spec:** `star-disk-compare.spec.ts` orchestrates two captures: one with overrides (before) and one without (after), persisting images under `playwright-debug/` for doc usage.
- **Storage:** Screenshots land in `playwright-debug/star-disk-before.png` and `playwright-debug/star-disk-after.png`, separate from baseline snapshots to avoid CI noise.

### 11.3 Data Flow

```text
Playwright test
        │
        ├─ before step: page.addInitScript sets window.__STAR_DISK_DEBUG__.shaderOverrides
        │        │
        │        ▼
        │   applyStarDiskDebugOverrides → merged config → StarDisk uniforms → screenshot (before)
        │
        └─ after step: clears overrides via page.evaluate → defaults render → screenshot (after)
```

### 11.4 Interfaces & Contracts

| Interface | Contract |
| --- | --- |
| `window.__STAR_DISK_DEBUG__.shaderOverrides` | Partial `StarDiskShaderConfig` applied for the session when defined before material creation. |
| `applyStarDiskDebugOverrides(config, overrides)` | Returns merged config without mutating the original object. |
| Playwright Capture Task | Provides CLI to run `npx playwright test star-disk-compare.spec.ts --update-snapshots` producing two PNG captures. |

### 11.5 Error Handling Matrix

| Scenario | Detection | Impact | Mitigation |
| --- | --- | --- | --- |
| Overrides applied mid-flight after material creation | Screenshots identical; debug override ignored | Before/after comparison fails | Add guard to reapply config only if overrides exist during initial material build; Playwright test ensures overrides set before load. |
| Screenshot directory missing | Playwright save throws ENOENT | Test fails before artifact write | Ensure test creates `playwright-debug/` before writing. |
| Overrides leaking into "after" capture | Images match, reducing value | Document fails to show contrast | Explicitly clear `window.__STAR_DISK_DEBUG__` and reload before after capture. |
| Debug hook pollutes production | Overrides persisting in shipped build | Runtime unpredictability | Gate debug hook usage behind dev/test flag; default pipeline does not set debug object. |

### 11.6 Testing Strategy

- Playwright spec compares pixel histograms to ensure before ≠ after, providing a sanity assertion besides artifact generation.
- Manual validation: open the saved PNGs to confirm visual differences before embedding in docs.
- Maintain `npm run typecheck` and `npm test` to confirm TypeScript and unit suites remain healthy after integrating debug hook.

### 11.7 Camera Alignment

- Star disk visibility on load now comes from flipping the `StarLight.direction` vector to point toward the initial camera target while leaving the distance unchanged. This maintains lighting direction consistency and keeps Playwright captures deterministic without additional camera automation.
