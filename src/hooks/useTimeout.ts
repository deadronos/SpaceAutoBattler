import { useEffect, useRef } from 'react';

/**
 * Runs `callback` once after `delayMs` milliseconds. Pass `delayMs = null` to
 * disable. The latest callback is always used without restarting the timer, and
 * the timer is cleaned up on unmount or when the delay changes.
 *
 * @param {() => void} callback - Function to run once.
 * @param {number | null} delayMs - Delay in ms, or null to disable.
 */
export function useTimeout(callback: () => void, delayMs: number | null): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return undefined;
    const id = setTimeout(() => callbackRef.current(), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
}
