// Simple LRU cache for assets (small footprint)
export class LRUAssetPool<T = any> extends Map<string, T> {
  private capacity: number;
  private usage: string[];
  constructor(capacity = 64) {
    super();
    this.capacity = capacity;
    this.usage = [];
  }

  get(key: string): T | undefined {
    const v = super.get(key);
    if (v !== undefined) {
      // move key to end (most recently used)
      const i = this.usage.indexOf(key);
      if (i >= 0) this.usage.splice(i, 1);
      this.usage.push(key);
    }
    return v;
  }

  set(key: string, value: T): this {
    if (!super.has(key)) {
      // new entry
      this.usage.push(key);
      super.set(key, value);
      this.enforce();
      return this;
    }
    // existing entry: update order
    const i = this.usage.indexOf(key);
    if (i >= 0) this.usage.splice(i, 1);
    this.usage.push(key);
    super.set(key, value);
    return this;
  }

  private enforce() {
    while (this.usage.length > this.capacity) {
      const k = this.usage.shift();
      if (k) {
        try { super.delete(k); } catch (e) { /* ignore */ }
      }
    }
  }
}

export default LRUAssetPool;
