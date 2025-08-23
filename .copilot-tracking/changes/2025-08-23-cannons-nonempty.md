### Require cannons as non-empty array (2025-08-23)

Changed `src/config/types.ts`:
- Introduced `NonEmptyArray<T>` helper and set `ShipSpec.cannons: NonEmptyArray<CannonSpec>`.

Rationale: most ship types provide at least one cannon; this helps prevent accidental empty-cannon ship definitions.

Validation:
- `npx tsc --noEmit` passed
- `npm test` passed (48 tests)
