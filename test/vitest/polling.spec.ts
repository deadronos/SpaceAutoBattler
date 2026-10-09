import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { pollUntil } from '../../src/utils/polling.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('pollUntil', () => {
  it('stops once the predicate returns true', () => {
    vi.useFakeTimers();
    let calls = 0;

    const cancel = pollUntil(
      () => {
        calls += 1;
        return calls >= 3;
      },
      { intervalMs: 10 },
    );

    vi.advanceTimersByTime(100);
    expect(calls).toBe(3);

    // Cancelling after completion is a no-op.
    cancel();
    vi.advanceTimersByTime(100);
    expect(calls).toBe(3);
  });

  it('invokes onTimeout when the attempt budget is exhausted', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    pollUntil(() => false, { intervalMs: 10, maxAttempts: 2, onTimeout });
    vi.advanceTimersByTime(100);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('treats a throwing predicate as not-ready and keeps polling', () => {
    vi.useFakeTimers();
    let calls = 0;

    pollUntil(
      () => {
        calls += 1;
        if (calls < 2) throw new Error('not ready');
        return true;
      },
      { intervalMs: 10 },
    );

    vi.advanceTimersByTime(100);
    expect(calls).toBe(2);
  });
});
