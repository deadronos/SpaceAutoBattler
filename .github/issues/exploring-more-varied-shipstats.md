# exploring more varied shipstats

## Summary

Add richer ship progression and damage systems to make battles deeper and more dynamic while keeping the runtime lightweight (no persistence for now). The focus is on per-fight mechanics (in-memory only): XP per kill/damage, level-based stat scaling, captain traits on large ships, differentiated damage types, and subsystem damage + repairs.

## Key requirements / ideas

1. Lightweight, ephemeral progression
   - XP is NOT awarded on overall battle completion. Instead, award XP per kill and for dealing damage during engagements. Level data lives in-memory only (no persistence) for now.
   - Level-ups should improve: hull, shield, damage output, repair system efficiency, and shield regen. Avoid unbounded fire rate increases — use caps or diminishing returns to prevent performance issues.

2. Captains for large ships
   - Larger ships (destroyer, carrier, etc.) should have a `captain` entity with traits. Captains scale with the ship's XP/level and provide bonuses such as accuracy, faster repairs, and morale boosts.
   - Morale boost should be a time-limited active ability (cooldown + duration). When used it can temporarily adjust the ship's AI intent weightings (e.g., temporarily increase aggression or repair-priority). This makes battles more dynamic and enables bursty moments.

3. Damage types (ideas)
   - Weapons can have types (examples): `plasma` (strong vs armor), `ion` (strong vs shield), `kinetic` (baseline vs hull/armor), `explosive` (area/armor interaction).
   - These are design ideas that require balancing; mark as "ideas needed" for playtesting and tuning.

4. Subsystems & repair system
   - Model subsystems (engine, weapons, shields) with hitpoints. Critical hits reduce subsystem HP and change status to `damaged` or `offline`.
   - Tie damaged subsystems into a repair system: repairs happen per tick (game loop) and restore subsystem HP and defense hitpoints. Repair rate and prioritization can be modified by captain traits.
   - Destroyed subsystems require longer repair time or an external restore; partially damaged subsystems impose functional penalties (e.g., engine damaged => reduced speed; weapons damaged => reduced firepower).

## EARS-style requirements (testable)

1. WHEN a ship deals damage or kills an enemy, THE SYSTEM SHALL award XP to that ship (or shared among participating ships) and track XP in-memory only.
   - Acceptance: Unit tests simulate damage/kills and show `xp` increments; no disk changes.

2. WHEN a ship reaches XP thresholds, THE SYSTEM SHALL level the ship and apply stat increases (hull/shield/damage/repair/shieldRegen) within safe caps.
   - Acceptance: Level-up test increases the intended stats and enforces a cap or diminishing returns on fire rate.

3. WHEN a large ship has a captain assigned, THE SYSTEM SHALL apply captain trait modifiers (accuracy, repairSpeed, moraleAbility).
   - Acceptance: Combat and repair systems consume captain modifiers; moraleAbility applies a temporary buff (duration + cooldown) that modifies AI intent or stat multipliers.

4. WHEN a weapon with a specific damage type hits a target, THE SYSTEM SHALL calculate effectiveness against shield/armor/hull according to type.
   - Acceptance: Tests cover plasma vs armor, ion vs shield, and baseline cases for kinetic/explosive.

5. WHEN a subsystem is critically damaged, THE SYSTEM SHALL apply functional penalties (e.g., reduced speed, lowered firepower) and allow repairs over ticks.
   - Acceptance: Subsystem status affects movement/attack; repair ticks restore subsystem HP; captain modifiers influence repair speed.

## Design notes and implementation suggestions

- Data model
  - Ship: extend with `xp: number`, `level: number`, `xpToNext: number`, `captain?: Captain`, `subsystems: Record<string, Subsystem>`, `defenses: { shield: number, armor: number, hull: number }`.
  - Weapon: add `damageType: 'plasma'|'ion'|'kinetic'|'explosive'` and `effectiveness` multipliers for each defense.
  - Captain: `{ accuracy: number, repairSpeed: number, moraleAbility?: { cooldown: number, duration: number, effect: string } }`.
  - Subsystem: `{ hp: number, maxHp: number, status: 'online'|'damaged'|'offline', repairRate: number }`.

- Progression and balancing
  - XP sources: per-damage (fractional), per-kill bonus. Use deterministic RNG only for any chance-based effects (seeded RNG in `src/utils/rng.ts`).
  - Level-up: apply predictable stat deltas or offer player choices in future revisions. Avoid increasing fire rate without bounds — prefer additive damage or capped speed modifiers.

- Morale / Intent
  - Morale ability could temporarily adjust AI intent weights for the ship (e.g., increase aggression weight for 10s, cooldown 60s). This requires hooking into the AI/intent system so the ship's decision weights update while buffed.

- Repairs
  - Repairs happen per tick (game loop): subsystems and defenses are healed according to repairRate; captain repairSpeed modifies this.
  - Consider repair queues or prioritization (repair hull before subsystem) as a follow-up.

## Files to inspect

- `src/types/index.ts` (canonical `GameState`, ship types)
- `src/utils/rng.ts` (seeded RNG for determinism)
- `src/systems/` (combat logic, damage resolution, and any progression subsystems)
- `src/entities/` or `src/components/` (ship definitions and subsystems) — if present

## Testing notes

- Add Vitest unit tests for XP gain, leveling, captain modifiers, damage-type resolution, critical-subsystem behavior, and repairs.
- Keep tests deterministic (seed RNG and fixed state inputs).

## Small task checklist

- [ ] Audit `src/` to gather exact type names and current combat/progression flow (start with `src/types/index.ts`).
- [ ] Draft `memory/design.md` with concrete type diffs and EARS requirements.
- [ ] Implement types and unit tests for damage splitting and captain traits.
- [ ] Implement in-memory XP/level system and simple per-kill/damage rewards.
- [ ] Implement subsystem HP and repair ticks.
- [ ] Validate with `npx tsc --noEmit` and `npm test`.

## Labels (suggested)

- enhancement
- design
- needs-investigation
- spec-driven

---

_Notes:_ This is intentionally non-persistent (ephemeral) for now — progression and captain upgrades are kept in-memory to keep the game lightweight. These are design ideas and require iteration and balancing.

## How to open on GitHub (local gh CLI)

If you want to open this as a real GitHub issue from your terminal (requires `gh` and login), run:

```powershell
# from repo root
gh issue create --title "exploring more varied shipstats" --body "$(Get-Content .github/ISSUES/exploring-more-varied-shipstats.md -Raw)"
```

This will create the issue using the draft body in this file.
