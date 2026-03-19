# DynamicResScaler (`src/components/DynamicResScaler.tsx`)

**Summary:**

`DynamicResScaler` monitors frame timings (via `useFrame`) and adjusts the renderer pixel ratio (DPR) using an exponential-moving-average (EMA) FPS estimate and a small hysteresis policy. It exports `computeNextDpr()` (pure, unit-tested) and is used as a drop-in component (default-inserted in `Battlefield.tsx`). The goal is to maintain visual quality while keeping the frame time within budget for low-end hardware.

**Key behaviours & API:**

- Path: `src/components/DynamicResScaler.tsx`
- Exports: `computeNextDpr(currentDpr, emaFps, options)` — pure function with clear hysteresis rules.
- Props / options:
  - `minDpr` (default 0.5), `maxDpr` (default 2), `initialDpr` (default 0.5)
  - `targetFps` (default 60), `lowerFps` (default 55)
  - `step` (default 0.25), `smoothing` (EMA alpha), `adjustIntervalMs` (500ms)
- Behaviour: Uses EMA of observed FPS to avoid reacting to single-frame spikes and only changes DPR when FPS moves comfortably above target or below lowerFps.

**Tests & integration:**

- Unit tests: `test/vitest/dynamic-res-scaler.spec.ts` exercises `computeNextDpr()` and expected step/hysteresis behaviour.
- Integration: component is mounted in `src/components/Battlefield.tsx` by default. Uses `gl.setPixelRatio()` and `gl.setSize()` when changing DPR (guarded to avoid errors in test/non-browser envs).

**Notes / Next steps:**

- Current defaults bias towards low initial DPR (0.5) to favour smooth startup on low-end hardware; validate with perf captures on representative hardware (or CI-based GPU proxies) to determine better defaults.
- Action item: expose lightweight telemetry (EMA FPS, current DPR, last-adjust timestamp) to the HUD or `window.__copilot_perf` when `?copilot_debug=1` is present to aid tuning.
- Add an opt-in UI control to enable/disable automatic DPR and to set an explicit DPR cap for testing QA.
- Add Playwright visual baselines that capture representative DPR states to ensure upscaling/downscaling doesn't introduce unacceptable artifacts.

**Related tests / docs:**

- `test/vitest/dynamic-res-scaler.spec.ts`
- `.github/skills/dynamic-res-scaler/SKILL.md` (implementation guidance & reference)

**Added to memory:** 2026-01-09
