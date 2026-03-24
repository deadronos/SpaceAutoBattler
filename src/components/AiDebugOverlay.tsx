import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type { AIKpiSummary, ShipEntity } from '../types/index.js';
import { useOptionalGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import { resolveBehaviorProfile } from '../game/aiProfiles.js';
import { formatPercent, formatSeconds } from '../utils/format.js';

interface SnapshotRow {
  id: number;
  hull: string;
  team: 'blue' | 'red';
  intent: string;
  score: number;
  lod: 0 | 1 | 2;
  bandError: number | null;
  targetId?: number;
}

interface SnapshotData {
  tickIndex: number;
  metrics: {
    decisions: number;
    skipped: number;
    slice: number;
    totalShips: number;
    budgetHits: number;
    kpis: AIKpiSummary;
  };
  postures: Record<'blue' | 'red', string>;
  rows: SnapshotRow[];
}

const REFRESH_INTERVAL_MS = 250;

export function AiDebugOverlay(): React.ReactElement | null {
  const state = useOptionalGameState();
  const aiEnabled = useUiStore((s) => s.aiV2Enabled);
  const debugEnabled = useUiStore((s) => s.aiDebugEnabled);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!debugEnabled) return undefined;
    const id = setInterval(() => setRefreshTick((v) => v + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [debugEnabled]);

  const snapshot = useMemo<SnapshotData | null>(() => {
    void refreshTick;
    if (!debugEnabled || !aiEnabled) return null;
    if (!state?.ai?.enabled) return null;
    const ships = state.queries.ships.entities as ShipEntity[];
    const rows: SnapshotRow[] = [];
    const byId = new Map<number, ShipEntity>();
    for (const ship of ships) byId.set(ship.id, ship);

    for (const ship of ships) {
      if (!ship.ai) continue;
      const profile = resolveBehaviorProfile(ship.ai.profileId);
      const targetId = ship.ai.targetId ?? ship.ai.command.targetId;
      const target = targetId != null ? byId.get(targetId) : undefined;
      let bandError: number | null = null;
      if (target) {
        const dist = ship.transform.position.distanceTo(target.transform.position);
        const mid = (profile.desiredRange[0] + profile.desiredRange[1]) * 0.5;
        bandError = dist - mid;
      }
      rows.push({
        id: ship.id,
        hull: ship.ship.hull,
        team: ship.ship.team,
        intent: ship.ai.intent,
        score: ship.ai.lastScore ?? 0,
        lod: ship.ai.lod,
        bandError,
        targetId: target?.id,
      });
    }

    rows.sort((a, b) => b.score - a.score);

    return {
      tickIndex: state.ai.tickIndex,
      metrics: {
        decisions: state.ai.metrics.lastDecisions,
        skipped: state.ai.metrics.lastSkipped,
        slice: state.ai.metrics.lastSliceSize,
        totalShips: ships.length,
        budgetHits: state.ai.metrics.budgetHits,
        kpis: state.ai.metrics.kpis,
      },
      postures: {
        blue: state.blackboard.teamPosture.blue,
        red: state.blackboard.teamPosture.red,
      },
      rows: rows.slice(0, 8),
    };
  }, [state, aiEnabled, debugEnabled, refreshTick]);

  if (!snapshot) return null;

  const kpis = snapshot.metrics.kpis;

  return (
    <div className="ai-debug-overlay" role="region" aria-live="polite">
      <div className="ai-debug-header">
        <div className="ai-debug-title">AI Debug</div>
        <div className="ai-debug-meta">
          Tick #{snapshot.tickIndex} · Ships {snapshot.metrics.totalShips} · Decisions{' '}
          {snapshot.metrics.decisions}
          {snapshot.metrics.slice ? `/${snapshot.metrics.slice}` : ''} · Skipped{' '}
          {snapshot.metrics.skipped}
        </div>
        <div className="ai-debug-meta">
          Posture — Blue: {snapshot.postures.blue} · Red: {snapshot.postures.red}
        </div>
      </div>
      <div className="ai-debug-kpis">
        <span>
          Opening Aggression: {formatPercent(kpis.openingAggression.ratio)} (
          {kpis.openingAggression.aggressive}/{kpis.openingAggression.total})
        </span>
        <span>
          First Shot (p50/p90): {formatSeconds(kpis.firstShot.p50)} /{' '}
          {formatSeconds(kpis.firstShot.p90)} (n=
          {kpis.firstShot.samples})
        </span>
        <span>
          In-Band: {formatPercent(kpis.inBand.overall.ratio)} ({kpis.inBand.overall.satisfied}/
          {kpis.inBand.overall.samples})
        </span>
        <span>
          Vertical deltaY &gt;= {Math.round(kpis.vertical.threshold)}:{' '}
          {formatPercent(kpis.vertical.ratio)} ({kpis.vertical.aboveThreshold}/
          {kpis.vertical.samples})
        </span>
      </div>
      {snapshot.rows.length ? (
        <table className="ai-debug-table">
          <thead>
            <tr>
              <th scope="col">Ship</th>
              <th scope="col">Team</th>
              <th scope="col">Intent</th>
              <th scope="col">Score</th>
              <th scope="col">Band Δ</th>
              <th scope="col">LOD</th>
              <th scope="col">Target</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.hull} #{row.id}
                </td>
                <td className={`ai-debug-team ai-debug-team--${row.team}`}>{row.team}</td>
                <td>{row.intent}</td>
                <td>{row.score}</td>
                <td>{row.bandError != null ? row.bandError.toFixed(1) : '—'}</td>
                <td>{row.lod}</td>
                <td>{row.targetId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ai-debug-empty">No ships with active AI commands.</p>
      )}
      {snapshot.metrics.budgetHits > 0 ? (
        <p className="ai-debug-warning">Budget hits recorded: {snapshot.metrics.budgetHits}</p>
      ) : null}
    </div>
  );
}
