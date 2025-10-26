/**
 * AI Scenario Harness — Deterministic headless AI testing environment
 *
 * This module provides a deterministic test harness for running AI decision scenarios
 * without requiring a full physics engine or graphics runtime. All runs with the same
 * seed and config produce identical decision logs, enabling reproducible golden-fixture
 * regression tests and behavioral validation.
 *
 * @module aiScenarioHarness
 *
 * ## Key Features
 *
 * - **Deterministic**: Uses SeededRng for reproducible AI decisions across runs.
 * - **Lightweight**: Shims Rapier physics and creates minimal GameState for AI testing only.
 * - **Metrics**: Collects per-tick decision data, KPIs, and engagement statistics.
 * - **Test-Only**: This harness is not shipped with production runtime; use `updateGame()` ticks for production.
 *
 * ## Usage Example
 *
 * ```typescript
 * import { runAIScenario, collectTestMetrics } from '../support/aiScenarioHarness';
 * import type { AIScenarioConfig } from '../support/aiScenarioHarness';
 *
 * const config: AIScenarioConfig = {
 *   name: 'escort-vs-brawler',
 *   ticks: 5,
 *   seed: 777,
 *   ships: [
 *     { team: 'blue', hull: 'fighter', position: [0, 0, 0], profileId: 'escort' },
 *     { team: 'red', hull: 'corvette', position: [200, 0, 0], profileId: 'brawler' },
 *   ],
 * };
 *
 * const log = runAIScenario(config);
 * const metrics = collectTestMetrics(log);
 *
 * expect(log.entries[0].commands[0].intent).toBe('Intercept');
 * expect(metrics.timeToFirstShot.p50).toBeLessThanOrEqual(20);
 * ```
 *
 * ## Sub-modules
 *
 * - `aiScenarioHarness/types.ts` — Type definitions for scenario config, logs, and metrics.
 * - `aiScenarioHarness/shipFactory.ts` — Creates harness ship entities with AI state.
 * - `aiScenarioHarness/stateFactory.ts` — Creates lightweight GameState shims for testing.
 * - `aiScenarioHarness/integration.ts` — Integrates physics and transform shims.
 * - `aiScenarioHarness/logging.ts` — Serializes commands, positions, and metrics to JSON.
 * - `aiScenarioHarness/metricsSummary.ts` — Aggregates KPIs from scenario logs.
 *
 * ## Determinism Guarantees
 *
 * All randomness is seeded via SeededRng. To ensure reproducible test runs:
 * 1. Set the same `seed` in AIScenarioConfig (default: 1337).
 * 2. Per-ship trait seeds are derived deterministically from the scenario seed.
 * 3. Module-level temp RNGs (intent-utils, vertical-maneuvers, blackboard) are reset before each run.
 *
 * ## Diagnostics
 *
 * For known diagnostic seeds (777, 2029, 4041), the harness writes per-ship trait and
 * trait-seed info to `tmp/ai-initial-{seed}.log` before the scenario runs. Use this
 * to verify trait generation across runs.
 *
 * @see memory/core-aiScenarioHarness.md — Architectural overview
 * @see memory/guides/TEST_HARNESS_PATTERNS.md — Writing effective AI tests
 * @see memory/guides/AI_DEPRECATION_GUIDE.md — Deprecated features and migration
 */

import type { GameState, ShipEntity } from '../../src/types/index.js';
import { SeededRng } from '../../src/utils/rng.js';
import { AI_CONFIG } from '../../src/game/config.js';
import { runDecisionTick, __aiTestHooks } from '../../src/game/systems.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { aggregateKpis } from '../../src/game/metrics.js';
import type { IntentCandidate } from '../../src/game/systems/decision/intents.js';
import type {
  AIScenarioConfig,
  AIScenarioLog,
  AIScenarioLogEntry,
  HarnessShip,
} from './aiScenarioHarness/types.js';
import { createHarnessShip } from './aiScenarioHarness/shipFactory.js';
import { createHarnessState } from './aiScenarioHarness/stateFactory.js';
import { resetTempRng as resetIntentTempRng } from '../../src/game/systems/decision/intent-utils.js';
import { resetTempRng as resetVerticalTempRng } from '../../src/game/systems/decision/vertical-maneuvers.js';
import { resetTempRng as resetBlackboardTempRng } from '../../src/game/systems/decision/blackboard.js';
import { getEffectiveAIConfig } from '../../src/game/config.js';
import { useUiStore } from '../../src/game/uiStore.js';
import { applyHarnessIntegration } from './aiScenarioHarness/integration.js';
import {
  serializeCommands,
  serializePositions,
  snapshotMetrics,
  maybeWriteScenarioJson,
} from './aiScenarioHarness/logging.js';
import { collectTestMetrics as collectTestMetricsInternal } from './aiScenarioHarness/metricsSummary.js';

