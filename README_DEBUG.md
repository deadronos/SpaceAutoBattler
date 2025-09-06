Debugging & Runtime Flags

This project includes several runtime flags and URL parameters to help with debugging while keeping normal runs quiet and deterministic. This doc summarizes what’s available and how to use them.

Environment variables

- DEBUG_AI: Enables verbose AI debug logs that are otherwise silenced. Use only when actively inspecting AI behavior.
  - Values: 1 or true to enable; unset/anything else disables.
  - Examples:
    - Unix: DEBUG_AI=1 npm run dev
    - Windows PowerShell: ='1'; npm run dev
    - Windows CMD: set DEBUG_AI=1 && npm run dev

- DEBUG: Enables general, non-AI debug logging in modules that respect the flag.
  - Values: 1 or true to enable.

URL parameters

If you are running the web build/dev server, you can pass URL params to toggle certain diagnostics without rebuilding. Add them to the game URL like http://localhost:5173/?debugPerf=1&debugAIHud=1.

- debugPerf=1: Shows performance overlays/counters (FPS, frame timings), if the build exposes them.
- debugAIHud=1: Shows an in-world HUD of AI state (intents, targets) when available.
- debugPhysics=1: Enables physics visualization/wireframes if integrated.
- debugPaths=1: Renders pathing/steering vectors where supported.
- debugAudio=1: Logs audio events and levels (if implemented).

Notes

- Determinism: Keep seeded RNG for simulations via src/utils/rng.ts. Debug views should not mutate gameplay state.
- Tests: Unit tests should not rely on debug flags. Keep tests deterministic and independent of logging.
- Performance: Heavy AI logs can affect frame time. Prefer debugPerf=1 overlays when diagnosing perf issues.

Extending

To add a new flag:
- For environment flags, add a typed export in src/utils/env.ts and gate logs or features with it.
- For URL flags, parse new URLSearchParams(window.location.search) in the relevant UI/debug module and toggle the feature based on (param === '1' || param === 'true').
