### CannonSpec.damage made required (2025-08-23)

Changed `src/config/types.ts`:
- `damage` in `CannonSpec` is now required (number).
- added optional `angle?: number` to `CannonSpec`.

Rationale: simulation requires `damage` for calculations; making it required surfaces misconfigured cannon objects earlier.

Validation:
- `npx tsc --noEmit` passed
- `npm test` passed (48 tests)
