# Range compression: address engagement distances and projectile scaling

Labels: enhancement, ai, balance

## Summary

Range compression is when most combat happens in a narrow band of distances. This issue tracks experiments to spread engagements: small range policy changes, projectile speed variance, world scale checks, and spawn offsets.

## Target files

- `src/game/ships.ts` (weapon ranges / projectile speeds)
- `src/game/state.ts` (spawn initial separation)
- `src/game/config.ts` (rangePolicy flag)

## Implementation steps

1. Add `AI_CONFIG.rangePolicy` (string) and implement `v0.1.1-exp` adjustments behind the flag.
2. Apply small per-weapon range variance (+/- 5%) under the range policy to avoid tight clustering.
3. Consider small projectile speed biases to spread effective engagement distances.
4. Run deterministic metric harness to measure range histograms before/after.

## Acceptance criteria

- Range histogram shows increased interquartile range (IQR) by at least 15%.

## Risk & rollback

- Risk: Weapon changes may alter balance noticeably; keep behind `rangePolicy` flag.
