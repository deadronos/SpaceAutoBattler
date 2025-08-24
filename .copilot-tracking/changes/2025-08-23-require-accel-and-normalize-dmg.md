## Require accel and normalize dmg -> damage (2025-08-23)

What: Made `ShipSpec.accel` documented as required (px/s^2) and added optional `damage` ship-level alias; normalized `dmg` fields in both TS and JS `entitiesConfig` to include `damage` alongside `dmg` for backward compatibility. Added fallback logic in `behavior` to prefer cannon damage, then ship damage/dmg, then default.

Why: Tighten types and make units explicit; move toward using per-cannon `damage` while keeping old `dmg` keys working.

Validation:
- `npx tsc --noEmit`: passed
- `npm test`: 29 test files, 48 tests, all passed

Notes:
- Kept `dmg` present for compatibility. Future PR can remove `dmg` after updating callers.

