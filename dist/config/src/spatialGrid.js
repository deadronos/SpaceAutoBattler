// Lightweight spatial grid for 2D entity partitioning
// Lightweight spatial grid for 2D entity partitioning
export default class SpatialGrid {
    cellSize;
    grid;
    // simple pooled instances to avoid per-frame allocations
    // pool keyed by cellSize to avoid reuse mismatch; cap instances per key
    static _pools = new Map();
    static _perKeyCap = 4;
    static acquire(cellSize = 64) {
        const key = cellSize | 0;
        const pool = this._pools.get(key) || [];
        const inst = pool.pop();
        if (inst) {
            inst.cellSize = cellSize;
            return inst;
        }
        return new SpatialGrid(cellSize);
    }
    static release(inst) {
        const key = (inst.cellSize || 64) | 0;
        inst.clear();
        let pool = this._pools.get(key);
        if (!pool) {
            pool = [];
            this._pools.set(key, pool);
        }
        if (pool.length < this._perKeyCap)
            pool.push(inst);
        // else drop instance and let GC collect
    }
    constructor(cellSize = 64) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    key(cx, cy) {
        return cx + "," + cy;
    }
    insert(entity) {
        const cx = Math.floor((entity.x || 0) / this.cellSize);
        const cy = Math.floor((entity.y || 0) / this.cellSize);
        const k = this.key(cx, cy);
        let bucket = this.grid.get(k);
        if (!bucket) {
            bucket = [];
            this.grid.set(k, bucket);
        }
        bucket.push(entity);
    }
    queryRadius(x, y, radius) {
        const minCx = Math.floor((x - radius) / this.cellSize);
        const maxCx = Math.floor((x + radius) / this.cellSize);
        const minCy = Math.floor((y - radius) / this.cellSize);
        const maxCy = Math.floor((y + radius) / this.cellSize);
        const results = [];
        const seen = new Set();
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const bucket = this.grid.get(this.key(cx, cy));
                if (!bucket)
                    continue;
                for (const e of bucket) {
                    if (!seen.has(e)) {
                        seen.add(e);
                        results.push(e);
                    }
                }
            }
        }
        return results;
    }
    // clear internal storage for reuse
    clear() {
        this.grid.clear();
    }
}
// Utility: segment-circle intersection test used for swept collisions
export function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
    // Translate so circle at origin
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    // Solve quadratic a*t^2 + b*t + c = 0
    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0)
        return false;
    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);
    // If either t within [0,1], segment intersects
    if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1))
        return true;
    return false;
}
