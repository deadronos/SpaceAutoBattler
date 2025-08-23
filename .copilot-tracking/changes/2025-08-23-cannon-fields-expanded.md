### CannonSpec fields expanded to match config (2025-08-23)

Changed `src/config/types.ts`:
- Added `rate`, `spread`, `muzzleSpeed`, `bulletRadius`, `bulletTTL` optional fields to `CannonSpec`.

Rationale: `src/config/entitiesConfig.js` cannon objects include these fields; adding them to the type helps surface mismatches and improves editor intellisense.

Validation:
- `npx tsc --noEmit` passed
- `npm test` passed (48 tests)
