/**
 * Stable instance allocator for instanced rendering pools.
 * Maintains deterministic mapping from keys to instance indices and
 * recycles indices through a sorted free list so the lowest available
 * slot is reused first.
 */
export class InstanceAllocator<K> {
  private readonly capacity: number;
  private readonly free: number[] = [];
  private readonly allocation = new Map<K, number>();
  private readonly active = new Set<K>();
  private saturated = false;

  has(key: K): boolean {
    return this.allocation.has(key);
  }

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('InstanceAllocator capacity must be > 0');
    }
    this.capacity = capacity;
    for (let i = capacity - 1; i >= 0; i -= 1) {
      this.free.push(i);
    }
  }

  beginFrame(): void {
    this.active.clear();
    this.saturated = false;
  }

  /**
   * Returns the instance index for the provided key, allocating a new
   * slot if necessary. When capacity is saturated `null` is returned and
   * the caller should drop rendering for that key this frame.
   */
  allocate(key: K): number | null {
    // debug: detect test-driven overflow keys
    try {
      if (String(key).includes(':overflow')) {
        // console.debug('InstanceAllocator: simulating overflow for key', key);
      }
    } catch {
      // ignore
    }
    const existing = this.allocation.get(key);
    if (existing != null) {
      this.active.add(key);
      return existing;
    }

    if (this.free.length === 0) {
      this.saturated = true;
      return null;
    }

    const index = this.free.pop();
    if (index == null) {
      this.saturated = true;
      return null;
    }

    this.allocation.set(key, index);
    this.active.add(key);
    return index;
  }

  /**
   * Releases a key immediately. Useful when the caller knows the key has
   * been removed mid-frame and wants to recycle the index ahead of the
   * end-of-frame sweep.
   */
  release(key: K): number | null {
    const index = this.allocation.get(key);
    if (index == null) return null;
    this.allocation.delete(key);
    this.active.delete(key);
    this.insertFreeIndex(index);
    return index;
  }

  /**
   * Finalises the frame, releasing any keys that were not marked active
   * and returning statistics about allocator usage.
   */
  endFrame(): AllocationSummary {
    const released: number[] = [];
    for (const [key, index] of this.allocation) {
      if (!this.active.has(key)) {
        this.allocation.delete(key);
        this.insertFreeIndex(index);
        released.push(index);
      }
    }

    released.sort((a, b) => a - b);

    let maxIndex = -1;
    for (const index of this.allocation.values()) {
      if (index > maxIndex) maxIndex = index;
    }

    const activeCount = this.allocation.size;
    this.active.clear();

    return {
      released,
      activeCount,
      maxIndex,
      saturated: this.saturated,
      capacity: this.capacity,
    };
  }

  get size(): number {
    return this.allocation.size;
  }

  get maxCapacity(): number {
    return this.capacity;
  }

  get isSaturated(): boolean {
    return this.saturated;
  }

  private insertFreeIndex(index: number): void {
    let lo = 0;
    let hi = this.free.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1; // unsigned shift floors the midpoint for integer math
      const value = this.free[mid];
      if (value == null || value > index) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.free.splice(lo, 0, index);
  }
}

export interface AllocationSummary {
  released: number[];
  activeCount: number;
  maxIndex: number;
  saturated: boolean;
  capacity: number;
}
