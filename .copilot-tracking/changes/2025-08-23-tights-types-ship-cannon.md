### Tighten types: ShipSpec & CannonSpec (2025-08-23)

Changed `src/config/types.ts`:
- Added explicit optional fields to `CannonSpec` (damage, ttl, reload, range)
- Added optional `shieldRegen` and `turnRate` to `ShipSpec`

Rationale: These fields are referenced by simulation and render code and benefit from explicit typing. Kept index signatures to preserve backward compatibility with existing config objects.

Validation:
- Ran `npx tsc --noEmit` (no errors)
- Ran `npm test` (48 tests passed)

Next: iterate on radius/cannon specifics if desired, and gradually convert low-risk runtime JS to TS.
