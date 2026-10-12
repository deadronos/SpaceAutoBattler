# Linear-HDR + tone-mapping pipeline (#645)

**Status:** visual-breaking change; requires human sign-off before merge.
**Rollback:** set `POSTPROCESSING_CONFIG.colorPipeline.enabled = false` (or force
`window.__copilot_forceHdrPipeline = false`).

## What changed

The post-processing composer no longer renders straight into an sRGB target. When
the color pipeline is enabled (the default) it now:

1. Renders the scene into a **linear** (`NoColorSpace`) HalfFloat target so
   emissive materials authored in HDR (values `> 1`) are preserved instead of
   being clipped to white.
2. Applies a **tone-mapping effect** (`agx` by default; `aces`/`neutral` also
   available) as the last effect before FXAA. Exposure is fed through
   `renderer.toneMappingExposure` from `colorPipeline.exposure`.
3. **Rescales bloom** with `colorPipeline.bloomScale` (shipped value `0.1`,
   ≈10× reduction). Because the linear target preserves the HDR emissives that
   the legacy sRGB path flattened, the same per-group bloom intensities glow far
   harder; the scale is the single knob that rebalances them.

The final sRGB encode still happens on the renderer output
(`renderer.outputColorSpace = SRGBColorSpace`); the renderer keeps
`toneMapping = NoToneMapping` — tone mapping is the effect, not the renderer.

## Toggle and legacy fallback

All knobs live in `POSTPROCESSING_CONFIG.colorPipeline`
(`src/config/postprocessing.ts`):

| Knob          | Meaning                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------- |
| `enabled`     | Master toggle. `false` reproduces the legacy sRGB / `NoToneMapping` pipeline **exactly** |
| `toneMapping` | `agx` (default) / `aces` / `neutral`                                                     |
| `exposure`    | Pre-tone-map exposure multiplier                                                         |
| `bloomScale`  | Multiplier applied to every bloom group intensity when enabled                           |
| `vignette`    | Optional asset-free vignette `{ enabled, offset, darkness }`                             |

With `enabled: false` the composer keeps its historical `SRGBColorSpace` target,
adds no tone-mapping/vignette effect, and applies **raw** per-group bloom
intensities (`bloomScale` is ignored). Per-group `bloomGroups[*].intensity` /
`threshold` / `smoothing` are unchanged by this change, so the rebalance is
revertible by toggling the pipeline off. The debug override
`window.__copilot_forceHdrPipeline` (read at mount, like
`__copilot_forceAmbientOcclusion`) can force either path for captures.

No simulation/determinism change; render-only.

## Baselines: regenerate only after sign-off

The target color space, tone mapping, and bloom rescale all change rendered
pixels, so these Playwright baselines are affected and **must be regenerated in a
real-GPU/CI environment after a human signs off** on the before/after capture —
not as part of this change:

- **celestial** — `test/playwright/celestial-visual-baseline.spec.ts-snapshots/*`
- **ao** — the AO on/off pair from `ao-visual-baseline.spec.ts`
- **quality** — `quality-<tier>-<project>.png` (high tier runs bloom)
- **camera-rig** — the pair from `camera-rig-visual.spec.ts`
- **shield / ship-hulls** — confirm with a local run; these render via the
  standalone `test/playwright/pages/ship-renderer.html` page that does not build
  an `EffectComposer`, so they may be unaffected.

The before/after pair for sign-off is produced by
`test/playwright/hdr-tonemapping-visual-baseline.spec.ts`
(`hdr-tonemapping-<state>-<project>.png`). Those screenshots are **not**
committed.

## Verification

- `pnpm run typecheck` — pass
- `pnpm exec vp check` — pass
- `pnpm test` — pass (unit floor unchanged; Playwright specs do not count)
- `pnpm run build` — pass
