# Agents Guide: src/components/environment

- Purpose: Celestial environment components (StarDisk, PlanetBody, Skysphere, StarLight) and related materials.
- Determinism: Drive any time-based visuals from the canonical `GameState.time` when visuals must match simulation playback.
- Config: Surface feature flags and tuning via `src/config/environment.ts` and keep shader defaults documented.
- Disposal: Dispose Three.js resources and textures created in hooks (e.g., `usePlanetTexture`) to avoid memory leaks.
- Validation: Add Playwright visual baselines for major material/shader changes.
