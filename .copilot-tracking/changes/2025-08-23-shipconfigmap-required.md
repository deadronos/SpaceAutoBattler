### ShipConfigMap tightened to require full ShipSpec (2025-08-23)

Changed `src/config/types.ts`:
- `radius` made required on `ShipSpec` (number)
- `ShipConfigMap` changed from `Record<string, Partial<ShipSpec>>` to `Record<string, ShipSpec>`

Rationale: collision, rendering, and simulation rely on `radius` being present. Requiring full `ShipSpec` surfaces missing fields in configs for gradual correction.

Validation:
- `npx tsc --noEmit` -> no errors
- `npm test` -> 48 tests passed
