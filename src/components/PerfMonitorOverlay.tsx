import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Perf } from 'r3f-perf';
import { useUiStore } from '../game/uiStore.js';

const PANEL_CLASS = 'hud-perf-monitor';
const PANEL_MARGIN = 8;

type Point = { x: number; y: number };

type DragState = {
  active: boolean;
  origin: Point;
  start: Point;
  size: Point;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function PerfMonitorOverlay(): React.ReactElement | null {
  const enabled = useUiStore((state) => state.perfMonitorEnabled);
  const position = useUiStore((state) => state.perfMonitorPosition);
  const setPosition = useUiStore((state) => state.setPerfMonitorPosition);
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef<Point>(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const drag: DragState = {
      active: false,
      origin: positionRef.current,
      start: { x: 0, y: 0 },
      size: { x: 0, y: 0 },
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!drag.active) {
        return;
      }

      const deltaX = event.clientX - drag.start.x;
      const deltaY = event.clientY - drag.start.y;
      const nextX = drag.origin.x + deltaX;
      const nextY = drag.origin.y + deltaY;

      const maxX = Math.max(0, window.innerWidth - drag.size.x - PANEL_MARGIN);
      const maxY = Math.max(0, window.innerHeight - drag.size.y - PANEL_MARGIN);

      setPosition({
        x: clamp(nextX, PANEL_MARGIN, maxX),
        y: clamp(nextY, PANEL_MARGIN, maxY),
      });
    };

    const handlePointerUp = () => {
      if (!drag.active) {
        return;
      }
      drag.active = false;
      setDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (!node) {
        return;
      }

      drag.active = true;
      drag.origin = positionRef.current;
      drag.start = { x: event.clientX, y: event.clientY };
      drag.size = { x: node.offsetWidth, y: node.offsetHeight };
      setDragging(true);
      event.preventDefault();

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    let rafHandle = 0;
    let node: HTMLDivElement | null = null;

    const bindNode = () => {
      node = document.querySelector<HTMLDivElement>(`.${PANEL_CLASS}`);
      if (!node) {
        rafHandle = window.requestAnimationFrame(bindNode);
        return;
      }
      node.addEventListener('pointerdown', handlePointerDown);
    };

    bindNode();

    return () => {
      if (rafHandle) {
        window.cancelAnimationFrame(rafHandle);
      }
      if (node) {
        node.removeEventListener('pointerdown', handlePointerDown);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      drag.active = false;
      setDragging(false);
    };
  }, [enabled, setPosition]);

  if (!enabled) {
    return null;
  }

  const style = {
    top: `${position.y}px`,
    left: `${position.x}px`,
    right: 'auto',
    bottom: 'auto',
    position: 'fixed' as const,
    cursor: dragging ? 'grabbing' : 'grab',
  };

  return (
    <Perf
      className={PANEL_CLASS}
      position="top-left"
      style={style}
      showGraph
      openByDefault={false}
    />
  );
}
