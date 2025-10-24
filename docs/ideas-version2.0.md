# SpaceAutoBattler Version 2.0 Vision

_Updated: 2025-10-13_

## Purpose

Capture a Version 2.0 concept for SpaceAutoBattler that builds on the deterministic, research-grade v0.1.4d foundation. This document outlines the strategic pillars, candidate feature sets, supporting technology investments, and validation checkpoints required to evolve the project into a richer, replayable, and community-friendly experience.

## Baseline Snapshot (v0.1.4d)

- Deterministic simulation loop with seeded RNG, Rapier-driven physics, and AI V2 feature flag delivering profile-driven combat behaviors.
- Solid fleet roster (fighter, corvette, frigate, destroyer, carrier) with documented balance and progression tuning (`docs/gamebalance-report-v01.4d.md`, `src/config/progression.ts`).
- Rendering stack upgraded with cinematic star disk, celestial environment, and ongoing GPU instancing/perf initiatives (TASK240–TASK246).
- Tooling and QA investments: scenario harness, deterministic Vitest suites, Playwright visual baselines, debug overlays, and telemetry capture.
- Gaps: limited long-term progression/meta loop, single-battle focus, narrow mission variety, limited player agency beyond pre-battle composition, and minimal content authoring tools.

## Vision Pillars

1. **Campaign-Driven Warfare** — Transform standalone skirmishes into a persistent warfront with branching missions, strategic map control, and meaningful fleet progression.
2. **Adaptive Fleet Intelligence** — Expand AI and simulation depth so encounters feel reactive, with commanders setting high-level intents, doctrines, and special maneuvers.
3. **Cinematic Scale & Performance** — Deliver large-scale set pieces with improved visuals, environmental storytelling, and guaranteed 60 FPS on target hardware through GPU-first pipelines.
4. **Creator & Community Ecosystem** — Provide editors, scripting hooks, and replay systems so designers, modders, and players can author, share, and analyze battles.
5. **Connected Experiences & Live Ops** — Introduce asynchronous PvP, cooperative ops, seasonal challenges, and telemetry-driven balance updates while preserving determinism.

---

## Pillar 1 — Campaign-Driven Warfare

### Intent

- Elevate the auto-battler into a tactical campaign with persistent stakes, allowing commanders to make strategic decisions between deterministic battles.

### Key Initiatives

- **Galactic War Map:** Layer a hex/sector map over the simulation where regions offer modifiers (resources, hazards, reinforcements). Each turn pushes front lines and unlocks missions.
- **Mission Variety Framework:** Introduce mission archetypes (escort, interception, defense, timed extraction, multi-wave assaults) generated from campaign state variables.
- **Fleet Command Center:** Enable pre-battle planning (squad formations, reserve deployment order, loadout presets) and post-battle repairs using resources earned from missions.
- **Dynamic Events & Narrative Seeds:** Script event cards that adjust mission parameters, offer branching choices, and influence the war map (e.g., distress call, rogue AI, supply shortage).

### Dependencies & Research Focus

- Requires persistence layer for campaign state, resource economy modeling, and UI flows for strategic layer.
- Needs additional ship classes/support craft to make mission variety meaningful (e.g., logistics ship, stealth frigate).
- Investigate save system format compatible with deterministic replays (e.g., snapshot + seed timeline).

### Validation Signals

- Can a full campaign run (≈10 missions) be simulated with deterministic replays matching interactive runs?
- Does the strategic layer surface meaningful choices without overwhelming players (UX study, telemetry of fleet composition diversity)?
- Target UX prototypes tested with designers before full implementation.

---

## Pillar 2 — Adaptive Fleet Intelligence

### Intent

- Evolve AI V2 into a doctrine-driven fleet intelligence that reacts to battlefield telemetry, enables combined-arms tactics, and exposes high-level knobs to players.

### Key Initiatives

- **Doctrine & Stance System:** Define Doctrine cards (e.g., Aggressive Push, Elastic Defense, Ambush) that alter AI utility weights, engagement bands, and squad behaviors mid-mission.
- **Command Abilities:** Allow limited-use abilities (focus fire, emergency warp, shield overcharge) triggered from a commander UI, influencing AI decisions via queued intents.
- **Sensor & Fog-of-War Simulation:** Model sensor ranges, occlusion, and stealth to make recon ships and positioning impactful; integrate into AI target selection heuristics.
- **Behavior Learning Loop:** Record battle telemetry and feed it into tuning scripts that adjust AI traits or suggest doctrine tweaks (offline training, not ML-in-the-loop during runtime).

### Dependencies & Research Focus

- Extends blackboard metrics and AI scheduler; requires deterministic ability resolution and clear debugging hooks.
- Needs UI overlays for doctrine selection, ability cooldowns, and sensor visualization (must integrate with HUD performance budgets).
- Evaluate CPU/GPU headroom for additional AI scoring passes (profiling on 300+ ship scenarios).

### Validation Signals

- Scenario harness expansions covering doctrine swaps, ability triggers, and fog-of-war edge cases.
- Deterministic telemetry diffing across seeds to ensure new systems preserve reproducibility.
- Player usability tests: command latency <200 ms, clarity of effect via HUD instrumentation.

---

## Pillar 3 — Cinematic Scale & Performance

### Intent

- Showcase large fleet engagements with impressive visuals while holding strict performance budgets on mid-tier hardware.

### Key Initiatives

- **Massive Fleet Battles:** Target 500+ active ships through GPU-driven instancing, impostor LODs, and batched weapon effects (building on TASK240–TASK246).
- **Environmental Set Pieces:** Add spatial anomalies (nebulae, asteroid fields, orbital platforms) influencing physics and line-of-sight; support scripted destruction moments.
- **Reactive VFX & Audio:** Expand event pipelines (bullets, explosions, shield hits) with GPU particle systems, spatial audio mix, and performance-aware effect pooling.
- **Photo Mode & Replay Cameras:** Provide cinematic camera paths, depth-of-field controls, and exportable captures for community sharing.

