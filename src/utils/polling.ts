export interface PollOptions {
  /** Interval between attempts, in ms. Defaults to 100. */
  intervalMs?: number;
  /** Maximum number of attempts before giving up. Defaults to unlimited. */
  maxAttempts?: number;
  /** Called once if the budget is exhausted before `fn` returns true. */
  onTimeout?: () => void;
}

/**
 * Repeatedly invokes `fn` until it returns `true` or the attempt budget is
 * spent. Returns a cancel function. Errors thrown by `fn` are treated as "not
 * ready yet" so a transient failure does not abort the poll.
 *
 * @param {() => boolean} fn - Predicate; return true to stop polling.
 * @param {PollOptions} [options] - Interval/budget/timeout options.
 * @returns {() => void} Cancel function.
 */
export function pollUntil(fn: () => boolean, options: PollOptions = {}): () => void {
  const intervalMs = options.intervalMs ?? 100;
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY;
  let attempts = 0;
  let cancelled = false;

  const handle = setInterval(() => {
    if (cancelled) return;
    attempts += 1;

    let done = false;
    try {
      done = fn();
    } catch {
      done = false;
    }

    if (done || attempts >= maxAttempts) {
      clearInterval(handle);
      if (!done) options.onTimeout?.();
    }
  }, intervalMs);

  return () => {
    cancelled = true;
    clearInterval(handle);
  };
}