export function runAIScenario(config: AIScenarioConfig): AIScenarioLog {
  const tickInterval = config.tickInterval ?? 1 / AI_CONFIG.tickRateHz;
  const seed = config.seed ?? 1337;
  const rng = new SeededRng(seed);

  // Use a fresh temporary RNG seeded with the scenario seed to derive per-ship
  // trait seeds in a stable sequence. This reproduces the same per-ship trait
  // seed sequence a single shared RNG would produce while isolating the
  // sequence from any external RNG consumption.
  const tempRng = new SeededRng(seed);
  const ships = config.ships.map((spec, index) => {
    const traitSeed = spec.traitSeed ?? tempRng.int(1, 1_000_000);
    const specWithSeed = { ...spec, traitSeed } as typeof spec;
    const shipRng = new SeededRng(traitSeed);
    return createHarnessShip(specWithSeed, index, shipRng, tickInterval);
  });

  // Write initial per-ship diagnostics for known diagnostic seeds before the
  // scenario executes so we can compare trait seeds and traits with fixtures.
  try {
    const DIAG_SEEDS_INIT = new Set([777, 2029, 4041]);
    if (DIAG_SEEDS_INIT.has(seed)) {
      const outDir = join('.', 'tmp');
      const path = join(outDir, `ai-initial-${seed}.log`);
      const initLines: string[] = [];
      for (const ship of ships as HarnessShip[]) {
        if (!ship.ai) continue;
        const profileId = ship.ai.profileId;
        const profile = resolveBehaviorProfile(profileId);
        initLines.push(
          `shipdiag: id=${ship.id} profile=${profileId} traitSeed=${ship.ai.traitSeed} traits=${JSON.stringify(ship.ai.traits)} verticalManeuver=${profile.verticalManeuver}`,
        );
      }
      void (async () => {
        try {
          await mkdir(outDir, { recursive: true });
          await writeFile(path, initLines.join('\n') + '\n', { encoding: 'utf8' });
        } catch {
          // ignore
        }
      })();
    }
  } catch {
    // ignore any diagnostics write failures
  }

  const state = createHarnessState({
    ships,
    tickInterval,
    rng,
    aiEnabled: config.aiEnabled ?? true,
  });

  // Ensure any module-level temporary RNGs are reset so harness runs are
  // deterministic and independent of test ordering.
  try {
    resetIntentTempRng(1);
  } catch {
    // ignore: module may not export reset in some builds
  }
  try {
    resetVerticalTempRng(1);
  } catch {
    // ignore: module may not export reset in some builds
  }
  try {
    resetBlackboardTempRng(1);
  } catch {
    // ignore: module may not export reset in some builds
  }

  const entries: AIScenarioLogEntry[] = [];
  for (let i = 0; i < config.ticks; i += 1) {
    runDecisionTick(state, tickInterval);

    const DIAG_SEEDS = new Set([777, 2029, 4041]);
    try {
      if (DIAG_SEEDS.has(seed)) {
        const outDir = join('.', 'tmp');
        const path = join(outDir, `ai-diagnostic-${seed}.log`);
        const lines: string[] = [];
        // Emit per-ship diagnostic info once at the start of the run
        if (i === 0) {
          const shipsListInit = state.queries.ships.entities as HarnessShip[];
          for (const ship of shipsListInit) {
            if (!ship.ai) continue;
            const profileId = ship.ai.profileId;
            const profile = resolveBehaviorProfile(profileId);
            lines.push(
              `shipdiag: id=${ship.id} profile=${profileId} traitSeed=${ship.ai.traitSeed} traits=${JSON.stringify(ship.ai.traits)} verticalManeuver=${profile.verticalManeuver}`,
            );
          }
        }

        const shipsList = state.queries.ships.entities as HarnessShip[];
        for (const ship of shipsList) {
          if (!ship.ai) continue;
          const ai = ship.ai;
          const profileId = ai.profileId;
          const profile = resolveBehaviorProfile(profileId);
          try {
            const nearest = state.blackboard.nearestEnemy.get(ship.id);
            const primaryTarget =
              nearest != null
                ? (shipsList.find((candidate) => candidate.id === nearest) ?? null)
                : null;
            const escortAssignment = state.ai?.assignments?.escorts?.get?.(ship.id) ?? null;
            const escortTarget = escortAssignment
              ? (shipsList.find((candidate) => candidate.id === escortAssignment.vipId) ?? null)
              : null;
            const typedState = state as unknown as GameState;
            const typedShip = ship as unknown as ShipEntity;
            const typedPrimaryTarget = primaryTarget as unknown as ShipEntity | null;
            const typedEscortTarget = escortTarget as unknown as ShipEntity | null;

            const candidates: IntentCandidate[] = [];

            candidates.push({
              intent: 'Attack',
              score: __aiTestHooks.scoreAttackIntent(
                typedState,
                typedShip,
                profile,
                typedPrimaryTarget,
                state.blackboard.teamPosture[ship.ship.team],
                ai.traits,
              ),
              target: typedPrimaryTarget,
            });
            candidates.push({
              intent: 'Kite',
              score: __aiTestHooks.scoreKiteIntent(
                typedShip,
                profile,
                typedPrimaryTarget,
                state.blackboard.teamPosture[ship.ship.team],
                ai.traits,
              ),
              target: typedPrimaryTarget,
            });
            if (typedEscortTarget) {
              candidates.push({
                intent: 'Escort',
                score: __aiTestHooks.scoreEscortIntent(
                  typedShip,
                  profile,
                  typedEscortTarget,
                  typedState,
                  ai.traits,
                  escortAssignment,
                ),
                target: typedEscortTarget,
              });
            }
            if (typedPrimaryTarget) {
              candidates.push({
                intent: 'Intercept',
                score: __aiTestHooks.scoreInterceptIntent(
                  typedState,
                  typedShip,
                  profile,
                  typedPrimaryTarget,
                  typedEscortTarget,
                  state.blackboard.teamPosture[ship.ship.team],
                  ai.traits,
                  escortAssignment,
                ),
                target: typedPrimaryTarget,
              });
              candidates.push({
                intent: 'Reposition',
                score: __aiTestHooks.scoreRepositionIntent(
                  typedState,
                  typedShip,
                  profile,
                  typedPrimaryTarget,
                  ai.traits,
                  state.blackboard.teamPosture[ship.ship.team],
                ),
                target: typedPrimaryTarget,
              });
            } else {
              candidates.push({
                intent: 'Reposition',
                score: __aiTestHooks.scoreRepositionIntent(
                  typedState,
                  typedShip,
                  profile,
                  null,
                  ai.traits,
                  state.blackboard.teamPosture[ship.ship.team],
                ),
                target: null,
              });
            }
            candidates.push({
              intent: 'Regroup',
              score: __aiTestHooks.scoreRegroupIntent(
                typedState,
                typedShip,
                profile,
                state.blackboard.teamPosture[ship.ship.team],
                ai.traits,
              ),
              target: null,
            });
            candidates.push({
              intent: 'Flee',
              score: __aiTestHooks.scoreFleeIntent(
                typedShip,
                profile,
                typedPrimaryTarget,
                state.blackboard.teamPosture[ship.ship.team],
                ai.traits,
              ),
              target: typedPrimaryTarget,
            });

            candidates.sort((a, b) => b.score - a.score);
            const chosen = __aiTestHooks.tieBreak(
              ai,
              state.ai.tickIndex,
              candidates,
              state.ai.metrics,
            );
            lines.push(
              `effectiveConfig: ${JSON.stringify(getEffectiveAIConfig())}`,
              `uiOverrides: ${JSON.stringify(useUiStore.getState())}`,
              `tick=${state.ai.tickIndex} ship=${ship.id} intent=${ai.intent} lastScore=${ai.lastScore} chosen=${chosen?.intent} candidates=${candidates
                .map((candidate) => `${candidate.intent}:${candidate.score}`)
                .join(',')}`,
            );
          } catch {
            // ignore diagnostics errors
          }
        }
        void (async () => {
          try {
            await mkdir(outDir, { recursive: true });
            await writeFile(path, lines.join('\n') + '\n', { encoding: 'utf8' });
          } catch {
            // ignore diagnostics write errors
          }
        })();
      }
    } catch {
      // swallow any diagnostic errors to avoid impacting tests
    }

    entries.push({
      tick: state.ai.tickIndex,
      posture: { ...state.blackboard.teamPosture },
      commands: serializeCommands(state),
      positions: serializePositions(state),
    });

    applyHarnessIntegration(state, tickInterval);
    state.time += tickInterval;
  }

  aggregateKpis(state.ai.metrics, state.ai.tickIndex);
  const log: AIScenarioLog = {
    name: config.name,
    tickInterval,
    seed,
    entries,
    metrics: snapshotMetrics(state.ai.metrics),
  };

  maybeWriteScenarioJson(log, config.name);

  return log;
}

export { collectTestMetricsInternal as collectTestMetrics };

export type {
  AIScenarioConfig,
  AIScenarioShipConfig,
  AIScenarioCommandLog,
  AIScenarioPositionLog,
  AIScenarioLogEntry,
  AIScenarioMetrics,
  AIScenarioLog,
} from './aiScenarioHarness/types.js';

export type { AIScenarioTestMetrics } from './aiScenarioHarness/metricsSummary.js';
