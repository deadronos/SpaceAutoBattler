# Agents Guide: src/components/postprocessing

- Purpose: Postprocessing composer setup and effect wiring (bloom, tone mapping, selective passes).
- Safety: Keep heavy effects behind toggles and ensure composer updates are guarded for headless tests.
- Integration: Expose effects through small configuration objects so tests can enable/disable features deterministically.
- Performance: Reuse composer/targets across frames; avoid reallocating render targets on window resizes without need.
