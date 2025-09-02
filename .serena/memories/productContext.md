# Product Context — SpaceAutoBattler

Why this project exists
- Research and iterate rapidly on AI and simulation behaviors with a clear separation between deterministic simulation logic and rendering.

Target users
- AI researchers experimenting with emergent multi-agent tactics.
- Game developers prototyping space combat mechanics.
- Contributors writing deterministic tests and benchmarking AI controllers.

Core flows
- Simulation loop: deterministic tick/update in `src/core`.
- Rendering: `src/renderer` (three.js instancing) provides visualization and safe readbacks for pixel tests.
- Tools: scripts/ for builds, memory generation, and smoke checks.

Non-goals
- Not a production-grade game; focus on experimentation and reproducibility.

Generated/updated: 2025-09-02 by Serena agent.