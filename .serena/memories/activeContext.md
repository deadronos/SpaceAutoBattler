# Active Context — SpaceAutoBattler

Current focus (as of 2025-09-15)

- Maintain deterministic simulation and add small utilities for testing (e.g., separation helper in AIController).
- Improve memory index and developer-facing docs (llms.txt, memory/).
- Keep build scripts for standalone bundles and smoke tests working across Node versions.

Recent changes

- Added `llms.txt` to help LLMs and contributors.
- New small behavior flags: `behaviorConfig.globalSettings.enableSpawnJitter`.
- Exposed `AIController.calculateSeparationForceWithCount` as a public helper.

Notes from this session (2025-09-15)

- Performed a memory listing and inspection via the Serena memory tools; identified memory nodes for a small update sweep.
- Marked memories `activeContext`, `progress`, and `memory-bank-summary` for quick annotation.

Next steps

- Add `docs/_index.md` or expand `llms.txt` for discoverability.
- Add CI link-check and tests audit.

Generated/updated: 2025-09-15 by Serena agent.
