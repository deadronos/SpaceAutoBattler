import { describe, it, expect, beforeEach } from 'vitest';
import { perf, perfBegin, perfEnd, perfEnabled } from '../../src/utils/perf.js';

describe('Performance Meter', () => {
  beforeEach(() => {
    perf.clear();
    perf.disable();
  });

  it('should be disabled by default', () => {
    expect(perfEnabled()).toBe(false);
  });

  it('should enable when requested', () => {
    perf.enable();
    expect(perfEnabled()).toBe(true);
  });

  it('should have zero cost when disabled', () => {
    // When disabled, begin/end should do nothing
    perfBegin('test.operation');
    perfEnd('test.operation');
    
    const summary = perf.getSummary();
    expect(summary.frameCount).toBe(0);
    expect(summary.subsystems).toHaveLength(0);
  });

  it('should collect timing data when enabled', () => {
    perf.enable();
    
    perfBegin('test.operation');
    // Simulate some work
    const start = performance.now();
    while (performance.now() - start < 1) {
      // busy wait for 1ms
    }
    perfEnd('test.operation');
    
    const summary = perf.getSummary();
    expect(summary.frameCount).toBeGreaterThan(0);
    expect(summary.subsystems).toHaveLength(1);
    expect(summary.subsystems[0].name).toBe('test.operation');
    expect(summary.subsystems[0].avgMs).toBeGreaterThan(0);
  });

  it('should handle nested timing correctly', () => {
    perf.enable();
    
    perfBegin('outer');
    perfBegin('inner');
    perfEnd('inner');
    perfEnd('outer');
    
    const summary = perf.getSummary();
    expect(summary.subsystems).toHaveLength(2);
    
    const subsystemNames = summary.subsystems.map(s => s.name);
    expect(subsystemNames).toContain('outer');
    expect(subsystemNames).toContain('inner');
  });

  it('should calculate percentiles correctly', () => {
    perf.enable();
    
    // Add multiple samples with known timings
    for (let i = 0; i < 10; i++) {
      perfBegin('test.consistent');
      const start = performance.now();
      while (performance.now() - start < 1) {
        // busy wait for ~1ms
      }
      perfEnd('test.consistent');
    }
    
    const summary = perf.getSummary();
    expect(summary.subsystems[0].avgMs).toBeGreaterThan(0);
    expect(summary.subsystems[0].p95Ms).toBeGreaterThan(0);
    expect(summary.subsystems[0].count).toBe(10);
  });

  it('should clear data correctly', () => {
    perf.enable();
    
    perfBegin('test.operation');
    perfEnd('test.operation');
    
    expect(perf.getSummary().frameCount).toBeGreaterThan(0);
    
    perf.clear();
    
    const summary = perf.getSummary();
    expect(summary.frameCount).toBe(0);
    expect(summary.subsystems).toHaveLength(0);
  });

  it('should handle mismatched begin/end gracefully', () => {
    perf.enable();
    
    // This should not throw or cause issues
    perfEnd('nonexistent.operation');
    
    const summary = perf.getSummary();
    expect(summary.frameCount).toBe(0);
  });

  it('should maintain rolling buffer', () => {
    perf.enable();
    
    // Generate more samples than the buffer size (1000)
    for (let i = 0; i < 1100; i++) {
      perfBegin('test.rolling');
      perfEnd('test.rolling');
    }
    
    const summary = perf.getSummary();
    // Should not exceed buffer size
    expect(summary.subsystems[0].count).toBeLessThanOrEqual(1000);
  });
});