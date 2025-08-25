Engine Trails Debugging

Summary

- Engine trails are supported and configured in assets; defaults exist. Trails are only recorded and rendered when the simulation state's `engineTrailsEnabled` flag is true. If trails are not visible at runtime, the cause is most likely a runtime or rendering parameter (scale, ship motion, bounds culling) rather than missing asset config.

What I inspected

- Renderer: `src/canvasrenderer.ts` (trail update + draw logic)
- Assets helper: `src/config/assets/assetsConfig.ts` (engineTrail asset and `getEngineTrailConfig`)
- Ship/entity shape: `src/entities.ts` (ship has optional `trail`)
- Main startup/UI toggle: `src/main.ts` (engineTrailsEnabled default and toggle)

Key renderer behavior

- Trails are created and stored per-ship on each render when `state.engineTrailsEnabled` is truthy.
  - A new trail point is appended only when the ship's position changed since the last stored point.
  - Trail length is capped by `trailConfig?.maxLength || 40`.
- Trail visuals are computed from `getEngineTrailConfig(type)` and fall back to defaults in `assetsConfig`.
  - color = `trailConfig?.color || '#aee1ff'`
  - widthPx = `(trailConfig?.width || 0.35) * (s.radius || 12) * renderScale`
  - fade = `trailConfig?.fade || 0.35`
- Each trail point is drawn as a filled circle at the recorded position with an interpolated alpha; points outside the buffer bounds are skipped.

Assets and defaults

- `src/config/assets/assetsConfig.ts` contains an `engineTrail` animation with:
  - type: 'trail'
  - color: '#fffc00'
  - maxLength: 40
  - width: 0.35
  - fade: 0.35
- `getEngineTrailConfig(type)` resolves either a per-type visual override or falls back to the `engineTrail` entry.

Most likely causes for missing trails (ordered)

1. `state.engineTrailsEnabled` is false at runtime (UI toggle or later code disabled it). Default startup sets it true, but toggles or external code could turn it off.
2. Effective visual width is sub-pixel: widthPx = 0.35 _ radius _ renderScale. If ship radius and/or renderScale are small (or zero), drawn arcs may be <1 pixel and effectively invisible.
3. Ships do not move (no new trail points). The renderer only pushes a new point when position differs from last stored point.
4. Trail points exist but are offscreen or culled by the bounds checks before drawing.
5. Global alpha or composite state elsewhere making the drawn circles fully transparent (less likely because the renderer saves/restores contexts around draws).

Quick, actionable debug checklist (run locally)

- Verify engine trails are enabled at runtime:
  - Inspect `gameState.engineTrailsEnabled` in the dev console, or add a temporary `console.log` in `CanvasRenderer.renderState`.
- Inspect computed values during rendering (first 10 frames):
  - `s.trail?.length`
  - `trailConfig` returned from `getEngineTrailConfig(s.type)`
  - `computedWidth` and `renderScale`
  - Example console snippet (browser devtools):
    - console.log('trail', ship.id, ship.trail?.length, getEngineTrailConfig(ship.type), ( (getEngineTrailConfig(ship.type)?.width||0.35) _ (ship.radius||12) _ RendererConfig.renderScale ))
- Ensure ships are moving: inspect `ship.x`/`ship.y` across frames or nudge a ship in the console to force movement.
- Check `RendererConfig.renderScale` value; ensure not zero or extremely small.
- For a quick visual test, force a visible trail for one ship via the console (no code change):
  - `gameState.engineTrailsEnabled = true; ship.radius = 24; // then update ship.x/ship.y each frame or nudge`.

Small defensive code changes to consider

- Ensure trail width is at least 1 pixel when drawn:
  - widthPx = Math.max(1, Math.round((trailConfig?.width || 0.35) _ (s.radius || 12) _ renderScale));
- Use stroke lines between consecutive trail points instead of small filled circles for thin trails to improve visibility.
- Add debug mode to force bright, thick trail rendering for troubleshooting.

Relevant files and lines

- Trail logic & drawing: `src/canvasrenderer.ts` (engine trail code around where `state.engineTrailsEnabled` is checked and drawing occurs)
- Engine trail config: `src/config/assets/assetsConfig.ts` (the `engineTrail` animation and `getEngineTrailConfig`)
- Startup toggle: `src/main.ts` (engineTrailsEnabled default and UI toggle)
- Ship entity (trail storage): `src/entities.ts`

Next steps

- Run the debug checklist locally and report the values (engineTrailsEnabled, renderScale, ship.radius, trail lengths). I can then propose a minimal patch to make trails robust (e.g., min width or line-draw) and prepare it for you.

Notes

- Default assets include a visible bright yellow trail color ('#fffc00'), so missing trails are unlikely to be due to absent asset configuration.
- The renderer has reasonable defaults for color/width/fade, so the usual culprits are runtime state, scale, movement, or culling.

Created by: opencode
Date: 2025-08-25
