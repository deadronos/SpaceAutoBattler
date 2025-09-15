# Project Memory Index

This index lists the short searchable memory summaries generated for the `src/` codebase. These are intended to help new contributors and automated agents quickly find per-file summaries and integration notes.

## How to use

- Each memory is a short, focused Markdown document describing a single source file's responsibility, key functions, integration points, and suggested follow-ups.
- Use these when onboarding, writing tests, or making changes so you can quickly find where behavior is implemented.
- If you change source files, consider updating the corresponding memory entry.
- If you add new important modules, create a new memory file under `memory/` and add a link to this index.

## Per-file memories

- [core-gameState.md](./core-gameState.md) — `src/core/gameState.ts` responsibilities and key functions.
- [core-aiController.md](./core-aiController.md) — `src/core/aiController.ts` (intents, steering, formation, roaming anchors).
- [renderer-effects.md](./renderer-effects.md) — `src/renderer/effects.ts` (EffectsManager, safe readbacks).
- [renderer-threeRenderer.md](./renderer-threeRenderer.md) — `src/renderer/threeRenderer.ts` (Three renderer, instancing, skybox, shield shader).
- [main-simWorker-protocol.md](./main-simWorker-protocol.md) — message protocol between `src/main.ts` and `src/simWorker.ts`.
- [core-assetLoader.md](./core-assetLoader.md) — `src/core/assetLoader.ts` (dynamic GLTF loader, assetPool caching).
- [core-physics.md](./core-physics.md) — `src/core/physics.ts` (Rapier physics stepper API).
- [core-ai-decisionEngine.md](./core-ai-decisionEngine.md) — `src/core/ai/decisionEngine.ts` (scoring helpers).
- [core-ai-intentManager.md](./core-ai-intentManager.md) — `src/core/ai/intentManager.ts` (intent lifetime helper).
- [agent-lockUtils.md](./agent-lockUtils.md) — `src/agent/lockUtils.ts` (file-based lock utilities).
- [core-assetPool.md](./core-assetPool.md) — `src/core/assetPool.ts` (LRU asset pool implementation).

- [projectbrief.md](./projectbrief.md) — Project brief describing goals, constraints, and success criteria.
- [productContext.md](./productContext.md) — Users, stakeholders, and high-level assumptions.
- [systemPatterns.md](./systemPatterns.md) — Architecture patterns and guidance.
- [techContext.md](./techContext.md) — Tooling, stack, and development workflow notes.
- [activeContext.md](./activeContext.md) — Current active work and next steps.
- [progress.md](./progress.md) — High-level progress notes and known issues.

## Maintenance guidelines

- Keep each memory short (200-800 words) and focused on the file's responsibilities.
- Link to relevant config files and note key tunables where appropriate.
- Prefer short examples and references to where the file is used (e.g., `main.ts` or `simWorker.ts`).

Generated on 2025-09-15 by Copilot agent.
