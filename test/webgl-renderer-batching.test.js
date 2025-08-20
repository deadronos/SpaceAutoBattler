import { computeShipBatchRanges } from '../src/webglRenderer.js';

function makeShip(type = 'corvette', team = 0, alive = true, radius = 8) {
  return { type, team, alive, radius };
}

describe('computeShipBatchRanges', () => {
  test('no ships -> no groups', () => {
    const out = computeShipBatchRanges([], null, 1, false);
    expect(out).toHaveLength(0);
  });

  test('small group under 65535 vertices', () => {
    const ships = [];
    for (let i = 0; i < 100; i++) ships.push(makeShip('corvette', 0));
    const atlasAccessor = (type) => ({ canvas: { id: 'atlas1' }, size: 64, baseRadius: 16 });
    const out = computeShipBatchRanges(ships, atlasAccessor, 1, false);
    expect(out.length).toBeGreaterThanOrEqual(1);
    const first = out[0];
    expect(first.totalQuads).toBe(100);
    expect(first.totalVertices).toBe(400);
    expect(first.ranges.length).toBe(1);
  });

  test('just over 65535 vertex limit splits', () => {
    // 65536 vertices -> 16384 quads (16384*4 = 65536). We'll create 16384+1 quads to exceed.
    const quads = 16384 + 1;
    const ships = [];
    for (let i = 0; i < quads; i++) ships.push(makeShip('corvette', 1));
    const atlasAccessor = (type) => ({ canvas: { id: 'atlas2' }, size: 64, baseRadius: 16 });
    const out = computeShipBatchRanges(ships, atlasAccessor, 1, false);
    expect(out.length).toBeGreaterThanOrEqual(1);
    const first = out[0];
    expect(first.totalQuads).toBe(quads);
    // total vertices = quads * 4
    expect(first.totalVertices).toBe(quads * 4);
    // Since Uint16 max is 65535 vertices, ranges must be >1
    expect(first.ranges.length).toBeGreaterThan(1);
    const sum = first.ranges.reduce((s, r) => s + r.count, 0);
    expect(sum).toBe(first.totalVertices);
  });

  test('supports 32-bit -> single range', () => {
    const quads = 200000; // big number
    const ships = [];
    for (let i = 0; i < quads; i++) ships.push(makeShip('carrier', 0));
    const atlasAccessor = (type) => ({ canvas: { id: 'atlas3' }, size: 128, baseRadius: 24 });
    const out = computeShipBatchRanges(ships, atlasAccessor, 1, true);
    expect(out[0].ranges.length).toBe(1);
    expect(out[0].totalVertices).toBe(quads * 4);
  });
});
