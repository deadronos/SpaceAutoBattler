# components/postprocessing/ - Post-Processing Effects

Builds and configures the post-processing effects pipeline for visual enhancements.

## Files

| File                         | Purpose                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| **createComposer.ts**        | Factory function that creates and configures the post-processing composer with all effects |
| **buildEffects.ts**          | Builds individual post-processing effects and pass configurations                          |
| **buildAmbientOcclusion.ts** | Builds the optional half-res N8AO ambient-occlusion pass (headless-safe; returns `null`)   |

## Effects Pipeline

The post-processing pipeline includes:

- **Ambient Occlusion (N8AO)** - Optional contact/crease shading, inserted between the render pass and the effect pass
- **Bloom** - Glowing light effect for bright areas
- **Chromatic Aberration** - Color channel separation effect
- **Tone Mapping** - Color grading and exposure adjustment
- **FXAA** - Fast approximate anti-aliasing

## Ambient Occlusion (N8AO)

`buildAmbientOcclusion()` wraps `N8AOPostPass` from the `n8ao` package. When
enabled, `createComposer()` inserts the pass **between the render pass and the
effect pass**; when the pass is absent (`null`) the composer keeps its
historical two-pass layout.

Construction is wrapped in `try/catch` and returns `null` on failure. This is
intentional: under headless environments (jsdom/happy-dom, no WebGL context)
`new N8AOPostPass(...)` throws, and callers degrade to "no AO" instead of
breaking the composer. Failures are reported through the shared
`reportWebGLError` channel (always counted, logged only in development), so a
real N8AO failure is not invisible while staying quiet under tests.

`Postprocessing` keeps a reference to the pass and calls `dispose()` on it
during teardown on a best-effort basis. Note the upstream limitation: `n8ao`
does not override `Pass.dispose()`, so `N8AOPostPass.dispose()` currently only
runs the base `Pass` cleanup and does **not** release the pass's internal render
targets/materials. Those are reclaimed when the WebGL context is torn down; the
explicit call is kept so it becomes effective if upstream adds a proper dispose.

### Configuration

All knobs live in `POSTPROCESSING_CONFIG.ao` (`src/config/postprocessing.ts`):

| Knob                | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `enabled`           | Master enable for the AO pass                                            |
| `halfRes`           | Render AO at half resolution (performance; enabled per issue #646)       |
| `quality`           | N8AO quality preset: `Performance` / `Low` / `Medium` / `High` / `Ultra` |
| `aoRadius`          | AO radius in world units (ship scale)                                    |
| `distanceFalloff`   | How fast AO fades with distance relative to the radius                   |
| `intensity`         | Artistic occlusion strength (pow curve)                                  |
| `color`             | Occlusion color (sRGB hex; default `#000000`)                            |
| `transparencyAware` | Transparency-aware mode; optional, defaults to `false` (see below)       |

The shipped values are **provisional** and marked for tuning during visual
review (#646).

### `transparencyAware` defaults to `false`

`buildAmbientOcclusion` honors `config.transparencyAware`, falling back to
`false` when it is omitted (`pass.configuration.transparencyAware =
config.transparencyAware ?? false`). The shipped config keeps it `false`: N8AO's
auto-detection would enable transparency-aware mode for this scene (it contains
many transparent objects), which renders the scene twice more per frame for a
feature the visual review does not require. The knob stays available so the
decision can be revisited if transparent objects later need correct occlusion.

### Debug override

`Postprocessing` reads `window.__copilot_forceAmbientOcclusion` during mount
(mirroring `window.__copilot_forcePostprocessingMount`):

- `true` — force AO on regardless of `POSTPROCESSING_CONFIG.ao.enabled`
- `false` — force AO off regardless of the config
- `undefined` — use `POSTPROCESSING_CONFIG.ao.enabled`

Because the flag is read at mount time, set it with `page.addInitScript` before
navigation (see `test/playwright/ao-visual-baseline.spec.ts`); changing it at
runtime does not rebuild the composer.

## Integration

- Post-processing is set up in Postprocessing.tsx component
- Configured via `src/config/postprocessing.ts`
- Applied to the scene after rendering
- Can be toggled on/off via settings

## Performance

- Passes are applied in optimal order
- AO runs at half resolution (`halfRes`) with a `Medium` quality preset
- Bloom uses selective layer registration
- Effects can be disabled individually for performance

### Measuring the AO cost

The proposed budget for the AO pass is **≤ ~1.5 ms added GPU time at
1280×720, half-res**. If a measurement exceeds it, drop `quality` to
`Performance` (keeping `halfRes`) and re-verify.

- **Automated (spec output):** `test/playwright/ao-visual-baseline.spec.ts`
  samples requestAnimationFrame frame times with AO forced off vs on and logs
  `FPS AO-off≈… AO-on≈… delta=…`. Treat it as a smoke signal, not a precise
  budget gate — headless/software rendering is noisy.
- **Manual (visual sign-off):** enable the `r3f-perf` overlay
  (`perfMonitorEnabled` in the UI store / HUD toggles) and compare AO off vs on.
- **GPU pass time (when available):** call `N8AOPostPass.enableDebugMode()` and
  read `N8AOPostPass.lastTime` (rolling average GPU time in ms). This requires
  `EXT_disjoint_timer_query_webgl2`; the pass self-disables debug mode (and
  logs an error) when the extension is absent, so `lastTime` stays `0` in
  headless/software contexts.
