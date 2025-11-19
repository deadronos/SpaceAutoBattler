# SpaceAutoBattler — Creative Expansion Notes

_Last updated: 2025-11-17_

These suggestions focus on expanding the ship roster, improving combat balance, and layering in quality-of-life and meta-system updates. They are intended as pitch-ready options that keep determinism intact while broadening tactical depth.

## New Ship Archetypes

- **Electronic Warfare Frigate**
  - **Role:** Mid-line support that scrambles targeting and suppresses enemy abilities.
  - **Kit Ideas:** Chain-EMP missiles that temporarily widen enemy weapon spread; directional jammers that reduce sensor range in a cone; active decoy drones that redirect the first incoming volley.
  - **Counters & Risks:** Vulnerable to brawlers and missiles that ignore lock-on; requires careful positioning behind brawler screens.
- **Logistics Tender**
  - **Role:** Sustainment and tempo control for attrition battles.
  - **Kit Ideas:** Deployable repair drones with limited charges; ammo-transfer beams that reset ally weapon cooldowns; emergency tug that tows disabled allies out of firing lines.
  - **Counters & Risks:** High-value target with low armor; susceptible to bombers and flanking interceptors.
- **Stealth Corvette**
  - **Role:** Recon and alpha-strike specialist.
  - **Kit Ideas:** Burst cloaking tied to heat budget; passive scan that marks high-threat targets to increase allied focus fire weights; opening salvo bonus damage when decloaking within short range.
  - **Counters & Risks:** Countered by sensor buoys and wide-area flak; minimal staying power after strike window.
- **Mine Layer Destroyer**
  - **Role:** Area denial and objective control.
  - **Kit Ideas:** Seeding lanes with proximity mines that inherit parent ship level; remote detonation for chained explosions; gravity snare mines that slow turn rate and acceleration.
  - **Counters & Risks:** Mines are telegraphed and can be shot; mine inventory is finite, forcing timing decisions.
- **Shield Projector Cruiser**
  - **Role:** Formation anchor and defensive specialist.
  - **Kit Ideas:** Forward-facing projector that converts incoming damage into heat; lattice shields that extend protection to nearby allies at reduced efficiency; emergency bubble with brief invulnerability but heavy self-heat.
  - **Counters & Risks:** Vulnerable to flanking and overheating; projector arc encourages predictable formations opponents can exploit.

## Balance and Progression Tweaks

- **Role-Cohesion Pass:** Strengthen role clarity by slightly widening weapon spread on interceptors and tightening spread on brawlers, reinforcing their intended engagement bands.
- **Damage-to-Heat Curve:** Introduce a soft cap where sustained fire increases heat disproportionately, rewarding burst windows and encouraging weapon cycling or staggered firing.
- **Armor vs. Shields Differentiation:** Add conditional effects—kinetics gain minor penetration on shields but reduced effectiveness on heavy armor; energy weapons overheat faster against armor but deal bonus splash to shields.
- **Economy & Fleet Composition:** Apply diminishing returns for stacking identical hulls in a squad (e.g., escalating deployment cost or reduced doctrine bonuses) to promote combined-arms fleets.
- **Ability Cooldown Normalization:** Standardize ability cooldown bands (short/medium/long) with clear UI cues so players can predict tempo swings and AI can schedule responses deterministically.
- **Progression Hooks:** Unlock ship variants through mission tags (e.g., stealth contracts unlock stealth corvette upgrades), incentivizing varied mission routing in campaigns.

## Additional Systems and QoL Improvements

- **Sensor & Fog-of-War Layer:** Add sensor ranges, occlusion from nebulae/asteroids, and detection tiers so recon ships and stealth mechanics matter; expose debug overlays for designers.
- **Objective-Driven Missions:** Introduce mission archetypes beyond annihilation—convoy escort, timed extraction, control points that boost resources, and multi-wave defenses with repair windows.
- **Commander Abilities:** Limited-use tactical cards (focus fire, emergency warp, shield surge) that modify AI weights for a short window; resolved deterministically via queued intents.
- **Battle Telemetry & Replays:** Expand deterministic replay exports with heat graphs, damage timelines, and doctrine change markers to support post-battle analysis.
- **Content Pipeline:** Formalize JSON/TypeScript schema for new ship archetypes and weapons, plus validation scripts to ensure third-party content stays deterministic.
- **Performance Budgeting:** Pair each new effect (mines, projector shields, drones) with instancing/pooling plans and Playwright visual baselines to keep large battles at target frame rates.

## Playtesting Focus Areas

- **Counterplay Validation:** Each new hull should have at least two clear counters (weapon type + maneuver pattern) observable in the AI harness scenarios.
- **Clarity & Telegraphy:** Ensure VFX/audio clearly communicate EMP, mines, and shielding states; add HUD pips for cloaked units when briefly revealed.
- **Economic Fairness:** Simulate campaigns with varied fleet mixes to check that diminishing returns and progression hooks do not overly punish niche strategies.
- **Deterministic Coverage:** Extend scenario harness tests to include new abilities (heat spikes, cloaks, mines) to verify seed-stable outcomes across platforms.
