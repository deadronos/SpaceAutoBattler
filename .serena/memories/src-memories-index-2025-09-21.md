# src-memories-index-2025-09-21

Generated: 2025-09-21
Purpose: Single-file index (CSV-style) of all `src/` memories written during the 2025-09-21 sweep. Fields: memory_name | source_path | short_description | last_reviewed

| memory_name                       | source_path                       | short_description                                    | last_reviewed |
| --------------------------------- | --------------------------------- | ---------------------------------------------------- | ------------- |
| src-App.tsx                       | src/App.tsx                       | React app shell; composes scene and UI               | 2025-09-21    |
| src-main.tsx                      | src/main.tsx                      | Application bootstrap & loader patches               | 2025-09-21    |
| src-game-state.ts                 | src/game/state.ts                 | Canonical GameState factory & helpers                | 2025-09-21    |
| src-game-systems.ts               | src/game/systems.ts               | Simulation systems (movement, targeting, collisions) | 2025-09-21    |
| src-game-ships.ts                 | src/game/ships.ts                 | Ship stats, spawn helpers, SHIP_STATS                | 2025-09-21    |
| src-utils-rng.ts                  | src/utils/rng.ts                  | Seeded RNG helper (deterministic)                    | 2025-09-21    |
| src-utils-patchGltfLoader.ts      | src/utils/patchGltfLoader.ts      | GLTFLoader compatibility patch                       | 2025-09-21    |
| src-assets-ships.ts               | src/assets/ships.ts               | Mapping of ship classes to GLTF assets               | 2025-09-21    |
| src-assets-svg-files              | src/assets/svg/                   | SVG ship icons (carrier, corvette, etc.)             | 2025-09-21    |
| src-components-Battlefield.tsx    | src/components/Battlefield.tsx    | R3F scene and camera; renders instances              | 2025-09-21    |
| src-components-Controls.tsx       | src/components/Controls.tsx       | UI controls: spawn, pause, toggles                   | 2025-09-21    |
| src-components-Hud.tsx            | src/components/Hud.tsx            | Score, timers, debug toggles                         | 2025-09-21    |
| src-components-Projectile.tsx     | src/components/Projectile.tsx     | Visual projectile component                          | 2025-09-21    |
| src-components-Ship.tsx           | src/components/Ship.tsx           | Visual ship component and effects                    | 2025-09-21    |
| src-components-Turret.tsx         | src/components/Turret.tsx         | Visual turret subcomponent                           | 2025-09-21    |
| src-components-others             | src/components/                   | Summary memory for component files                   | 2025-09-21    |
| src-config-projectiles.ts         | src/config/projectiles.ts         | Projectile config (speed, damage, lifetime)          | 2025-09-21    |
| src-config-renderer.ts            | src/config/renderer.ts            | Visual renderer config (materials, LOD)              | 2025-09-21    |
| src-game-config.ts                | src/game/config.ts                | World size, camera defaults, clamp helpers           | 2025-09-21    |
| src-game-context.tsx              | src/game/context.tsx              | React provider + hooks for GameState                 | 2025-09-21    |
| src-game-README                   | src/game/README.md                | Overview of game simulation modules                  | 2025-09-21    |
| src-game-turretRegistry.ts        | src/game/turretRegistry.ts        | Turret definitions and mounting points               | 2025-09-21    |
| src-game-uiStore.ts               | src/game/uiStore.ts               | Small Zustand UI store for controls                  | 2025-09-21    |
| src-hooks-useArchetypeEntities.ts | src/hooks/useArchetypeEntities.ts | Hook adapting ECS archetypes to React                | 2025-09-21    |
| src-renderer-materialRegistry.tsx | src/renderer/materialRegistry.tsx | Shared Three.js materials & registry                 | 2025-09-21    |
| src-styles-app.css                | src/styles/app.css                | Global UI styles                                     | 2025-09-21    |
| src-types-index.ts                | src/types/index.ts                | Canonical TypeScript types incl GameState            | 2025-09-21    |
| src-types-assets.d.ts             | src/types/assets.d.ts             | GLTF/static asset declarations for TS                | 2025-09-21    |
| src-types-ambient-dts             | src/types/\*.d.ts                 | Ambient type decls for third-party libs              | 2025-09-21    |
| src-types-jsx-compat.d.ts         | src/types/jsx-compat.d.ts         | JSX compatibility shims                              | 2025-09-21    |
| src-types-jsx-shim.d.ts           | src/types/jsx-shim.d.ts           | JSX factory shims                                    | 2025-09-21    |
| src-ui.html                       | src/ui.html                       | Dev UI template used for testing                     | 2025-09-21    |
| src-utils-summary                 | src/utils/                        | Summary of util helpers (rng, patch)                 | 2025-09-21    |
| src-utils-others                  | src/utils/                        | Misc util helpers summary                            | 2025-09-21    |

Notes:

- Each memory entry is a concise summary containing the purpose, key symbols when applicable, and `Last-Reviewed: 2025-09-21`.
- Duplicate/legacy memory nodes (like both `projectileSystem_api` and `projectile_system_api`) were not removed; see `proposed-memory-deletions-2025-09-21` for suggested housekeeping.
