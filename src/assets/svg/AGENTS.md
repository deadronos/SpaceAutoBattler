# Agents Guide: src/assets/svg

- Purpose: Vector silhouettes for UI previews and tactical overlays.
- Formatting: Keep SVGs optimised (SVGO or equivalent) and ensure viewBox values align with component expectations.
- Theming: Export shapes without inline colours when possible—apply palette via CSS or React props.
- Updates: When adjusting ship silhouettes, sync any dependent tests or story references.
- Validation: Manually inspect changes in the HUD and run `npm run build` to catch bundler regressions.
