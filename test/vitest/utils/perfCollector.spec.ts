import { describe, it, expect } from 'vitest';

describe('perfCollector', () => {
  it('does nothing when location is undefined (test env)', async () => {
    // In node test environment location is undefined; function should not throw
    const mod = await import('../../../src/utils/perfCollector');
    const { enablePerfCollectorIfRequested } = mod as any;
    expect(() => enablePerfCollectorIfRequested()).not.toThrow();
  });
});
