# core-ai-intentManager.md

Purpose
-------
Short memory for `src/core/ai/intentManager.ts` describing the small helper that standardizes intent lifetimes and applies intents to ships.

Location
--------
src/core/ai/intentManager.ts

Summary
-------
`IntentManager` encapsulates the legacy logic used by `AIController` to compute how long an AI intent should last (min/max duration with RNG-based variance), and to apply that intent to a ship by setting `ship.aiState.currentIntent` and `ship.aiState.intentEndTime`. It supports a `damageEvade` option which clamps the base duration when evading due to damage.

Key Methods
-----------
- `computeDuration(personality, rng, opts?)` — calculates the randomized duration between `personality.minIntentDuration` and `personality.maxIntentDuration`, optionally clamping by `damageEvadeDuration`.
- `applyIntent(ship, now, intent, personality, rng, opts?)` — sets intent on `ship.aiState` and stores `intentEndTime`.

Integration Points
------------------
- Used by `AIController` to keep intent lifetime logic centralized and testable.
- Relies on `AIPersonality` and `RNG` types.

Notes
-----
- Small, deterministic helper to preserve existing AI timing behavior when moving logic around or when making the intent system pluggable.

