## Code Structure

Last-Reviewed: 2025-09-15

High-level layout:

- `src/main.ts` - bootstrap and UI
- `src/core/` - pure game logic, AI, entity management
- `src/renderer/` - three.js rendering and instancing
- `src/simWorker.ts` - worker-based physics
- `src/config/` - all configuration parameters
- `test/vitest/` - unit tests

Notes: Follow repository's `spec/src-structure.md` for detailed component relationships.

Notes from this session (2025-09-15):

- Reviewed and annotated as part of memory sweep.
