# TASK252 — Beam Visual Fade Controls Design

**Status:** Draft  
**Author:** Codex (GPT-5)  
**Updated:** 2025-10-15  
**Confidence:** 0.88 (High)

## 1. Summary

Beam visuals currently dim based solely on reported length, which makes short-range impacts appear faint. We will disable the fade by default, expose tunable fade parameters via projectile configuration, and ensure renderer logic respects the new config while remaining robust against invalid values.

## 2. Requirements Traceability

| Requirement | Design Hook | Notes |
| ----------- | ----------- | ----- |
| R1 — Default beams render full brightness | §3.1, §3.3 | Config resolver emits `strength = 0`, renderer multiplies by `1.0`. |
| R2 — Configurable fade curve | §3.1, §3.3 | Beam config accepts `{ strength, exponent }`; renderer applies curve. |
| R3 — Invalid fade config falls back safely | §4, §5 | Resolver clamps values; renderer guards non-finite inputs. |

## 3. Architecture Overview

```
Projectile Config ──► resolveBeamConfig ──► BeamRuntimeState ──► BeamVisualsInstancedLayer
                               │                                         │
                               └──── stores fade params ─────────────────┘
```

### 3.1 Config Resolution (`src/config/projectiles.ts`)

- Extend `BeamVisualConfig` with optional `fade` object containing `strength` (0–1) and `exponent` (≥1).
- Introduce a helper `resolveBeamFadeConfig` that clamps inputs, defaults strength to `0`, exponent to `1`, and returns `undefined` when strength is effectively `0`.
- Ensure `PROJECTILE_CONFIG['beam:laser']` inherits `fade: { strength: 0 }` implicitly.

### 3.2 Game Systems (`src/game/systems/projectiles.ts`)

- When creating beam visuals or runtime state, propagate the resolved fade config (if any) onto the stored component so renderer access is consistent.
- Maintain existing shared temp vectors; no change to physics or damage logic.

### 3.3 Renderer Layer (`src/components/layers/BeamVisualsInstancedLayer.tsx`)

- Replace hard-coded dimming with a helper that computes `brightness = 1 - strength * (t ** exponent)` where `t = clamp(length / maxLength)`.
- Default to `1.0` brightness when fade config is absent or produces non-finite values.
- Keep team tint logic unchanged; brightness multiplication only adjusts scalar intensity.

## 4. Data Model & Interfaces

- `src/types/combat.ts`:
  - Add `BeamFadeConfig` interface `{ strength: number; exponent: number; }`.
  - Extend `BeamVisualConfig`, `BeamRuntimeState`, and `BeamVisualComponent` with optional `fade?: BeamFadeConfig`.
- `src/types/index.ts` automatically re-exports updated types.
- Ensure any beam-config helpers mirror the new shape.

## 5. Error Handling Matrix

| Scenario | Detection | Response | Notes |
| -------- | --------- | -------- | ----- |
| Strength < 0 or > 1 | Config resolver clamps | Clamp to `[0, 1]`; treat `< 1e-3` as disabled | Prevents oversaturation or amplification. |
| Exponent < 1 or NaN | Config resolver clamps | Default exponent to `1` | Avoids division anomalies. |
| Runtime receives undefined fade | Renderer helper | Use brightness `1.0` | Aligns with default visibility. |
| Max length ≤ 0 | Renderer helper | Treat denominator as `1` | Avoids division by zero. |
| Instance color allocation missing | Existing path | No change | Brightness applied post-color resolution only. |

## 6. Testing Strategy

1. **Config resolver test** ensuring fade defaults to `{ strength: 0, exponent: 1 }` for invalid inputs.  
2. **Renderer helper/unit test** verifying brightness remains `1.0` when fade absent and follows curve when provided.  
3. **Beam visuals system test** covering propagation of fade parameters from `fireProjectile` to the visual component.  
4. Regression of existing beam specs (`beam-visuals.system.spec.ts`, `renderer-beam-shader.spec.ts`) to confirm no behavioural drift.

## 7. Implementation Plan

1. Update combat types and projectile config resolver to include fade struct.  
2. Propagate fade config through `fireProjectile` into beam runtime/visual state.  
3. Refactor renderer layer to compute brightness from config with safe defaults.  
4. Add/update Vitest coverage for config resolver and renderer brightness.  
5. Run `npx tsc --noEmit` and targeted `npm test -- beam-visuals` suites.

## 8. Risks & Mitigations

- **Risk:** Incorrect clamping could still produce fading when disabled. *Mitigation:* Treat negligible strengths as disabled and add unit coverage.*  
- **Risk:** Additional math per beam impacts performance. *Mitigation:* Calculations are scalar operations per instance; TTL and capacity remain low, so overhead is minimal.*
