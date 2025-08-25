# Balance tuning: small / medium / large ships

This document summarizes the analysis of ship tuning from `src/config/entitiesConfig.ts` and provides numeric DPS/range estimates, balance observations, and tuning suggestions.

## Overview

Key ship types: fighter, corvette, frigate, destroyer, carrier. Per-size defaults live in `SIZE_DEFAULTS`.

Metrics computed per ship:

- Sustained DPS = sum(cannon.damage \* cannon.rate)
- Effective range per cannon = muzzleSpeed \* bulletTTL

## Numeric summary

- Fighter: HP 15 / Shield 8 / Armor 0 / Radius 12 / DPS 9 / Range 286 / Mobility (accel 100, maxSpeed 2200, turnRate 6)
- Corvette: HP 50 / Shield 30 / Armor 0 / Radius 20 / DPS 7.2 / Range 324 / Mobility (accel 80, maxSpeed 1800, turnRate 3.5)
- Frigate: HP 80 / Shield 48 / Armor 1 / Radius 24 / DPS 8 / Range 360 / Mobility (accel 70, maxSpeed 1500, turnRate 2.5)
- Destroyer: HP 120 / Shield 72 / Armor 2 / Radius 40 / DPS 28.8 / Range 288 / Mobility (accel 60, maxSpeed 1300, turnRate 2.0) + turrets
- Carrier: HP 200 / Shield 120 / Armor 3 / Radius 40 / DPS 9.6 / Range 308 / Mobility (accel 55, maxSpeed 1100, turnRate 1.2) + fighters (cooldown 1.5s, spawnPerCooldown 2, maxFighters 6)

## Observations

- Destroyer has highest sustained DPS and high survivability — strong frontal presence.
- Frigate has longest effective per-shot range and favors poking/edge play.
- Fighter is very mobile with high fire rate; effective in numbers and kiting.
- Carrier projects pressure via fighter spawns; hull guns are moderate.

## Tuning suggestions

- Nerf destroyer raw power by reducing per-cannon damage/rate or number of cannons.
- Shorten frigate range via reduced TTL or muzzleSpeed.
- Reduce fighter kiting by lowering muzzleSpeed or TTL or slightly lowering maxSpeed/accel.
- Tweak carrier fighterCooldown or spawnPerCooldown to balance swarm pressure.
- Use `SIZE_DEFAULTS` to adjust broad class changes.

## Verification recommendations

- Run deterministic 1v1 and fleet sims with seeded RNG to measure TTK and win rates.
- Sweep parameters (e.g., destroyer cannon rate, fighter muzzleSpeed/TTL, carrier cooldown) and log TTK, bullets spawned, shield uptime.

## Next steps

- Option A: produce precise CSV with per-cannon DPS, ranges, and EHP estimates.
- Option B: run automated simulation sweeps to quantify TTK and win-rates.

Generated from analysis of `src/config/entitiesConfig.ts` on repository.
