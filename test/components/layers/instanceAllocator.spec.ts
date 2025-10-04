import { describe, it, expect, beforeEach } from 'vitest';
import { InstanceAllocator } from '../../../src/components/layers/instanceAllocator.js';

describe('InstanceAllocator', () => {
  let allocator: InstanceAllocator<number>;

  beforeEach(() => {
    allocator = new InstanceAllocator<number>(4);
  });

  it('allocates stable indices for the same key across frames', () => {
    allocator.beginFrame();
    const first = allocator.allocate(42);
    const second = allocator.allocate(7);
    expect(first).toBe(0);
    expect(second).toBe(1);
    allocator.endFrame();

    allocator.beginFrame();
    const again = allocator.allocate(42);
    expect(again).toBe(first);
    allocator.endFrame();
  });

  it('reuses freed indices in ascending order', () => {
    allocator.beginFrame();
    const first = allocator.allocate(1);
    const second = allocator.allocate(2);
    expect([first, second]).toEqual([0, 1]);
    allocator.endFrame();

    allocator.beginFrame();
    allocator.allocate(2); // keep key 2 alive
    allocator.endFrame();

    allocator.beginFrame();
    const reused = allocator.allocate(3);
    expect(reused).toBe(first);
    allocator.endFrame();
  });

  it('reports released indices and active counts', () => {
    allocator.beginFrame();
    allocator.allocate(1);
    allocator.allocate(2);
    allocator.endFrame();

    allocator.beginFrame();
    allocator.allocate(2);
    const summary = allocator.endFrame();
    expect(summary.released).toEqual([0]);
    expect(summary.activeCount).toBe(1);
    expect(summary.maxIndex).toBe(1);
  });

  it('signals saturation when capacity exceeded', () => {
    allocator.beginFrame();
    allocator.allocate(1);
    allocator.allocate(2);
    allocator.allocate(3);
    allocator.allocate(4);
    const saturatedIndex = allocator.allocate(5);
    expect(saturatedIndex).toBeNull();
    const summary = allocator.endFrame();
    expect(summary.saturated).toBe(true);
    expect(summary.capacity).toBe(4);
  });
});
