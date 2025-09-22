import { useEffect, useMemo, useState } from 'react';
import type { ShipEntity } from '../types/index.js';
import { useOptionalGameState } from '../game/context.js';
import { useArchetypeEntities } from '../hooks/useArchetypeEntities.js';
import type React from 'react';
import { AiDebugOverlay } from './AiDebugOverlay.js';

interface TeamSummary {
  team: 'blue' | 'red';
  ships: number;
  hp: number;
  maxHp: number;
}

export function Hud(): React.ReactElement {
  const state = useOptionalGameState();
  // Call the hook unconditionally; it accepts a nullable archetype and will
  // return an empty array when `state` is null. This avoids conditional hook
  // usage which can trigger React hook invariant errors.
  const ships = useArchetypeEntities<ShipEntity>(state ? state.queries.ships : null);

  const [blue, red] = useMemo(() => summarize(ships), [ships]);

  return (
    <div className="hud">
      <AiDebugOverlay />
      <div className="hud-panel">
        <h2>Space Auto Battler</h2>
        <p className="subtitle">React Three Fiber · Miniplex · Rapier</p>
        <div className="team-grid">
          <TeamCard summary={blue} />
          <TeamCard summary={red} />
        </div>
        <p className="hint">Ships automatically maneuver, acquire targets, and fire when in range.</p>
      </div>
    </div>
  );
}

function summarize(ships: ShipEntity[]): [TeamSummary, TeamSummary] {
  const summary: Record<'blue' | 'red', TeamSummary> = {
    blue: { team: 'blue', ships: 0, hp: 0, maxHp: 0 },
    red: { team: 'red', ships: 0, hp: 0, maxHp: 0 }
  };

  for (const ship of ships) {
    const entry = summary[ship.ship.team];
    entry.ships += 1;
    entry.hp += Math.max(ship.ship.hp, 0);
    entry.maxHp += ship.ship.maxHp;
  }

  return [summary.blue, summary.red];
}

function TeamCard({ summary }: { summary: TeamSummary }): React.ReactElement {
  const capacity = summary.maxHp > 0 ? summary.hp / summary.maxHp : 0;
  const cls = `team-card team-card--${summary.team}`;
  const level = Math.max(0, Math.min(20, Math.round(Math.min(capacity, 1) * 20)));
  return (
    <div className={cls}>
      <h3 className="team-name">{summary.team === 'blue' ? 'Alliance' : 'Reavers'}</h3>
      <div className="stat">Fleet strength: <strong>{summary.ships}</strong></div>
      <div className="stat">Total hull integrity: <strong>{summary.hp.toFixed(0)}</strong></div>
      <div className="progress">
        <span className={`progress-fill progress-fill--${level}`} />
      </div>
    </div>
  );
}

// Ripple debug panel removed
