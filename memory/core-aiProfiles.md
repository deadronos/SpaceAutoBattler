# Memory — core-aiProfiles

File: `src/game/aiProfiles.ts`

Summary

- Declares `AI_PROFILES`, a small set of behavior profiles (e.g., `brawler`, `kiter`, `escort`, `artillery`) implementing the `BehaviorProfile` type and tuning knobs designers use for combat roles.

Primary exports & helpers

- `getDefaultProfileId(hull: ShipHull): string` — maps ship hulls to a default behavior profile id used by `spawnShip` during `AIState` construction.
- `resolveBehaviorProfile(profileId: string): BehaviorProfile` — returns the resolved profile object and falls back to a sane default when the id is missing.

Profile contents

- Each profile encodes desired engagement band (min/max), orbit preferences, aggression/patience weights, dodge frequency, per-hull biases, and optional retreat conditions (hp thresholds). Profiles are plain data (numbers/arrays) to remain deterministic and easy to serialize into fixtures.

Usage and patterns

- `spawnShip` calls `getDefaultProfileId` to populate a ship's AI component. The decision system calls `resolveBehaviorProfile` to read behavior knobs when computing intents.
- Designs should keep profiles data-only; avoid embedding functions or closures since the decision system expects serializable numeric parameters for determinism and test fixtures.

Follow-ups

- When adding new roles, extend `AI_PROFILES` and update `getDefaultProfileId` mappings. If designers need iteration without code edits, consider moving profile tables to JSON/YAML and loading them during bootstrap with a stable parsing step.

References

- `src/game/aiProfiles.ts`, `src/game/aiState.ts`, `src/game/systems/decision`
