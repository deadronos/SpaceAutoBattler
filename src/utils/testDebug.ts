// Lightweight, test-only debug logger for unit tests.
// - Avoids synchronous fs calls (build rule: no sync fs)
// - Uses dynamic import of node:fs/promises only when running in Node tests
// - No-ops in browser builds or when VITEST_AI_DEBUG is not set

 

function isTestDebugEnabled(): boolean {
  try {
    // Enable when running unit tests (NODE_ENV=test) or when explicitly requested
    return (
      typeof process !== 'undefined' &&
      (process.env.VITEST_AI_DEBUG === '1' || process.env.NODE_ENV === 'test')
    );
  } catch {
    return false;
  }
}

/**
 * Append a single line to a file under tmp/ for test diagnostics.
 * Never throws; silently no-ops when not enabled or on any error.
 */
export function writeTestLogLine(file: string, line: string): void {
  if (!isTestDebugEnabled()) return;
  try {
    // Resolve Node's fs.promises at runtime via an eval'd require to avoid
    // bundler resolution (keeps browser builds clean and tree-shakeable).
     
    // Minimal dynamic require helper; cast to unknown then to Node fs.promises
    const maybeReq = (Function('try { return typeof require === "function" ? require : null; } catch { return null; }') as unknown) as
      | (() => unknown)
      | null;
    if (!maybeReq) return;
    const req = maybeReq();
    if (!req) return;
    // Narrow to any here to call into Node fs APIs; this is runtime-only for tests
  const fs = (req as unknown as (m: string) => unknown)('fs') as typeof import('fs');
  const fsp = fs && (fs.promises as typeof import('fs').promises);
    if (!fs) return;
    // When running under NODE_ENV=test prefer a synchronous write to ensure
    // test-time logs are present before the process exits. This is a narrow
    // test-only behavior and guarded by isTestDebugEnabled().
    try {
      // Use an async buffered writer even in test mode to avoid build-time
      // failures for synchronous fs usage. Buffer entries per-file and flush
      // them on process beforeExit so test artifacts stay deterministic while
      // remaining non-blocking during runtime.
      try {
        const path = (req as unknown as (m: string) => unknown)('path') as typeof import('path');
        const outFile = path.isAbsolute(file) ? file : path.join(process.cwd(), file);

        // Typed global container for buffers to avoid 'any' and survive
        // module reloads in the test environment.
        type TestLogGlobal = { __testLogBuffers?: Map<string, string[]>; __testLogFlushRegistered?: boolean };
        const g = globalThis as unknown as TestLogGlobal;
        if (!g.__testLogBuffers) g.__testLogBuffers = new Map<string, string[]>();
        const buffers = g.__testLogBuffers;
        const out = line.endsWith('\n') ? line : line + '\n';
        if (!buffers.has(outFile)) buffers.set(outFile, []);
        buffers.get(outFile)!.push(out);

        // Register a single beforeExit handler to flush buffers once
        if (!g.__testLogFlushRegistered) {
          g.__testLogFlushRegistered = true;
          const fspLocal = fs.promises;
          const flush = async () => {
            for (const [p, lines] of buffers.entries()) {
              try {
                await fspLocal.mkdir(path.dirname(p), { recursive: true });
                await fspLocal.appendFile(p, lines.join(''), { encoding: 'utf8' });
              } catch {
                /* ignore per-file write errors */
              }
            }
          };
          try {
            if (typeof process !== 'undefined' && typeof process.on === 'function') {
              process.on('beforeExit', () => {
                // fire-and-forget flush; tests finish shortly after
                void flush();
              });
            }
          } catch {
            /* ignore handler registration errors */
          }
        }
        return;
      } catch {
        /* ignore path resolution errors */
      }
    } catch {
      // ignore and fall back to async path
    }
    if (!fsp) return;
    (async () => {
      try {
        await fsp.mkdir('tmp', { recursive: true });
        await fsp.appendFile(file, line, { encoding: 'utf8' });
      } catch {
        /* ignore errors to keep tests resilient */
      }
    })();
  } catch {
    /* best-effort only */
  }
}
