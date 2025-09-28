# Verification of Game Balance Report v0.1.1

The report's analysis of ship stats and AI behaviors is largely accurate based on current code in `src/game/`, with minor discrepancies in calculations and outdated observations. Below is a clarified current state, focusing on ship stats, AI interactions, and report alignments/misalignments.

## Ship Stats Confirmation (`src/game/ships.ts`)

The report's table matches code definitions closely, with DPS derived as `damage / fireRate`. Key extractions:

| Hull     | Max HP | Max Shield | Shield Regen (HP/s) | Primary DPS | Turret DPS | Total DPS (excl. fighters) | Speed (u/s) | Turn Rate (°/s) | Range (u) | Bullet Type |
|----------|--------|------------|---------------------|-------------|------------|----------------------------|-------------|-----------------|-----------|-------------|
| Fighter | 40    | 24        | 4.0                | 8.89       | 0         | 8.89                      | 40         | 270            | 220      | laser      |
| Corvette| 75    | 45        | 5.0                | 10.00      | 12.00     | 22.00                     | 15         | 216            | 220      | plasma     |
| Frigate | 120   | 72        | 7.0                | 10.67      | ~20.00    | ~30.67                    | 12         | 162            | 260      | plasma     |
| Destroyer| 200  | 120       | 8.0                | 12.22      | ~26.78    | ~39.00                    | 10         | 108            | 400      | heavy      |
| Carrier | 320   | 200       | 10.0               | 12.73      | ~25.84    | ~38.57 (+53.34 from 6 fighters = ~91.91) | 7 | 72             | 400      | ion        |

- **Alignments**: HP/shield/speed/turn/range match exactly. Primary DPS calculations correct. Carrier fighter contribution verified (`src/config/carriers.ts`: maxActive=6, cooldown=1.5s; fighters add 6×8.89 DPS).
- **Discrepancies**:
  - Frigate: Report assumes ~16 turret DPS (total 26.67); code has 3 turrets (2×6.67 plasma + 6.67 laser =20), total ~30.67—underreported mid-tier power.
  - Destroyer/Carrier: Minor rounding (report 37.22/90.07 vs code ~39/~91.91).
  - Shield Regen: Absolute HP/s (4-10), approximating 5-12.5% of max HP/s but not exact % as implied (e.g., fighter 10%, carrier 5%).
- **Motion Notes**: All hulls use 3D vectors for position/velocity/heading; high accel/turn for small ships (fighters: accel=34u/s², turn=4.71 rad/s), low for heavies (carriers: accel=6u/s², turn=2.51 rad/s)—enabling agile close maneuvers vs. stable long-range.

## AI Behaviors Confirmation (`src/game/aiProfiles.ts`, `systems.ts`)

Profiles and hull mappings match report exactly:

| Profile   | Assigned Hulls     | Desired Range (u) | Aggression | Patience | Dodge Freq | Style    |
|-----------|--------------------|-------------------|------------|----------|------------|----------|
| Escort   | Fighter           | [70, 180]        | 0.8       | 0.5     | 0.3       | Escort  |
| Brawler  | Corvette, Frigate | [120, 220]       | 0.9       | 0.3     | 0.2       | Brawler |
| Artillery| Destroyer, Carrier| [260, 400]       | 0.6       | 0.7     | 0.1       | Artillery |
| Kiter    | (Unused)          | [240, 360]       | 0.5       | 0.7     | 0.6       | Kiter   |

- **Decision System**: Runs at 10Hz (`src/game/config.ts`: `tickRateHz:10`)—confirms report's "slow reactivity." Evaluates intents (Attack, Kite, Escort, Intercept, Reposition, Regroup, Flee) via scores factoring distance to range band, HP ratio, team posture (aggressive/hold/retreat from strength ratio), traits (seeded variations), and biases (e.g., +25 for artillery vs. carrier).
  - **Attack**: High if in band; thrusts to maintain (full towards if >max, 0.6 away if <min, 0.35 orbit if in); fires if ≤range.
  - **Intercept**: Leads target (quadratic solver on relative pos/vel, clamped 2.5s horizon); full thrust, fire if close—suits fast ships chasing.
  - **Kite**: Away from target at full thrust; high score if out-of-band/low HP—exploits speed gaps.
  - **Escort/Reposition/Regroup**: Cluster to VIP/centroid; defensive fallback if far/low HP/hold posture.
- **Alignments**: Overlap in escort/brawler ranges (70-220) risks mixed-fleet confusion. Patience high for artillery (0.7) delays engagement. Class biases favor role counters (e.g., brawler +20 vs. fighter).
- **Discrepancies**:
  - No 2D constraint: Full 3D vectors/rotations; y-components preserved in headings/positions/velocities. Report's "zeroes heading.y" absent—possibly legacy or scenario-specific (e.g., planar spawning in tests).
  - Defensive Bias: Confirmed via far spawns (`src/game/state.ts`: initial x-sep ~1200u > max range 400u; y-variation ±240u but z-spread ~500u) + hold posture favoring Reposition/Regroup (centroid clustering) over aggressive advance. Spawns use 3D jitter, but anchors on x/z plane may appear 2D initially.

## Interactions: Ship Stats + AI Behavior

- **Strengths Alignment**: Profiles leverage stats—escort/brawler for high-speed/agile small ships (fighters/corvettes: speed 40/15, accel 34/20, turn 270/216°/s) enable quick band entry/exit/dodging (0.3/0.2 freq). Artillery for low-mobility heavies (destroyers/carriers: speed 10/7, accel 10/6, turn 108/72°/s) emphasizes patient range-holding (patience 0.7, low dodge 0.1), using long range (400u) and turret DPS (~26-25).
- **Risks/Imbalances**:
  - **Speed Gaps**: Fighter (40u/s) vs. carrier (7u/s) enables perpetual kiting (Kite score surges out-of-band; intercept lead solver ineffective against 5.7x speed diff). Report's "absolute advantages" valid—slow ships can't close without AI aggression boost.
  - **Carrier Dominance**: 6-fighter swarm (~53 DPS) + self (~38) = ~91 total; AI keeps carrier at 260-400u (safe), launching escorts forward. But cooldown (1.5s) + batch=1 means ~9s full swarm; vulnerable during buildup if intercepted.
  - **Defensive Posture**: Far spawns + 10Hz tick + hold (default posture) prioritize regrouping (score 260+ if >2.5×max range) over attack (needs band proximity). Masks issues like corvette overtuning (22 DPS viable in brawler) or frigate underreport (~30 DPS strengthens multi-role).
  - **Range Compression**: Max 400u / world 8000u =5% (report's 2.25% for spread; accurate concern)—tactical depth limited, but 3D (y±240u spawn) adds vertical play if AI utilizes (no y-bias in code).
  - **Regen Scaling**: Absolute values favor small ships (fighter 4HP/s =10% vs. carrier 10HP/s=3.1%), extending TTK for swarms vs. capitals—softens dominance but unbalances sustain.
- **Overall**: Report reliable for v0.1.1 state; code supports dynamic 3D combat, but spawning/tick/posture promote caution, delaying tests of balances like speed counters or carrier swarms. No major clarifications needed beyond turret counts and 3D support—recommendations (aggro boost, speed compression) remain pertinent.