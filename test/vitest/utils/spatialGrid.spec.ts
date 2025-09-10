import { describe, it, expect, beforeEach } from 'vitest';
// we'll import SpatialGrid dynamically inside tests to avoid Vite resolution at top-level

describe('SpatialGrid', () => {
  let grid: any;
  beforeEach(async () => {
    const mod = await import('../../../src/utils/spatialGrid.js');
    const SpatialGridCtor = mod.SpatialGrid as any;
    grid = new SpatialGridCtor(10, { width: 100, height: 100, depth: 100 });
  });

  it('insert and queryRadius returns inserted entity', () => {
    const e = { id: 1, pos: { x: 5, y: 5, z: 5 }, radius: 1, team: 0 } as unknown as Record<
      string,
      unknown
    >;
    grid.insert(e);
    const res = grid.queryRadius({ x: 5, y: 5, z: 5 }, 2);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].id).toBe(1);
  });

  it('update moves entity between cells and preserves id', () => {
    const e = { id: 2, pos: { x: 5, y: 5, z: 5 }, radius: 1, team: 0 } as unknown as Record<
      string,
      unknown
    >;
    grid.insert(e);
    grid.update(2, { x: 50, y: 50, z: 50 }, 1, 0);
    const res = grid.queryRadius({ x: 50, y: 50, z: 50 }, 5);
    expect(res.some((r: unknown) => (r as Record<string, unknown>).id === 2)).toBe(true);
  });

  it('queryKNearest honors excludeId and team filter', () => {
    grid.clear();
    for (let i = 0; i < 6; i++) {
      grid.insert({ id: i + 10, pos: { x: i * 2, y: 0, z: 0 }, radius: 1, team: i % 2 });
    }
    const center = { x: 0, y: 0, z: 0 };
    const nearest = grid.queryKNearest(center, 3, 0, undefined);
    expect(nearest.length).toBeGreaterThanOrEqual(1);
    // team filter should only return team 0
    const teamFiltered = grid.queryKNearest(center, 5, 1, undefined);
    expect(teamFiltered.every((s: unknown) => (s as Record<string, unknown>).team === 1)).toBe(
      true,
    );
    // excludeId should exclude matching id
    const excl = grid.queryKNearest(center, 5, undefined, 10);
    expect(excl.every((s: unknown) => (s as Record<string, unknown>).id !== 10)).toBe(true);
  });

  it('gcExcept removes entities not in active set', () => {
    grid.clear();
    grid.insert({ id: 100, pos: { x: 1, y: 1, z: 1 }, radius: 1, team: 0 });
    grid.insert({ id: 101, pos: { x: 2, y: 2, z: 2 }, radius: 1, team: 0 });
    grid.gcExcept(new Set([101]));
    expect(grid.isEmpty()).toBe(false);
    const found = grid.queryRadius({ x: 2, y: 2, z: 2 }, 1);
    expect(found.some((s: unknown) => (s as Record<string, unknown>).id === 101)).toBe(true);
    const removed = grid.queryRadius({ x: 1, y: 1, z: 1 }, 1);
    expect(removed.some((s: unknown) => (s as Record<string, unknown>).id === 100)).toBe(false);
  });
});
