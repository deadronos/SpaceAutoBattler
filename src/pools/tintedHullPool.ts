// Lightweight per-team capped pool for tinted hull canvases.
// Keeps insertion order and enforces a per-team cap and a global cap.
export type TintedHullPoolOptions = {
  globalCap?: number;
  perTeamCap?: number;
};

export default class TintedHullPool {
  private map: Map<string, HTMLCanvasElement> = new Map();
  private teamMap: Map<string, string[]> = new Map(); // teamColor -> array of keys (in insertion order)
  // expose caps so callers/tests can read/update them if needed
  public globalCap: number;
  public perTeamCap: number;

  constructor(opts?: TintedHullPoolOptions) {
    this.globalCap = opts?.globalCap ?? 256;
    this.perTeamCap = opts?.perTeamCap ?? 64;
  }

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): HTMLCanvasElement | undefined {
    return this.map.get(key);
  }

  // set a canvas and enforce caps
  set(key: string, canvas: HTMLCanvasElement): this {
    // If already present, delete so we re-insert (move to MRU)
    if (this.map.has(key)) {
      this._removeKeyFromTeam(key);
      this.map.delete(key);
    }
    // Development-time assert: detect if the same canvas object is being reused
    // across different keys. This usually indicates accidental shared mutable
    // canvas instances which lead to tint/caching bugs.
    const nodeEnv = (typeof process !== 'undefined' && (process.env && process.env.NODE_ENV)) ? process.env.NODE_ENV : (typeof (globalThis as any).NODE_ENV !== 'undefined' ? (globalThis as any).NODE_ENV : 'development');
    const throwFlag = (typeof process !== 'undefined' && process.env && process.env.THROW_ON_SHARED_TINT) ? process.env.THROW_ON_SHARED_TINT : (typeof (globalThis as any).THROW_ON_SHARED_TINT !== 'undefined' ? (globalThis as any).THROW_ON_SHARED_TINT : undefined);
    const shouldCheck = nodeEnv !== 'production';
    if (shouldCheck) {
      for (const [k, v] of this.map.entries()) {
        if (v === canvas && k !== key) {
          const msg = `[TintedHullPool] Detected shared canvas instance across keys: existing='${k}' new='${key}'. Avoid reusing the same HTMLCanvasElement for different tinted keys.`;
          if (throwFlag === '1' || String(throwFlag).toLowerCase() === 'true') {
            throw new Error(msg);
          } else {
            // eslint-disable-next-line no-console
            console.warn(msg);
          }
          break;
        }
      }
    }
    this.map.set(key, canvas);
    const team = this._teamForKey(key);
    if (!this.teamMap.has(team)) this.teamMap.set(team, []);
    this.teamMap.get(team)!.push(key);

    // Enforce per-team cap
    const arr = this.teamMap.get(team)!;
    while (arr.length > this.perTeamCap) {
      const oldestKey = arr.shift();
      if (oldestKey) this.map.delete(oldestKey);
    }

    // Enforce global cap (evict oldest broadly)
    while (this.map.size > this.globalCap) {
      const it = this.map.keys();
      const oldest = it.next().value as string | undefined;
      if (!oldest) break;
      this._removeKeyFromTeam(oldest);
      this.map.delete(oldest);
    }
    return this;
  }

  delete(key: string): boolean {
    this._removeKeyFromTeam(key);
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.teamMap.clear();
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }

  // Helper: extract team color from key formatted as "<shipType>::<teamColor>"
  private _teamForKey(key: string): string {
    const parts = key.split('::');
    return parts.length >= 2 ? parts.slice(1).join('::') : '';
  }

  private _removeKeyFromTeam(key: string) {
    const team = this._teamForKey(key);
    const arr = this.teamMap.get(team);
    if (!arr) return;
    const idx = arr.indexOf(key);
    if (idx >= 0) arr.splice(idx, 1);
    if (arr.length === 0) this.teamMap.delete(team);
  }
}
