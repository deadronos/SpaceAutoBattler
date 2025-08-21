# Changelog

## Unreleased

- Make `initStars` API explicit: `initStars(state, W, H, count)` (previously had an overloaded convenience form). This improves determinism and testability. See `.github/DECISIONS/0001-initStars-api-change.md` for details.
