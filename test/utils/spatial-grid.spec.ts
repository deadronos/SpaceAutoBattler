import { describe, expect, it } from 'vite-plus/test';
import { Vector3 } from 'three';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';

interface Item {
  id: string;
  position: Vector3;
}

const getPos = (item: Item): Vector3 => item.position;

describe('SpatialGrid', () => {
  it('queries within radius and repopulate replaces contents', () => {
    const grid = new SpatialGrid<Item>(5, getPos);
    const a = { id: 'a', position: new Vector3(0, 0, 0) };
    const b = { id: 'b', position: new Vector3(4.9, 0, 0) };
    const c = { id: 'c', position: new Vector3(12, 0, 0) };

    grid.repopulate([a, b, c]);
    expect(
      grid
        .query(new Vector3(0, 0, 0), 6)
        .map((item) => item.id)
        .sort(),
    ).toEqual(['a', 'b']);

    grid.repopulate([c]);
    expect(grid.query(new Vector3(0, 0, 0), 20).map((item) => item.id)).toEqual(['c']);
  });

  it('queryBroad returns the same set of items as query', () => {
    const grid = new SpatialGrid<Item>(5, getPos);
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `i${i}`,
      position: new Vector3(i * 3 - 60, 0, 0),
    }));
    grid.repopulate(items);

    const centre = new Vector3(0, 0, 0);
    const stable = grid
      .query(centre, 30)
      .map((item) => item.id)
      .sort();
    const broad = grid
      .queryBroad(centre, 30)
      .map((item) => item.id)
      .sort();

    expect(broad).toEqual(stable);
  });

  it('detects an occluder on the line segment between source and target', () => {
    const grid = new SpatialGrid<Item>(5, getPos);
    const source = { id: 's', position: new Vector3(0, 0, 0) };
    const blocker = { id: 'k', position: new Vector3(0, 0, 5) };
    const target = { id: 't', position: new Vector3(0, 0, 10) };
    const direction = new Vector3(0, 0, 1);
    const sourcePos = new Vector3(0, 0, 0);
    const targetPos = new Vector3(0, 0, 10);

    grid.repopulate([source, blocker, target]);
    expect(
      grid.hasOccluderOnSegment(sourcePos, targetPos, direction, 10, source, target, 0.9),
    ).toBe(true);

    grid.repopulate([source, target]);
    expect(
      grid.hasOccluderOnSegment(sourcePos, targetPos, direction, 10, source, target, 0.9),
    ).toBe(false);
  });

  it('packs distinct cells to distinct keys, including negatives and out-of-range fallback', () => {
    const grid = new SpatialGrid<Item>(1, getPos);
    const pack = (
      grid as unknown as {
        packCellKey(cx: number, cy: number, cz: number): number | string;
      }
    ).packCellKey.bind(grid);

    const inBound: Array<[number, number, number]> = [];
    for (let x = -70; x <= 70; x += 17) {
      for (let y = -70; y <= 70; y += 23) {
        for (let z = -70; z <= 70; z += 31) {
          inBound.push([x, y, z]);
        }
      }
    }
    // Probe the documented bound (|c| < 2^16) and the top-of-radix digit:
    // cx = 65535 biases to 131071 = KEY_BASE - 1.
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          inBound.push([sx * 65535, sy * 65535, sz * 65535]);
        }
      }
    }
    inBound.push(
      [65535, 0, 0],
      [-65535, 0, 0],
      [0, 65535, 0],
      [0, -65535, 0],
      [0, 0, 65535],
      [0, 0, -65535],
      [65535, 65534, 65533],
      [-65535, 65534, -65533],
      [65534, -65535, 65535],
      [0, 0, 0],
    );

    // Out-of-bound triples (|c| >= 2^16) must use the string fallback and can
    // never collide with an in-bound numeric key.
    const outOfBound: Array<[number, number, number]> = [
      [65536, 0, 0],
      [-65536, 0, 0],
      [0, 65536, 0],
      [0, -65536, 0],
      [0, 0, 65536],
      [0, 0, -65536],
      [65536, 65535, 65535],
      [70000, 0, 0],
      [70000, 0, 1],
      [0, -70000, 0],
      [0, 0, 131072],
    ];

    const keys = new Set<string>();
    let maxKey = -Infinity;
    for (const [x, y, z] of [...inBound, ...outOfBound]) {
      const key = pack(x, y, z);
      const tagged = `${typeof key}:${key}`;
      expect(keys.has(tagged)).toBe(false);
      keys.add(tagged);
      if (typeof key === 'number') maxKey = Math.max(maxKey, key);
    }
    expect(keys.size).toBe(inBound.length + outOfBound.length);

    // The top-of-radix triple pins the exact packing: KEY_BASE^3 - 1 = 2^51 - 1.
    expect(pack(65535, 65535, 65535)).toBe(2 ** 51 - 1);
    // A wider radix (e.g. the brief's 2^18) would overflow the safe integer
    // range here and start merging distinct cells.
    expect(maxKey).toBe(2 ** 51 - 1);
    expect(maxKey).toBeLessThan(Number.MAX_SAFE_INTEGER);

    // Numeric/string boundary pair: 65535 is in-bound, 65536 is not.
    expect(typeof pack(65535, 0, 0)).toBe('number');
    expect(typeof pack(65536, 0, 0)).toBe('string');
    expect(typeof pack(1, 2, 3)).toBe('number');
    expect(typeof pack(0, 0, 0)).toBe('number');
    expect(typeof pack(-1, -2, -3)).toBe('number');
    expect(typeof pack(70000, 0, 0)).toBe('string');
    expect(typeof pack(0, -70000, 0)).toBe('string');
  });

  it('queryNearest matches a brute-force nearest, resolving exact ties by rank', () => {
    interface RankedItem extends Item {
      rank: number;
    }

    const grid = new SpatialGrid<RankedItem>(5, getPos);
    const rank = (item: RankedItem): number => item.rank;
    const isCandidate = (item: RankedItem): boolean => !item.id.startsWith('x');

    const items: RankedItem[] = [
      { id: 'x0', position: new Vector3(0, 0, 0), rank: 0 },
      { id: 'i1', position: new Vector3(4, 0, 0), rank: 3 },
      { id: 'i2', position: new Vector3(-4, 0, 0), rank: 7 },
      { id: 'i3', position: new Vector3(0, 4, 0), rank: 20 },
      { id: 'i4', position: new Vector3(0, -4, 0), rank: 9 },
      { id: 'i5', position: new Vector3(12, 0, 0), rank: 1 },
      { id: 'i6', position: new Vector3(0, 0, 12), rank: 0 },
      { id: 'i7', position: new Vector3(-12, 0, 0), rank: 4 },
      { id: 'x8', position: new Vector3(-3, 0, 0), rank: 0 },
      { id: 'i9', position: new Vector3(8, 8, 0), rank: 6 },
      { id: 'i10', position: new Vector3(-8, -8, 0), rank: 6 },
    ];
    grid.repopulate(items);

    const bruteNearest = (position: Vector3): RankedItem | null => {
      let best: RankedItem | null = null;
      let bestDistSq = Infinity;
      let bestRank = Infinity;
      for (const item of items) {
        if (!isCandidate(item)) continue;
        const distSq = item.position.distanceToSquared(position);
        const itemRank = rank(item);
        if (distSq < bestDistSq || (distSq === bestDistSq && itemRank < bestRank)) {
          best = item;
          bestDistSq = distSq;
          bestRank = itemRank;
        }
      }
      return best;
    };

    // Exact equal-distance ties (i1/i2/i3/i4 all at distSq 16 from the origin)
    // must be resolved by the smallest rank, even when the tie spans cells.
    expect(grid.queryNearest(new Vector3(0, 0, 0), isCandidate, rank)?.id).toBe('i1');
    // Distance dominates rank: i1 (near, rank 3) beats i5 (far, rank 1).
    expect(bruteNearest(new Vector3(0, 0, 0))?.id).toBe('i1');

    for (let qx = -20; qx <= 20; qx += 5) {
      for (let qy = -10; qy <= 10; qy += 5) {
        for (let qz = -10; qz <= 10; qz += 10) {
          const position = new Vector3(qx, qy, qz);
          const actual = grid.queryNearest(position, isCandidate, rank);
          const expected = bruteNearest(position);
          expect(actual?.id ?? null).toBe(expected?.id ?? null);
        }
      }
    }

    // The excluded item (x8) is nearest to this point; the next candidate wins.
    expect(grid.queryNearest(new Vector3(-3, 0, 0), isCandidate, rank)?.id).toBe('i2');
  });

  it('queryNearest returns null when no item is a candidate', () => {
    const empty = new SpatialGrid<Item>(5, getPos);
    expect(
      empty.queryNearest(
        new Vector3(0, 0, 0),
        () => true,
        () => 0,
      ),
    ).toBeNull();

    const grid = new SpatialGrid<Item>(5, getPos);
    grid.repopulate([{ id: 'a', position: new Vector3(1, 1, 1) }]);
    expect(
      grid.queryNearest(
        new Vector3(0, 0, 0),
        () => false,
        () => 0,
      ),
    ).toBeNull();
  });

  it('keeps query and queryBroad iteration order unchanged', () => {
    const grid = new SpatialGrid<Item>(5, getPos);
    const a = { id: 'a', position: new Vector3(0, 0, 0) };
    const b = { id: 'b', position: new Vector3(6, 0, 0) };
    const c = { id: 'c', position: new Vector3(-6, 0, 0) };
    const d = { id: 'd', position: new Vector3(0, 6, 0) };
    grid.repopulate([a, b, c, d]);

    const centre = new Vector3(0, 0, 0);
    const order = grid.query(centre, 10).map((item) => item.id);
    // Deterministic dx/dy/dz cell scan: c (x=-2), a (origin), d (y=+1), b (x=+1).
    expect(order).toEqual(['c', 'a', 'd', 'b']);
    expect(grid.query(centre, 10).map((item) => item.id)).toEqual(order);

    // The broad query takes the full-scan fallback, so it follows Map insertion order.
    expect(grid.queryBroad(centre, 1000).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
