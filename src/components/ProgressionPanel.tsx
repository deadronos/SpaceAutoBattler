import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ShipEntity, ProgressionEvent } from '../types/index.js';
import { useOptionalGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import './progression-panel.css';

interface ProgressionPanelShip {
  id: number;
  name?: string;
  type?: string;
  team: 'blue' | 'red';
  level: number;
  xp: number;
  xpToNext: number;
  events: ProgressionEvent[]; // capped to recent N
}

const REFRESH_INTERVAL_MS = 250;
const MAX_EVENTS_PER_SHIP = 5;

export function ProgressionPanel(): React.ReactElement | null {
  const state = useOptionalGameState();
  const enabled = useUiStore((s) => s.progressionPanelEnabled);
  const position = useUiStore((s) => s.progressionPanelPosition);
  const setPosition = useUiStore((s) => s.setProgressionPanelPosition);
  const [refreshTick, setRefreshTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(position);
  useEffect(() => { posRef.current = position; }, [position]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setRefreshTick((v) => v + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  // Drag behavior (attach to header for better UX). Placed before early returns to keep hook order stable.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let node: HTMLDivElement | null = panelRef.current;
    if (!node) return;
    const header = node.querySelector<HTMLDivElement>('.progression-panel__header');
    if (!header) return;

    const drag = {
      active: false,
      origin: { x: posRef.current.x, y: posRef.current.y },
      start: { x: 0, y: 0 },
      size: { x: 0, y: 0 },
    };

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const onMove = (e: PointerEvent) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.start.x;
      const dy = e.clientY - drag.start.y;
      const nextX = drag.origin.x + dx;
      const nextY = drag.origin.y + dy;
      const margin = 8;
      const maxX = Math.max(0, window.innerWidth - drag.size.x - margin);
      const maxY = Math.max(0, window.innerHeight - drag.size.y - margin);
      setPosition({ x: clamp(nextX, margin, maxX), y: clamp(nextY, margin, maxY) });
    };

    const onUp = () => {
      if (!drag.active) return;
      drag.active = false;
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!node) return;
      drag.active = true;
      drag.origin = { x: posRef.current.x, y: posRef.current.y };
      drag.start = { x: e.clientX, y: e.clientY };
      drag.size = { x: node.offsetWidth, y: node.offsetHeight };
      setDragging(true);
      e.preventDefault();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    header.addEventListener('pointerdown', onDown);
    return () => {
      header.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      drag.active = false;
      setDragging(false);
    };
  }, [enabled, setPosition]);

  const progressionData = useMemo<ProgressionPanelShip[] | null>(() => {
    if (!enabled || !state) return null;
    
    const ships = state.queries.ships.entities as ShipEntity[];
    const progressionShips: ProgressionPanelShip[] = [];

    for (const ship of ships) {
      // Get events for this ship from GameState
      const events = state.progressionEvents?.get(ship.id) || [];
      
      progressionShips.push({
        id: ship.id,
        name: `${ship.ship.hull}-${ship.id}`,
        type: ship.ship.hull,
        team: ship.ship.team,
        level: ship.ship.level,
        xp: ship.ship.xp,
        xpToNext: ship.ship.xpToNext,
        events: events.slice(-MAX_EVENTS_PER_SHIP)
      });
    }

    // Sort by level descending, then by XP
    progressionShips.sort((a, b) => {
      if (a.level !== b.level) return b.level - a.level;
      return b.xp - a.xp;
    });

    return progressionShips.slice(0, 50); // Cap at 50 ships for performance
  }, [state, enabled, refreshTick]);

  // Keep DOM update effect before early returns so hooks are always called in the same order.
  useEffect(() => {
    const node = panelRef.current;
    // Guard the body so the hook runs but does nothing when not mounted or disabled
    if (!node || !enabled) return;
    node.style.position = 'fixed';
    node.style.top = `${position.y}px`;
    node.style.left = `${position.x}px`;
    node.style.zIndex = '30';
    node.style.cursor = dragging ? 'grabbing' : 'grab';
  }, [position, dragging, enabled]);

  if (!enabled) return null;
  if (!progressionData || progressionData.length === 0) return null;

  return (
    <div ref={panelRef} className="progression-panel" role="region" aria-live="polite">
      <div className="progression-panel__header">
        <div className="progression-panel__title">Progression</div>
        <div className="progression-panel__meta">
          {progressionData.length} ships tracked
        </div>
      </div>
      <div className="progression-panel__ships">
        {progressionData.map((ship) => (
          <ShipProgressionCard key={ship.id} ship={ship} />
        ))}
      </div>
    </div>
  );
}

function ShipProgressionCard({ ship }: { ship: ProgressionPanelShip }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  
  const progressPercent = ship.xpToNext > 0 ? (ship.xp / ship.xpToNext) * 100 : 100;
  const teamClass = `ship-progression-card ship-progression-card--${ship.team}`;
  const fillRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  // Update progress fill width via DOM to avoid inline JSX style props
  useEffect(() => {
    const node = fillRef.current;
    if (!node) return;
    const clamped = Math.min(100, Math.max(0, progressPercent));
    node.style.width = `${clamped}%`;
  }, [progressPercent]);

  // Update aria-expanded attribute via DOM
  useEffect(() => {
    const node = toggleRef.current;
    if (!node) return;
    node.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }, [expanded]);
   
  return (
    <div className={teamClass}>
      <div className="ship-progression-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="ship-progression-card__info">
          <span className="ship-progression-card__name">{ship.name}</span>
          <span className="ship-progression-card__level">Lv {ship.level}</span>
        </div>
        <div className="ship-progression-card__xp">
          <div className="ship-progression-card__xp-text">
            {ship.xp.toFixed(0)} / {ship.xpToNext.toFixed(0)} XP
          </div>
          <div className="ship-progression-card__progress-bar">
            <div 
              className="ship-progression-card__progress-fill"
              ref={fillRef}
            />
           </div>
         </div>
         <button
           type="button"
           ref={toggleRef}
           className="ship-progression-card__toggle"
           aria-label={expanded ? 'Collapse events' : 'Expand events'}
         >
           {expanded ? '−' : '+'}
         </button>
       </div>
       {expanded && (
         <div className="ship-progression-card__events">
           {ship.events.length > 0 ? (
             <ul className="progression-events">
               {ship.events.map((event, index) => (
                 <EventRow key={`${ship.id}-${index}`} event={event} />
               ))}
             </ul>
           ) : (
             <p className="progression-events--empty">No recent events</p>
           )}
         </div>
       )}
    </div>
  );
}

function EventRow({ event }: { event: ProgressionEvent }): React.ReactElement {
  const timeAgo = formatTimeAgo(event.ts);
  const deltaText = event.deltaXp ? `+${event.deltaXp.toFixed(0)} XP` : '';
  
  const iconClass = `progression-event__icon progression-event__icon--${event.type}`;
  
  return (
    <li className="progression-event">
      <span className={iconClass} aria-hidden="true">
        {getEventIcon(event.type)}
      </span>
      <span className="progression-event__time">{timeAgo}</span>
      <span className="progression-event__delta">{deltaText}</span>
      <span className="progression-event__details">{event.details || event.source}</span>
    </li>
  );
}

function getEventIcon(type: string): string {
  switch (type) {
    case 'damage': return '⚔';
    case 'kill': return '💀';
    case 'levelup': return '⭐';
    default: return '•';
  }
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 10) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}