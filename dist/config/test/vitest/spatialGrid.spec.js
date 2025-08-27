import { describe, it, expect } from 'vitest';
import SpatialGrid, { segmentIntersectsCircle } from '../../src/spatialGrid';
describe('SpatialGrid', () => {
    it('inserts and queries entities in the same cell', () => {
        const grid = new SpatialGrid(10);
        const e1 = { id: 1, x: 5, y: 5 };
        grid.insert(e1);
        const res = grid.queryRadius(5, 5, 1);
        expect(res).toContain(e1);
    });
    it('returns nearby cells within radius', () => {
        const grid = new SpatialGrid(10);
        const e1 = { id: 1, x: 5, y: 5 };
        const e2 = { id: 2, x: 25, y: 5 };
        grid.insert(e1);
        grid.insert(e2);
        // query around x=15 should include both if radius covers the distance
        const res = grid.queryRadius(15, 5, 11);
        expect(res).toContain(e1);
        expect(res).toContain(e2);
    });
    it('does not return duplicates when entity spans multiple cells (inserted once)', () => {
        const grid = new SpatialGrid(10);
        const e1 = { id: 1, x: 9, y: 9 };
        grid.insert(e1);
        // Query a radius that covers several cells containing the same entity
        const res = grid.queryRadius(9, 9, 5);
        // Should contain e1 only once
        const count = res.filter(r => r === e1).length;
        expect(count).toBe(1);
    });
    it('pool acquire/release and clear works', () => {
        const g = SpatialGrid.acquire(16);
        expect(g).toBeDefined();
        g.insert({ id: 1, x: 5, y: 5 });
        SpatialGrid.release(g);
        const g2 = SpatialGrid.acquire(16);
        // cleared, so query should be empty
        const res = g2.queryRadius(5, 5, 1);
        expect(res.length).toBe(0);
        SpatialGrid.release(g2);
    });
    it('segment-circle detects swept collisions', () => {
        // circle at (50,50) radius 5
        const hit = segmentIntersectsCircle(40, 50, 60, 50, 50, 50, 5);
        expect(hit).toBe(true);
        const miss = segmentIntersectsCircle(40, 50, 44, 50, 50, 50, 5);
        expect(miss).toBe(false);
    });
});
