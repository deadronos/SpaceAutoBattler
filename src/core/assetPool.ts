// Simple LRU cache for assets (small footprint)
// Simple, performant LRU cache using Map insertion order.
// Map preserves insertion order; to mark an entry as recently used we delete and re-set it.
// Eviction is then O(1) by reading the first key from map.keys().next().value.
export class LRUAssetPool<T = any> {
  private capacity: number;
  private map: Map<string, T>;

  constructor(capacity = 64) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key: string): T | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      // mark as recently used
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: T): this {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    // Evict oldest if over capacity
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    return this;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  // Expose entries for compatibility
  entries(): IterableIterator<[string, T]> {
    return this.map.entries();
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }

  [Symbol.iterator](): IterableIterator<[string, T]> {
    return this.map[Symbol.iterator]();
  }
}

export default LRUAssetPool;
