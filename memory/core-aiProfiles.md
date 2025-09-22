# Memory — core-aiProfiles

File: `src/game/aiProfiles.ts`

Summary

- Declares `AI_PROFILES`, a small set of behavior profiles (`brawler`, `kiter`, `escort`, `artillery`) implementing `BehaviorProfile`.
- Each profile defines desired engagement band, orbit radius, aggression/patience knobs, dodge frequency, per-hull class bias, stylistic tag, and optional retreat gates (hp thresholds).
- `getDefaultProfileId(hull)` maps `ShipHull` to a default profile (fighters -> escort, corvette/frigate -> brawler, capitals -> artillery).
- `resolveBehaviorProfile(profileId)` returns the profile or falls back to `brawler` if missing; used heavily by the decision system.

Usage

- `spawnShip` calls `getDefaultProfileId` to seed each ship's AI component; other systems can override `profileId` to experiment with roles.
- `updateDecisionSystem` retrieves behavior knobs via `resolveBehaviorProfile` when evaluating intents.

Follow-ups

- Extend the profile table when adding new roles; keep values deterministic-friendly (plain numbers, no functions).
- Consider splitting tuning constants into JSON/yaml once designers need to iterate without touching code.

Created: 2025-09-22
