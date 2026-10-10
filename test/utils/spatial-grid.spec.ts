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
});
