/**
 * Lightweight hotpath performance meter for frame-time attribution
 * Provides begin()/end() instrumentation that no-ops when disabled
 */

interface PerfSample {
  name: string;
  ms: number;
  timestamp: number;
}

interface SubsystemStats {
  name: string;
  totalMs: number;
  count: number;
  avgMs: number;
  p95Ms: number;
  samples: number[];
}

interface PerfSummary {
  frameCount: number;
  totalFrameMs: number;
  avgFrameMs: number;
  p95FrameMs: number;
  subsystems: SubsystemStats[];
}

class HotpathMeter {
  private enabled = false;
  private samples: PerfSample[] = [];
  private activeTimers = new Map<string, number>();
  private maxSamples = 1000; // Rolling buffer size
  private maxFrames = 300; // Max frames for p95 calculations

  constructor() {
    // Auto-enable via query param ?debugPerf=1 or explicit config
    if (typeof window !== 'undefined' && window.location?.search.includes('debugPerf=1')) {
      this.enable();
    }
  }

  enable(): void {
    this.enabled = true;
    console.debug('[perf] hotpath meter enabled');
  }

  disable(): void {
    this.enabled = false;
    this.samples.length = 0;
    this.activeTimers.clear();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  begin(name: string): void {
    if (!this.enabled) return;
    this.activeTimers.set(name, performance.now());
  }

  end(name: string): void {
    if (!this.enabled) return;

    const startTime = this.activeTimers.get(name);
    if (startTime === undefined) {
      console.warn(`[perf] end() called for '${name}' without matching begin()`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.samples.push({
      name,
      ms: duration,
      timestamp: endTime,
    });

    // Trim samples if over limit
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.activeTimers.delete(name);
  }

  getSummary(): PerfSummary {
    if (!this.enabled || this.samples.length === 0) {
      return {
        frameCount: 0,
        totalFrameMs: 0,
        avgFrameMs: 0,
        p95FrameMs: 0,
        subsystems: [],
      };
    }

    // Group samples by subsystem
    const subsystemMap = new Map<string, number[]>();

    for (const sample of this.samples) {
      if (!subsystemMap.has(sample.name)) {
        subsystemMap.set(sample.name, []);
      }
      subsystemMap.get(sample.name)!.push(sample.ms);
    }

    // Calculate stats for each subsystem
    const subsystems: SubsystemStats[] = [];
    let totalFrameMs = 0;

    for (const [name, samples] of subsystemMap) {
      const sortedSamples = samples.slice().sort((a, b) => a - b);
      const totalMs = samples.reduce((sum, ms) => sum + ms, 0);
      const avgMs = totalMs / samples.length;
      const p95Index = Math.max(0, Math.floor(sortedSamples.length * 0.95) - 1);
      const p95Ms = sortedSamples[p95Index] || 0;

      subsystems.push({
        name,
        totalMs,
        count: samples.length,
        avgMs: Math.round(avgMs * 100) / 100,
        p95Ms: Math.round(p95Ms * 100) / 100,
        samples: samples.slice(-this.maxFrames), // Keep recent samples for trending
      });

      totalFrameMs += totalMs;
    }

    // Sort subsystems by total time (highest first)
    subsystems.sort((a, b) => b.totalMs - a.totalMs);

    const frameCount = Math.max(...Array.from(subsystemMap.values()).map((s) => s.length));
    const avgFrameMs = frameCount > 0 ? totalFrameMs / frameCount : 0;

    // Calculate p95 frame time (approximation based on sum of p95s)
    const p95FrameMs = subsystems.reduce((sum, s) => sum + s.p95Ms, 0);

    return {
      frameCount,
      totalFrameMs: Math.round(totalFrameMs * 100) / 100,
      avgFrameMs: Math.round(avgFrameMs * 100) / 100,
      p95FrameMs: Math.round(p95FrameMs * 100) / 100,
      subsystems,
    };
  }

  printSummary(): void {
    const summary = this.getSummary();

    if (summary.frameCount === 0) {
      console.log('[perf] No performance data available');
      return;
    }

    console.log(`[perf] Performance Summary (${summary.frameCount} samples)`);
    console.log(
      `Total: ${summary.totalFrameMs}ms | Avg: ${summary.avgFrameMs}ms | P95: ${summary.p95FrameMs}ms`,
    );
    console.log('');
    console.log('Subsystems (ranked by total time):');

    for (const subsystem of summary.subsystems) {
      const percentage =
        summary.totalFrameMs > 0 ? Math.round((subsystem.totalMs / summary.totalFrameMs) * 100) : 0;

      console.log(
        `  ${subsystem.name.padEnd(20)} ${percentage}%`.padEnd(27) +
          `avg: ${subsystem.avgMs}ms  p95: ${subsystem.p95Ms}ms  (${subsystem.count} calls)`,
      );
    }
  }

  clear(): void {
    this.samples.length = 0;
    this.activeTimers.clear();
  }

  // Get recent samples for overlay display
  getRecentSubsystemTimes(windowMs = 1000): Record<string, number> {
    if (!this.enabled) return {};

    const now = performance.now();
    const cutoff = now - windowMs;
    const recentSamples = this.samples.filter((s) => s.timestamp >= cutoff);

    const subsystemTotals: Record<string, number> = {};
    for (const sample of recentSamples) {
      subsystemTotals[sample.name] = (subsystemTotals[sample.name] || 0) + sample.ms;
    }

    return subsystemTotals;
  }
}

// Global instance
export const perf = new HotpathMeter();

// Convenience functions for instrumentation
export function perfBegin(name: string): void {
  perf.begin(name);
}

export function perfEnd(name: string): void {
  perf.end(name);
}

export function perfEnabled(): boolean {
  return perf.isEnabled();
}

// Expose to global scope for console access
if (typeof window !== 'undefined') {
  (window as any).perf = perf;
}
