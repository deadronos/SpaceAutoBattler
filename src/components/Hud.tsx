import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { ShipEntity } from '../types/index.js';
import { useOptionalGameState } from '../game/context.js';
import { useArchetypeEntities } from '../hooks/useArchetypeEntities.js';

interface TeamSummary {
  team: 'blue' | 'red';
  ships: number;
  hp: number;
  maxHp: number;
}

export function Hud(): JSX.Element {
  const state = useOptionalGameState();
  const ships = state ? useArchetypeEntities<ShipEntity>(state.queries.ships) : [];

  const [blue, red] = useMemo(() => summarize(ships), [ships]);

  return (
    <div className="hud">
      <div className="hud-panel">
        <h2>Space Auto Battler</h2>
        <p className="subtitle">React Three Fiber · Miniplex · Rapier</p>
        <div className="team-grid">
          <TeamCard summary={blue} accent="var(--blue)" />
          <TeamCard summary={red} accent="var(--red)" />
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

function TeamCard({ summary, accent }: { summary: TeamSummary; accent: string }): JSX.Element {
  const capacity = summary.maxHp > 0 ? summary.hp / summary.maxHp : 0;
  return (
    <div className="team-card" style={{ '--accent': accent } as CSSProperties}>
      <h3 className="team-name">{summary.team === 'blue' ? 'Alliance' : 'Reavers'}</h3>
      <div className="stat">Fleet strength: <strong>{summary.ships}</strong></div>
      <div className="stat">Total hull integrity: <strong>{summary.hp.toFixed(0)}</strong></div>
      <div className="progress">
        <span style={{ width: `${Math.min(capacity, 1) * 100}%` }} />
      </div>
    </div>
  );
}
