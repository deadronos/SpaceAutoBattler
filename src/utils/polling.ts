export interface PollOptions {
  /** Interval between attempts, in ms. Defaults to 100. */
  intervalMs?: number;
  /** Maximum number of attempts before giving up. Defaults to unlimited. */
  maxAttempts?: number;
  /** Wall-clock budget in ms; stops once elapsed reaches this. Defaults to unlimited. */
  maxWaitMs?: number;
  /** Called once if the budget is exhausted before `fn` returns true. */
  onTimeout?: () => void;
  /** Called if `fn` throws. When provided, polling stops after the call. */
  onError?: (error: unknown) => void;
}

/**
 * Repeatedly invokes `fn` until it returns `true` or the budget is spent.
 * Returns a cancel function. When both `maxAttempts` and `maxWaitMs` are set,
 * polling stops at whichever is reached first.
 *
 * Errors thrown by `fn` are treated as "not ready yet" so a transient failure
 * does not abort the poll, unless `onError` is provided — in that case the
 * error is reported and polling stops.
 *
 * @param {() => boolean} fn - Predicate; return true to stop polling.
 * @param {PollOptions} [options] - Interval/budget/timeout/error options.
 * @returns {() => void} Cancel function.
 */
export function pollUntil(fn: () => boolean, options: PollOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? 100;
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY;
  const maxWaitMs = options.maxWaitMs;
  const start = maxWaitMs !== undefined ? Date.now() : 0;
  let attempts = 0;
  let cancelled = false;

  const handle = setInterval(() => {
    if (cancelled) return;
    attempts += 1;

    let done = false;
    try {
      done = fn();
    } catch (err) {
      if (options.onError) {
        clearInterval(handle);
        options.onError(err);
        return;
      }
      done = false;
    }

    const outOfTime = maxWaitMs !== undefined && Date.now() - start >= maxWaitMs;
    if (done || attempts >= maxAttempts || outOfTime) {
      clearInterval(handle);
      if (!done) options.onTimeout?.();
    }
  }, intervalMs);

  return () => {
    cancelled = true;
    clearInterval(handle);
  };
}
