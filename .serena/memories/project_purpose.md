# Project Purpose

SpaceAutoBattler is a lightweight research-oriented 3D space combat simulator. It separates deterministic simulation logic (`src/core`) from rendering (`src/renderer`) so experiments and headless tests can run fast and deterministically.

High-level goals
- Provide a deterministic simulation of ship physics and AI for research and experimentation.
- Keep rendering decoupled from simulation to allow headless tests and CI-friendly runs.
- Provide testable AI helpers and deterministic configuration toggles for reproducible experiments.

Primary entrypoints
- Dev server: `npm run serve` (http-server on port 8080)
- Build: `npm run build` or `npm run build-standalone`

