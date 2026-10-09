import { useEffect, useRef } from 'react';

/**
 * Runs `callback` every `delayMs` milliseconds. Pass `delayMs = null` to pause.
 * The latest callback is always used without restarting the interval, and the
 * timer is cleaned up on unmount or when the delay changes.
 *
 * @param {() => void} callback - Function to run on each tick.
 * @param {number | null} delayMs - Interval in ms, or null to pause.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return undefined;
    const id = setInterval(() => callbackRef.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
