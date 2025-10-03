import type { GameState, ShipEntity } from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { AI_CONFIG } from './config.js';
import { runDecisionTick, __aiTestHooks } from './systems.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { resolveBehaviorProfile } from './aiProfiles.js';
import { aggregateKpis } from './metrics.js';
import type { IntentCandidate } from './systems/decision/intents.js';
import type {
  AIScenarioConfig,
  AIScenarioLog,
  AIScenarioLogEntry,
  HarnessShip,
} from './aiScenarioHarness/types.js';
import { createHarnessShip, createHarnessState } from './aiScenarioHarness/stateBuilder.js';
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
  const ships = config.ships.map((spec, index) =>
    createHarnessShip(spec, index, rng, tickInterval),
  );

  const state = createHarnessState({
    ships,
    tickInterval,
    rng,
    aiEnabled: config.aiEnabled ?? true,
  });

  const entries: AIScenarioLogEntry[] = [];
  for (let i = 0; i < config.ticks; i += 1) {
    runDecisionTick(state, tickInterval);

    const DIAG_SEEDS = new Set([777, 2029, 4041]);
    try {
      if (DIAG_SEEDS.has(seed)) {
        const outDir = join('.', 'tmp');
        const path = join(outDir, `ai-diagnostic-${seed}.log`);
        const lines: string[] = [];
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
                ? shipsList.find((candidate) => candidate.id === nearest) ?? null
                : null;
            const escortAssignment = state.ai?.assignments?.escorts?.get?.(ship.id) ?? null;
            const escortTarget = escortAssignment
              ? shipsList.find((candidate) => candidate.id === escortAssignment.vipId) ?? null
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



