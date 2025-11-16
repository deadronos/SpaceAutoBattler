import { Vector3 } from 'three';
import { buildSpatialHash, querySpatialHash } from '../../src/game/utils/spatialHash.js';

describe('spatial hash', () => {
  it('groups items into cells and queries nearby buckets', () => {
    const items = [
      { id: 'a', position: new Vector3(0, 0, 0) },
      { id: 'b', position: new Vector3(4.9, 0, 0) },
      { id: 'c', position: new Vector3(12, 0, 0) },
      { id: 'd', position: new Vector3(-3, 8, 0) },
    ];

    const hash = buildSpatialHash(items, 5, (item) => item.position);
    const nearby = querySpatialHash(hash, new Vector3(0, 0, 0), 6);

    const ids = nearby.map((item) => item.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('limits results based on radius', () => {
    const items = [
      { id: 'a', position: new Vector3(0, 0, 0) },
      { id: 'b', position: new Vector3(20, 0, 0) },
    ];

    const hash = buildSpatialHash(items, 10, (item) => item.position);
    const nearby = querySpatialHash(hash, new Vector3(0, 0, 0), 5);

    expect(nearby.map((item) => item.id)).toEqual(['a']);
  });
});
