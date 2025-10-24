# Plan: Enable Full 3D Combat and Address Perceived 2D Limitation

**Receipt**: Address the "2D Combat Limitation" from the game balance report by enhancing AI and spawning to fully utilize 3D space, increasing tactical depth without major rewrites.

**Version**: v0.1.1 (Branch: gamebalancev0.1.1)  
**Date**: September 27, 2025  
**Status**: Planning  
**Confidence Score**: High (85%) – Code already supports 3D; focus on utilization.  
**Dependencies**: None (leverages existing Rapier3D and AI V2).  
**Estimated Effort**: Medium (2-4 hours implementation + testing).

## Phase 1: Analyze (Current State)

- **Key Finding**: No explicit 2D constraint in code (`src/game/systems.ts`, `ships.ts`); full 3D vectors/quaternions used for motion/AI headings. Report's "zeroes heading.y" outdated—likely legacy.
- **Perceived Limitation Causes**:
  - AI intents (Attack/Intercept) prioritize x/z distances; y-variation minimal (~10-20% of total).
  - Spawning (`src/game/state.ts`): Vertical jitter ±480u exists but anchors on x/z plane; far x-sep (~1200u) delays 3D overlap.
  - Profiles lack vertical tactics (e.g., no y-perturbation in dodge/orbit).
  - 10Hz tick + hold posture favors horizontal clustering (Reposition to centroid).
- **Requirements (EARS Format)**:
  1. WHEN AI selects an intent, THE SYSTEM SHALL perturb heading.y by ±10-20% based on profile dodgeFreq [Acceptance: y-component >0 in 60% of commands; test via seeded Vitest mocks].
  2. WHEN spawning fleets, THE SYSTEM SHALL increase vertical spread to ±800u and add y-tilt to headings [Acceptance: Initial y-variance >30% of x/z; measure in resetGame()].
  3. WHEN in artillery/escort modes, THE SYSTEM SHALL favor vertical elevation for "high ground" [Acceptance: Artillery headings have +y bias >5° if >range; log in blackboard metrics].
  4. WHEN validating 3D usage, THE SYSTEM SHALL track vertical dispersion [Acceptance: >50% shots with |y-diff|>100u; add to ai.metrics].

## Phase 2: Design

- **Architecture Overview**:
  - Extend `BehaviorProfile` with `verticalManeuver: number` (0.2-0.4; e.g., escort=0.4 for agile y-dodges).
  - In `writeCommand` (`systems.ts`): Add y-perturbation post-heading calc (e.g., `if (intent !== 'Regroup') { heading.y += (rng.next()-0.5) * profile.verticalManeuver; normalize(); }`).
  - Spawning: Update `verticalSpread = WORLD_HALF * 0.2`; add `headingTilt = (rng.next()-0.5) * Math.PI/6` (apply via Quaternion y-rotation).
  - Toggle: `AI_CONFIG.verticalEnabled: true` (default true; gates perturbations).
  - Metrics: Blackboard `verticalDispersion: {blue:0, red:0}` updated in `refreshBlackboard`; log if <target (e.g., 200u).
- **Data Flow**:
  - AI Tick → Intent Select (3D scores) → Command Write (add y-perturb) → Motion System (3D kinematic) → Physics Step (Rapier3D).
  - Spawn → Position with y-jitter/tilt → Initial AI (3D headings).
- **Interfaces**:
  - `BehaviorProfile.verticalManeuver?: number` (0-1 scale).
  - `AIState.verticalBias?: number` (per-tick y-preference).
- **Error Handling**: Clamp perturbations (|y| <0.3 to avoid flips); fallback to x/z if normalize fails.
- **Diagram** (Mermaid):
  ```
  graph TD
    A[AI Intent Calc] --> B[3D Heading Vector]
    B --> C{verticalEnabled?}
    C -->|Yes| D[Add y-Perturb: ±profile.verticalManeuver]
    C -->|No| E[Keep x/z Dominant]
    D --> F[Normalize & Clamp]
    E --> F
    F --> G[Motion: Thrust in 3D]
    H[Spawn Position] --> I[Add y-Jitter ±800u]
    I --> J[Apply y-Heading Tilt ±15°]
    J --> K[Initial 3D Command]
  ```

