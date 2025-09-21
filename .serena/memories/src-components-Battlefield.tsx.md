# src/components/Battlefield.tsx

Path: src/components/Battlefield.tsx
Last-Reviewed: 2025-09-21

Purpose: R3F canvas scene component managing ship/ projectile instances and camera.

Key exports/symbols:
- Battlefield component (default export)

Notes:
- Reads from `GameState` to render entity transforms.
- Should not mutate `GameState`; treat as read-only for rendering.
