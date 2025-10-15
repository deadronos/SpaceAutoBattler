# Agents Guide: src/debug

- Purpose: Development and debug UI panels used to inspect runtime behaviour (e.g., ring/star debug panels).
- Safety: Keep debug code gated behind runtime flags or developer-only routes so production bundles stay minimal.
- Side effects: Prefer read-only inspection; avoid wiring debug panels into simulation paths that change authoritative state.
- Testing: Keep small Vitest suites for debug helpers where they perform deterministic logic.
