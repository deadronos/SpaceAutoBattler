# TASK039 - Celestial Environment Config Design

**Status:** Complete  
**Added:** 2025-09-24  
**Updated:** 2025-09-24

## Scope

Design renderer-facing configuration for celestial bodies, ensuring data remains deterministic and decoupled from simulation state.

## Notes

- Define config schema in src/config/environment.ts or similar.
- Capture texture keys, scale, position, and rotation parameters for planet entries.
- Keep state immutable; no GameState mutations.

## Progress

- 2025-09-24: Authored `src/config/environment.ts` with deterministic planet and star light config, including geometry segment defaults.
