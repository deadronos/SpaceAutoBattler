# src/game/context.tsx

Path: src/game/context.tsx
Last-Reviewed: 2025-09-21

Purpose: React context provider for the canonical `GameState`. Exposes `GameState` to renderer components and hooks.

Key exports/symbols:

- GameStateProvider
- useGameState (hook)

Notes:

- Do not store runtime simulation state outside GameState; provider should accept a pre-created `GameState`.
