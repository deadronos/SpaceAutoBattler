import type { AIIntent, AIMetrics, ShipHull, GameState, ShipEntity } from '../../types/index.js';
import { MAX_INTENT_TIMELINE_ENTRIES } from './constants.js';
import { addToHistogram } from './factories.js';
import { appendCappedMutable } from '../../utils/cappedBuffer.js';

/**
 * Records an intent decision into the metrics history.
 *
 * @param {AIMetrics} metrics - The metrics object to update.
 * @param {number} tick - The current game tick.
 * @param {number} time - The current game time.
 * @param {AIIntent} intent - The intent chosen by the AI.
 * @param {boolean} isOpeningWindow - Whether the game is in the opening phase.
 */
export function recordIntentMetrics(
  metrics: AIMetrics,
  tick: number,
  time: number,
  intent: AIIntent,
  isOpeningWindow: boolean,
): void {
  if (!metrics.intentTimeline) metrics.intentTimeline = [];
  let snapshot = metrics.intentTimeline.at(-1) ?? null;
  if (!snapshot || snapshot.tick !== tick) {
    snapshot = { tick, time, counts: {}, total: 0 };
    appendCappedMutable(metrics.intentTimeline, snapshot, MAX_INTENT_TIMELINE_ENTRIES);
  }

  snapshot.total += 1;
  snapshot.counts[intent] = (snapshot.counts[intent] ?? 0) + 1;

  metrics.openingTotalIntents += 1;
  if (isOpeningWindow && (intent === 'Attack' || intent === 'Intercept')) {
    metrics.openingAggressiveIntents += 1;
  }
}

/**
 * Records a sample for range-band satisfaction.
 *
 * @param {AIMetrics} metrics - The metrics object.
 * @param {ShipHull} hull - The hull type of the ship.
 * @param {boolean} satisfied - Whether the ship is within its desired range band.
 */
export function recordBandSample(metrics: AIMetrics, hull: ShipHull, satisfied: boolean): void {
  metrics.inBandSamples += 1;
  if (satisfied) metrics.inBandSatisfied += 1;

  const perHull = metrics.inBandByHull[hull];
  perHull.samples += 1;
  if (satisfied) perHull.satisfied += 1;
}

/**
 * Records metrics for a shot fired.
 *
 * @param {AIMetrics} metrics - The metrics object.
 * @param {{ shipId: number; hull: ShipHull; time: number; distance?: number; deltaY?: number }} params - The shot details.
 */
export function recordShotMetrics(
  metrics: AIMetrics,
  params: {
    shipId: number;
    hull: ShipHull;
    time: number;
    distance?: number;
    deltaY?: number;
  },
): void {
  if (!(params.shipId in metrics.firstShotByShip)) {
    metrics.firstShotByShip[params.shipId] = params.time;
    metrics.firstShotTimes.push(params.time);
  }

  if (typeof params.distance === 'number' && !Number.isNaN(params.distance)) {
    addToHistogram(metrics.shotDistanceHist[params.hull], params.distance);
  }

  if (typeof params.deltaY === 'number' && !Number.isNaN(params.deltaY)) {
    const absDeltaY = Math.abs(params.deltaY);
    addToHistogram(metrics.shotDeltaYHist[params.hull], absDeltaY);
    metrics.verticalSamples += 1;
    if (absDeltaY >= metrics.shotVerticalThreshold) {
      metrics.verticalAboveThreshold += 1;
    }
  }
}

/**
 * Helper function to record shot metrics if metrics tracking is enabled.
 * Handles extracting metrics from state and calculating distance/deltaY if needed.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship firing the shot.
 * @param {ShipEntity | null} target - The target ship (optional).
 * @param {number} [distance] - The distance to the target (optional).
 */
export function recordShotHelper(
  state: GameState,
  ship: ShipEntity,
  target: ShipEntity | null,
  distance?: number,
): void {
  const metrics = state.ai?.metrics;
  if (!metrics) return;

  const dist =
    distance ??
    (target ? ship.transform.position.distanceTo(target.transform.position) : undefined);
  const deltaY = target ? target.transform.position.y - ship.transform.position.y : undefined;

  recordShotMetrics(metrics, {
    shipId: ship.id,
    hull: ship.ship.hull,
    time: state.time,
    distance: dist,
    deltaY,
  });
}
