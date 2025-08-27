// Simple benchmark for SpatialGrid-like behavior (Node-friendly JS)
class SpatialGrid {
    constructor(cellSize = 64) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    key(cx, cy) { return cx + ',' + cy; }
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
}
function makeEntities(n, areaW, areaH) {
    const arr = new Array(n);
    for (let i = 0; i < n; i++)
        arr[i] = { id: i, x: Math.random() * areaW, y: Math.random() * areaH };
    return arr;
}
function bench({ ships, bullets, cellSizes = [32, 64, 128], iterations = 5 }) {
    const areaW = 2000, areaH = 2000;
    const shipEntities = makeEntities(ships, areaW, areaH);
    const bulletEntities = makeEntities(bullets, areaW, areaH);
    console.log(`Benchmark: ships=${ships} bullets=${bullets} iter=${iterations}`);
    for (const cs of cellSizes) {
        let total = 0n;
        for (let it = 0; it < iterations; it++) {
            const g = new SpatialGrid(cs);
            const t0 = process.hrtime.bigint();
            for (const s of shipEntities)
                g.insert(s);
            for (const b of bulletEntities) {
                // conservative query radius
                g.queryRadius(b.x, b.y, 1 + cs);
            }
            const t1 = process.hrtime.bigint();
            total += (t1 - t0);
        }
        const avgMs = Number(total / BigInt(iterations)) / 1e6;
        console.log(`  cellSize=${cs} avg ${avgMs.toFixed(3)} ms`);
    }
}
// Simple cases
bench({ ships: 50, bullets: 200 });
bench({ ships: 200, bullets: 800 });
bench({ ships: 500, bullets: 2000, cellSizes: [16, 32, 64, 128], iterations: 3 });
export {};
