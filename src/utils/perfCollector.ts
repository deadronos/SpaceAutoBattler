export function enablePerfCollectorIfRequested(): void {
  try {
    const enabled = typeof location !== 'undefined' && location.search.includes('debugPerf=1');
    if (!enabled) {
      return;
    }
    if ((window as any).__perf && typeof (window as any).__perf.addEvent === 'function') {
      try { console.debug('[perf] collector already active (init)'); } catch {}
      return;
    }
    const perf = {
      _frameTimes: [] as number[],
      _events: [] as { name: string; ms: number; t: number }[],
      addEvent(e: { name: string; ms: number }) {
        this._events.push({ name: e.name, ms: e.ms, t: performance.now() });
        if (this._events.length > 2000) this._events.shift();
      },
      startFpsSampling() {
        let last = performance.now();
        const loop = (ts: number) => {
          const dt = ts - last; last = ts;
          this._frameTimes.push(dt);
          if (this._frameTimes.length > 600) this._frameTimes.shift();
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      },
      getFpsStats() {
        const arr = this._frameTimes.slice();
        if (!arr.length) return { avgFps: 0, p99FrameMs: 0 };
        const avg = arr.reduce((a: number, b: number)=>a+b,0) / arr.length;
        const fps = 1000 / avg;
        const sorted = arr.slice().sort((a: number, b: number)=>a-b);
        const idx = Math.max(0, Math.floor(sorted.length * 0.99) - 1);
        return { avgFps: fps, p99FrameMs: sorted[idx] };
      },
      getEvents() { return this._events.slice(); }
    } as any;
    (window as any).__perf = perf;
    perf.startFpsSampling();
    try { console.debug('[perf] collector enabled (init)'); } catch {}
  } catch { /* ignore */ }
}
