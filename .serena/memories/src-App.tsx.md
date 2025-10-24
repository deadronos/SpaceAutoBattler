# src/App.tsx

Path: src/App.tsx
Last-Reviewed: 2025-09-21

Purpose: React app shell. Composes the main scene and UI. Mount point for the battlefield, HUD, and controls.

Key exports/symbols:

- App: Main React component that arranges UI and R3F canvas.

Notes:

- Uses canonical `GameState` passed via context from `src/game/context.tsx`.
- Rendering-only concerns; no simulation logic should be placed here.
