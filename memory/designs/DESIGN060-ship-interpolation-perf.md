# DESIGN060 — Ship Interpolation and Visual Smoothing Performance

Status: Proposed
Date: 2025-11-16
Author: GitHub Copilot (agent)

## Context

Hot path: `useShipInterpolation` (`src/hooks/useShipInterpolation.ts`) and `updateInterpolation` (`src/hooks/interpolation/updateInterpolation.ts`).

- Runs once per frame for each visible ship via `useFrame`.
- Performs:
  - Simulation pose interpolation between previous and current physics tick.
  - Optional visual smoothing (position/rotation) using dt-stable exponential smoothing.
  - Optional bobbing/sway and banking using trigonometric functions and critically-damped springs.
  - Writes interpolated transforms into `rootRef` and `visualRef` groups.

With many ships on screen, this becomes a significant rendering-side CPU hotpath.

## Findings

1. **Per-ship trigonometry and exponentials:** Each frame, ships with bobbing and banking enabled evaluate `Math.sin`, `Math.cos`, and sometimes `Math.exp` (for critically-damped bank) even when far away or visually small.
2. **Always-on interpolation work:** `updateInterpolation` runs for any ship using the hook, regardless of LOD or importance.
3. **Config is rich but not yet perf-tiered:** `RENDERER_VISUAL_CONFIG` and per-hull `motion.visual` configs are powerful, but they do not yet expose an explicit performance tier or LOD integration for turning off more expensive visual effects.

## Requirements (EARS)

- WHEN rendering ships at distant LODs or low importance, THE SYSTEM SHALL be able to disable or reduce visual smoothing and bobbing costs. (Acceptance: low-LOD ships perform less work per frame without changing gameplay.)
- WHEN global performance mode is enabled, THE SYSTEM SHALL turn off optional visual effects (bob, advanced banking) while preserving core interpolation. (Acceptance: a single config flag reduces CPU load with acceptable visual tradeoffs.)
- WHEN interpolation is trivial (e.g., alpha is 0 or 1 and smoothing is disabled), THE SYSTEM SHALL skip unnecessary math. (Acceptance: early-outs avoid trigonometry and exponential calls for trivial cases.)

## Design: LOD-Aware Visual Smoothing

- Integrate ship LOD level into interpolation:
  - `ShipEntity` already participates in LOD decisions via existing LOD systems.
  - Expose a simple `visualDetailLevel` on the entity or derive it from existing LOD state.
- In `updateInterpolation`, use LOD to decide which features are active:
  - High detail (near camera): full smoothing, bobbing, and banking.
  - Medium detail: smoothing only, bobbing optional, banking simplified.
  - Low detail (impostors / far ships): basic interpolation only; no bobbing, banking, or extra smoothing.

## Design: Global Performance Mode

- Extend `RENDERER_VISUAL_CONFIG` with a performance tier or flags:
  - `enableShipVisualSmoothing` (existing).
  - `enableShipBob`, `enableShipBanking` — new global flags that gate bobbing and banking.
  - `performanceTier` enum (e.g., `high`, `medium`, `low`) that sets sensible defaults for the above flags.
- Wire a simple UI toggle or configuration setting to change `performanceTier` at runtime.

## Design: Early-Outs and Cheap Paths

- In `updateInterpolation`:
  - If visual smoothing is disabled (global and per-ship), and `alpha` is 0 or 1, directly copy the appropriate pose to the visual transforms and return early.
  - If `visualCfg.bob?.enabled` is false or LOD is low, skip bobbing entirely.
  - If `visualCfg.bank?.useCriticallyDamped` is false or global performance mode is low, prefer the simpler exponential bank path with cheaper math.

## Data and API Changes

- `ShipEntity` gains or exposes a link to a LOD/importance level usable by interpolation.
- `RENDERER_VISUAL_CONFIG` extended with performance flags/tier.
- No change to `useShipInterpolation` or `updateInterpolation` public signatures.

## Validation Plan

- Add tests for `updateInterpolation` that:
  - Verify early-outs when smoothing is disabled and alpha is extreme values.
  - Confirm that bobbing and banking are skipped for low-LOD or performance-tier settings.
- Run a scenario with many ships and compare CPU profiles before and after changes in both high and low performance modes.

## Risks and Mitigations

- **Risk:** Aggressive disabling of visual effects may degrade perceived visual quality. Mitigation: tie behavior to explicit performance mode or LOD and provide clear UI feedback; keep high-detail mode unchanged.
- **Risk:** LOD integration might create inconsistencies if LOD switches frequently. Mitigation: include small hysteresis or smoothing on LOD changes so that visual features are not toggled on/off every frame.
