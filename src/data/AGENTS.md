# Agents Guide: src/data

- Purpose: Canonical data and tuned constants (ship stats, lookup tables) consumed by game systems.
- Constraints: Keep data declarative and side-effect free. Export plain JS/TS objects so they are safe for tests and CI snapshots.
- Types: Reference shared shapes from `src/types` (e.g., `ShipStats`) and validate shapes at module-load where helpful (see `validateMotionStats`).
- Mutability: Treat exported records as read-only configuration at runtime; mutate copies only inside tests or seeding helpers.
- Verification: When changing values, update related unit tests/fixtures and run `npx tsc --noEmit` + `npm test`.