### Dependencies & Research Focus

- Requires continued renderer optimization (GPU buffers, streaming assets, occlusion culling) and audio middleware integration.
- Needs deterministic handling of environmental modifiers so physics and AI remain reproducible across hardware.
- Evaluate memory footprint for high LOD assets and fallback strategies for low-end devices.

### Validation Signals

- Perf budget: Maintain ≥60 FPS on reference GPU (e.g., RTX 2060) with 500 ships and full postprocessing.
- Visual QA: Automated Playwright baselines for new environmental scenes; manual cinematic review gates.
- Stability: Soak tests running 1-hour large battles without memory leaks or perf degradation.

---

## Pillar 4 — Creator & Community Ecosystem

### Intent

- Empower designers and players to craft content, share battles, and extend the simulation through tooling and mod support.

### Key Initiatives

- **Scenario & Campaign Editor:** Web-based editor leveraging existing schema (`src/config`) to author missions, triggers, and campaign maps with validation previews.
- **Deterministic Replay System:** Record battle inputs (seeds, commands) and allow rewinding, annotating, and exporting to shareable packages.
- **Modding API & Package Format:** Define stable JSON/TypeScript contracts for ships, weapons, and environments; ship CLIs for validation and bundling.
- **Community Hub Hooks:** Provide export metadata for uploading to community sites (e.g., share codes, leaderboards) and integrate telemetry for featured content.

### Dependencies & Research Focus

- Requires formalizing config schemas, validation routines, and safe sandboxing for community scripts.
- Needs UX design for timeline scrubber and annotation layers in replay viewer.
- Determine hosting strategy for shared content (in-repo gallery vs. external service) and moderation tooling.

### Validation Signals

- Editor user tests: creators can author a mission and validate it end-to-end within 30 minutes.
- Replay determinism: recorded battles desync <0.1% across 100 replays on different machines.
- Mod verification pipeline integrated into CI to prevent malformed packages.

---

## Pillar 5 — Connected Experiences & Live Ops

### Intent

- Layer asynchronous and cooperative modes plus seasonal goals over the deterministic core without compromising fairness.

### Key Initiatives

- **Asynchronous PvP Leagues:** Players submit fleets and doctrines; matches resolve server-side using deterministic seeds with publishable replays and leaderboards.
- **Cooperative Operations:** Multi-stage operations where two commanders tackle coordinated objectives (e.g., pincer attack) with shared resource pools.
- **Seasonal Objectives & Rewards:** Rotate rule modifiers (environment hazards, ship cost modifiers) and cosmetic rewards tied to telemetry-driven balance tweaks.
- **Telemetry & Balance Service:** Collect anonymized match data to tune ship stats, doctrines, and economic knobs on a predictable cadence.

### Dependencies & Research Focus

- Requires authoritative simulation cluster or deterministic WASM runner for server matches.
- Needs account/progression layer (even if lightweight) and secure submission of fleet configs.
- Investigate anticheat strategies compatible with deterministic replays (hash verification, signature checks).

### Validation Signals

- Backend load testing for daily match volume targets (e.g., 10k auto-resolved battles).
- Fairness audits comparing client-side vs. server-side replays for drift.
- Player retention/engagement metrics during seasonal events.

---

## Supporting Systems & Tooling

- **Data Pipeline & Telemetry:** Expand logging (battle outcome, doctrine usage, performance metrics) fed into analytics dashboards to inform balance decisions.
- **Content Production Workflow:** Establish asset pipeline guidelines (naming, texture budgets), automated linting, and review checklists for new ships/environments.
- **Testing Strategy:** Add regression packs for campaign logic, doctrine switches, and replay determinism; create load suites for 500+ ship scenarios using Vitest/Playwright harnesses.
- **Documentation & Onboarding:** Revise docs to cover new systems, provide quickstart guides for editors/modders, and maintain troubleshooting guides for deterministic sync issues.

## Roadmap Shape (Tentative)

- **Alpha (Foundations):** Ship campaign state prototype, doctrine system core, GPU instancing scalability, replay recorder. Target internal validation.
- **Beta (Content & Tools):** Mission variety rollout, scenario editor beta, environmental set pieces, command abilities, telemetry dashboards.
- **Launch (Live Ops Ready):** Asynchronous leagues, cooperative ops, seasonal framework, polished UI/UX, documentation, and mod packaging pipeline.

## Risks & Open Questions

- **Scope Creep:** Each pillar can expand dramatically; prioritize MVP slices (e.g., two doctrines, one cooperative op template) before broadening.
- **Performance Budget:** Large-scale visuals and new systems may compete for CPU/GPU; enforce profiling gates and fallback plans.
- **UX Complexity:** Strategic and tactical overlays risk overwhelming players; invest in UX prototyping and tutorialization.
- **Backend Investment:** Connected experiences introduce server costs and security needs; evaluate if partnerships or staged rollouts are feasible.
- **Determinism Guarantees:** Additional randomness sources (events, abilities) must flow through seeded RNG to preserve reproducibility.

## Next Steps

1. Socialize pillars with stakeholders and capture feedback on priority ordering.
2. Spin up design spikes for campaign progression, doctrine UI, and replay format; document findings in `memory/designs/`.
3. Create follow-up tasks in the Memory Bank for MVP implementations (campaign prototype, doctrine system, replay recorder).
4. Maintain this document as the living hub for Version 2.0 planning, updating status and decisions as initiatives progress.