## Phase 3: Implementation Plan

- **Tasks** (in `memory/tasks/` after creation):
  1. **Update Profiles** (`aiProfiles.ts`): Add `verticalManeuver` to each (escort:0.4, brawler:0.3, artillery:0.2, kiter:0.5). Default 0.1.
  2. **Enhance Commands** (`systems.ts`): In `writeCommand`, post-heading: `if (profile.verticalManeuver > 0 && command.thrust > 0.5) { const perturb = (state.rng.next()-0.5) * profile.verticalManeuver; heading.y = Math.max(-0.3, Math.min(0.3, heading.y + perturb)); heading.normalize(); }`. Apply selectively (e.g., Intercept/Kite/Attack).
  3. **Tune Spawning** (`state.ts`): `verticalSpread = WORLD_HALF * 0.2`; In spawnShip blueprint: `const tiltQuat = new Quaternion().setFromAxisAngle(new Vector3(1,0,0), (state.rng.next()-0.5)*Math.PI/6); rotation.multiply(tiltQuat);`.
  4. **Add Toggle & Metrics** (`config.ts` & `systems.ts`): `AI_CONFIG.verticalEnabled = true;`. In `refreshBlackboard`: Compute/track max/min y per team; `verticalDispersion[team] = maxY - minY;`.
  5. **VIP/Artillery Bias** (`systems.ts`): For artillery if >range: `if (dist > desiredMax) heading.y += 0.1 * (target.position.y > ship.position.y ? 1 : -1);`.
- **Increment Order**: Profiles → Commands → Spawning → Metrics (test each for stability).
- **Conventions**: Self-explanatory code; comment WHY (e.g., "// Perturb y for 3D tactics, clamped to avoid flips"). Use seeded RNG for determinism.

## Phase 4: Validate

- **Automated**: `npm test` (add Vitest: mock RNG, assert heading.y ≠0 in 60% cases; check y-variance post-spawn). Coverage >90% on changes.
- **Manual**: Run seeded sim (RNG=1337); observe trajectories (console log headings); target: y-dispersion >400u, >30% vertical shots.
- **E2E**: Playwright: Screenshot sequences; assert vertical positions vary (e.g., fighters at y±500u).
- **Metrics**: Time-to-3D-engagement <15s; vertical variance >25% of horizontal. If <target, tune perturb scale.
- **Edge Cases**: Low-HP flee (ensure y-escape viable); carrier launches (fighters inherit 3D tilt).

## Phase 5: Reflect

- **Refactor**: If over-perturbation (erratic paths), reduce to 0.1-0.15 scale.
- **Docs**: Update `gamebalance-report-v0.1.1.md` with "Resolved: Full 3D enabled via AI perturbations".
- **Debt**: If tick rate bottleneck, backlog "Increase to 15Hz" (Priority 4 from report).
- **Meta**: Protocol adherence good; 3D boosts immersion—consider for future (e.g., y-based fog/LOD).

## Phase 6: Handoff

- **Summary**: Goal: Transform perceived 2D limit into 3D strength. Changes: AI y-perturb + spawn tilt. Validation: >50% 3D usage. Files: `aiProfiles.ts`, `systems.ts`, `state.ts`, `config.ts`.
- **PR Prep**: Link this plan; changelog: "Enabled vertical maneuvers in AI for full 3D combat". Artifacts: Seeded logs, y-metric graphs.
- **Next**: Integrate with report's Priority 2; test carrier swarms in 3D.

**Acceptance Checklist**:

- [ ] 4 EARS requirements met/tested.
- [ ] Design diagram linked.
- [ ] Unit tests for y-perturb (deterministic).
- [ ] 3D metrics >targets.
- [ ] No perf regression (allocation-free hot paths).
- [ ] Decision: Vertical scale tuned empirically (no trade-offs needed)."
