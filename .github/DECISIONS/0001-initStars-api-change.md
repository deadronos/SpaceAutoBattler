# 0001 — Make initStars API explicit

**Status:** Accepted

**Date:** 2025-08-21

## Summary

Change `initStars` from an overloaded convenience function into an explicit API:

- Old (ambiguous): `initStars(W, H, count)` OR `initStars(state, W, H, count)`
- New (explicit): `initStars(state, W = 800, H = 600, count = 140)`

## Rationale

- Overloaded convenience produced ambiguous call-sites and made deterministic tests fragile due to differences in RNG call ordering and implicit global state access.
- An explicit `state` argument makes ownership clear, improves testability, and avoids accidental differences between runtime and test call ordering.

## Compatibility

- This is a source-level breaking change for any external consumers that called the convenience signature. Build artifacts and standalone HTML were updated during the change to reference the explicit API.

## Migration

- Replace calls of the form `initStars(W, H, count)` with `initStars({ stars }, W, H, count)` where `stars` is the exported `stars` array or the appropriate state's `stars` array.
- The project tests and `reset()` were updated accordingly.

## Notes

- The simulation contract (`simulateStep(state, dt, bounds)`) and event shapes were not changed.
- Developers should prefer passing an explicit `state` object to simulation helpers to maintain determinism and clarity.
