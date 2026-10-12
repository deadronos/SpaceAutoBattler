import { memo, useEffect, useId, useRef, useState } from 'react';
import type React from 'react';
import type { ShipEntity, ProgressionEvent } from '../types/index.js';
import { buildProgressionPanelData, type ProgressionPanelShip } from './progressionPanelData.js';
import { useOptionalGameState } from '../app/context.js';
import { useUiStore } from '../app/uiStore.js';
import { useInterval } from '../hooks/useInterval.js';
import { clamp } from '../utils/math.js';
import './progression-panel.css';

const REFRESH_INTERVAL_MS = 250;

/**
 * Field-equality check used by the stable-identity reconciler. Two rows are
 * considered equal when every rendered field (including the capped event slice)
 * matches, so the previous object can be reused for the next render.
 */
function progressionShipsEqual(a: ProgressionPanelShip, b: ProgressionPanelShip): boolean {
  if (
    a.id !== b.id ||
    a.name !== b.name ||
    a.type !== b.type ||
    a.team !== b.team ||
    a.level !== b.level ||
    a.xp !== b.xp ||
    a.xpToNext !== b.xpToNext ||
    a.events.length !== b.events.length
  ) {
    return false;
  }

  for (let i = 0; i < a.events.length; i++) {
    const prev = a.events[i]!;
    const next = b.events[i]!;
    if (prev === next) continue;
    if (
      prev.ts !== next.ts ||
      prev.type !== next.type ||
      prev.deltaXp !== next.deltaXp ||
      prev.source !== next.source ||
      prev.details !== next.details
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Reconciles freshly built panel rows against a per-id cache, reusing the
 * previous object reference whenever the row is field-equal. This keeps `ship`
 * props referentially stable across 250 ms re-renders so memoized cards can
 * skip work. Ids that disappeared are evicted from the cache.
 */
function reconcileProgressionPanelShips(
  cache: Map<number, ProgressionPanelShip>,
  next: readonly ProgressionPanelShip[],
): ProgressionPanelShip[] {
  const seen = new Set<number>();
  const reconciled: ProgressionPanelShip[] = [];

  for (const entry of next) {
    seen.add(entry.id);
    const previous = cache.get(entry.id);
    if (previous && progressionShipsEqual(previous, entry)) {
      reconciled.push(previous);
    } else {
      cache.set(entry.id, entry);
      reconciled.push(entry);
    }
  }

  for (const id of cache.keys()) {
    if (!seen.has(id)) cache.delete(id);
  }

  return reconciled;
}

export function ProgressionPanel(): React.ReactElement | null {
  const state = useOptionalGameState();
  const enabled = useUiStore((s) => s.progressionPanelEnabled);
  const position = useUiStore((s) => s.progressionPanelPosition);
  const setPosition = useUiStore((s) => s.setProgressionPanelPosition);
  const [, setRefreshTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(position);
  // Per-ship cache so unchanged rows keep referential identity across ticks.
  const progressionCacheRef = useRef<Map<number, ProgressionPanelShip>>(new Map());
  useEffect(() => {
    posRef.current = position;
  }, [position]);

  useInterval(() => setRefreshTick((v) => v + 1), enabled ? REFRESH_INTERVAL_MS : null);

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

  const progressionData = (() => {
    if (!enabled || !state) return null;

    const ships = state.queries.ships.entities as ShipEntity[];
    const built = buildProgressionPanelData(ships, state.progressionEvents);
    return reconcileProgressionPanelShips(progressionCacheRef.current, built);
  })();

  // Wall-clock bucket (1s resolution) used only to re-render cards so their
  // relative timestamps refresh. Memoized cards re-render at most once per
  // second instead of on every 250 ms tick.
  const nowBucket = Math.floor(Date.now() / 1000);

  // NOTE: This effect was intentionally placed before the component's early returns
  // so the hook is executed on every render. Moving it after conditional returns
  // previously caused mismatched hook ordering and the runtime error
  // "Rendered more hooks than during the previous render." See React Rules of Hooks:
  // https://react.dev/link/rules-of-hooks
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
        <div className="progression-panel__meta">{progressionData.length} ships tracked</div>
      </div>
      <div className="progression-panel__ships">
        {progressionData.map((ship) => (
          <ShipProgressionCard key={ship.id} ship={ship} nowBucket={nowBucket} />
        ))}
      </div>
    </div>
  );
}

const ShipProgressionCard = memo(function ShipProgressionCard({
  ship,
  nowBucket,
}: {
  ship: ProgressionPanelShip;
  nowBucket: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const eventsId = useId();

  const progressPercent = ship.xpToNext > 0 ? (ship.xp / ship.xpToNext) * 100 : 100;
  const teamClass = `ship-progression-card ship-progression-card--${ship.team}`;
  const fillRef = useRef<HTMLDivElement | null>(null);

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setExpanded((value) => !value);
    }
  };

  // Update progress fill width via DOM to avoid inline JSX style props
  useEffect(() => {
    const node = fillRef.current;
    if (!node) return;
    const clamped = clamp(progressPercent, 0, 100);
    node.style.width = `${clamped}%`;
  }, [progressPercent]);

  return (
    <div className={teamClass}>
      <div
        className="ship-progression-card__header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={eventsId}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} events for ${ship.name}`}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className="ship-progression-card__info">
          <span className="ship-progression-card__name">{ship.name}</span>
          <span className="ship-progression-card__level">Lv {ship.level}</span>
        </div>
        <div className="ship-progression-card__xp">
          <div className="ship-progression-card__xp-text">
            {formatXP(ship.xp)} / {formatXP(ship.xpToNext)} XP
          </div>
          <div className="ship-progression-card__progress-bar">
            <div className="ship-progression-card__progress-fill" ref={fillRef} />
          </div>
        </div>
        <span className="ship-progression-card__toggle" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
      </div>
      {expanded && (
        <div id={eventsId} className="ship-progression-card__events">
          {ship.events.length > 0 ? (
            <ul className="progression-events">
              {ship.events.map((event, index) => (
                <EventRow key={`${ship.id}-${index}`} event={event} nowBucket={nowBucket} />
              ))}
            </ul>
          ) : (
            <p className="progression-events--empty">No recent events</p>
          )}
        </div>
      )}
    </div>
  );
});

function EventRow({
  event,
  nowBucket,
}: {
  event: ProgressionEvent;
  nowBucket: number;
}): React.ReactElement {
  const timeAgo = formatTimeAgo(event.ts, nowBucket * 1000);
  const deltaText = event.deltaXp ? `+${formatXP(event.deltaXp)} XP` : '';

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
    case 'damage':
      return '⚔';
    case 'kill':
      return '💀';
    case 'levelup':
      return '⭐';
    default:
      return '•';
  }
}

function formatTimeAgo(timestamp: number, now: number): string {
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function formatXP(value: number): string {
  return value.toFixed(1);
}
