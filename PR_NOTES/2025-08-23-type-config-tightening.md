# Decision Record: Type & Config Tightening (2025-08-23)

## Summary

Major migration to tighten TypeScript types and config validation for ships and cannons. Ensures simulation and rendering are robust, surfaces misconfigurations early, and improves editor intellisense.

## Changes

- **CannonSpec**: `damage` is now required; new optional fields (`angle`, `rate`, `spread`, `muzzleSpeed`, `bulletRadius`, `bulletTTL`, `ttl`, `reload`, `range`).
- **ShipSpec**: `accel` and `radius` are now required; new optional fields (`shieldRegen`, `turnRate`); `cannons` must be a non-empty array.
- **ShipConfigMap**: Now requires full `ShipSpec` objects, not partials.
- **Compatibility**: Maintains backward compatibility for legacy fields (`dmg`).
- **Validation**: All changes validated with TypeScript and tests.

## Rationale

Simulation, collision, and rendering require these fields for correctness. TypeScript enforcement surfaces errors early and improves maintainability.

## Migration Guidance

- Update all config objects to match stricter types.
- Maintain legacy fields (e.g., `dmg`) until all callers are updated; add fallback logic as needed.
- Remove legacy fields only after full migration.
- Document new required/optional fields in code comments and PR notes.

## Validation

- Run `npx tsc --noEmit` and `npm test` after type/config changes.
- Add/adjust unit tests to cover new requirements and fallback logic.

## References

- See `.copilot-tracking/changes/2025-08-23-*` for granular change logs.
- See `AGENTS.md` for contributor guidelines.
- See `/spec/IMPLEMENTATION_STATUS.md` for current status.
