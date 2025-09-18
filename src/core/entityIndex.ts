import { World } from 'miniplex';

export type EntityRef = {
  id: number;
  x: number;
  y: number;
  z: number;
  team?: string;
  type?: string;
  radius?: number;
};

// Simple deterministic 3D uniform grid for partitioning space
export class UniformGrid {
  bucketSize: number;
  buckets: Map<string, Set<number>>;
  positions: Map<number, [number, number, number]>;

  constructor(bucketSize = 50) {
    this.bucketSize = bucketSize;
    this.buckets = new Map();
    this.positions = new Map();
  }

  private keyFor(x: number, y: number, z: number) {
    const xi = Math.floor(x / this.bucketSize);
    const yi = Math.floor(y / this.bucketSize);
    const zi = Math.floor(z / this.bucketSize);
    return `${xi},${yi},${zi}`;
  }

  add(id: number, x: number, y: number, z: number) {
    const key = this.keyFor(x, y, z);
    let set = this.buckets.get(key);
    if (!set) {
      set = new Set();
      this.buckets.set(key, set);
    }
    set.add(id);
    this.positions.set(id, [x, y, z]);
  }

  remove(id: number) {
    const pos = this.positions.get(id);
    if (!pos) return;
    const key = this.keyFor(pos[0], pos[1], pos[2]);
    const set = this.buckets.get(key);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.buckets.delete(key);
    }
    this.positions.delete(id);
  }

  update(id: number, x: number, y: number, z: number) {
    const old = this.positions.get(id);
    if (!old) {
      this.add(id, x, y, z);
      return;
    }
    const oldKey = this.keyFor(old[0], old[1], old[2]);
    const newKey = this.keyFor(x, y, z);
    if (oldKey !== newKey) {
      const set = this.buckets.get(oldKey);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.buckets.delete(oldKey);
      }
      let newSet = this.buckets.get(newKey);
      if (!newSet) {
        newSet = new Set();
        this.buckets.set(newKey, newSet);
      }
      newSet.add(id);
    }
    this.positions.set(id, [x, y, z]);
  }

  queryCandidates(x: number, y: number, z: number, radius: number) {
    const minX = Math.floor((x - radius) / this.bucketSize);
    const maxX = Math.floor((x + radius) / this.bucketSize);
    const minY = Math.floor((y - radius) / this.bucketSize);
    const maxY = Math.floor((y + radius) / this.bucketSize);
    const minZ = Math.floor((z - radius) / this.bucketSize);
    const maxZ = Math.floor((z + radius) / this.bucketSize);

    const result = new Set<number>();
    for (let xi = minX; xi <= maxX; xi++) {
      for (let yi = minY; yi <= maxY; yi++) {
        for (let zi = minZ; zi <= maxZ; zi++) {
          const key = `${xi},${yi},${zi}`;
          const set = this.buckets.get(key);
          if (set) for (const id of set) result.add(id);
        }
      }
    }
    return Array.from(result).sort((a, b) => a - b);
  }
}

export type EntityIndexAPI = {
  world: World<EntityRef>;
  grid: UniformGrid;
  add: (e: EntityRef) => void;
  update: (e: EntityRef) => void;
  remove: (id: number) => void;
  queryNeighbors: (
    x: number,
    y: number,
    z: number,
    radius: number,
    opts?: { team?: string; maxResults?: number; filter?: (e: EntityRef) => boolean },
  ) => EntityRef[];
  queryBulkRadius?: (
    positions: Float32Array,
    radius: number,
    team?: string,
    excludeIds?: Set<number>,
    out?: Uint32Array,
  ) => { ids: Uint32Array; counts: Uint32Array };
};

export function initEntityIndex(bucketSize = 50): EntityIndexAPI {
  const world = new World<EntityRef>({ entities: [] });
  const grid = new UniformGrid(bucketSize);
  const byId = new Map<number, ReturnType<World<EntityRef>['createEntity']>>();

  function add(e: EntityRef) {
    const reg = world.createEntity(Object.assign({}, e));
    // keep a quick map by our entity id (not miniplex internal id)
    byId.set(e.id, reg);
    grid.add(e.id, e.x, e.y, e.z);
  }

  function update(e: EntityRef) {
    const reg = byId.get(e.id);
    if (reg) {
      // mutate registered entity inplace so world.entities sees changes
      reg.x = e.x;
      reg.y = e.y;
      reg.z = e.z;
      reg.team = e.team;
      reg.type = e.type;
      reg.radius = e.radius;
    }
    grid.update(e.id, e.x, e.y, e.z);
  }

  function remove(id: number) {
    const reg = byId.get(id);
    if (reg) {
      world.destroyEntity(reg);
      byId.delete(id);
    }
    grid.remove(id);
  }

  function queryNeighbors(
    x: number,
    y: number,
    z: number,
    radius: number,
    opts?: { team?: string; maxResults?: number; filter?: (e: EntityRef) => boolean },
  ) {
    const candidates = grid.queryCandidates(x, y, z, radius);
    const rad2 = radius * radius;
    const out: EntityRef[] = [];
    for (const id of candidates) {
      const e = byId.get(id);
      if (!e) continue;
      const dx = e.x - x,
        dy = e.y - y,
        dz = e.z - z;
      if (dx * dx + dy * dy + dz * dz > rad2) continue;
      if (opts?.team && e.team !== opts.team) continue;
      if (opts?.filter && !opts.filter(e)) continue;
      out.push(e);
      if (opts?.maxResults && out.length >= opts.maxResults) break;
    }
    return out;
  }

  function queryBulkRadius(
    positions: Float32Array,
    radius: number,
    team?: string,
    excludeIds?: Set<number>,
    out?: Uint32Array,
  ) {
    const positionCount = Math.floor(positions.length / 3);
    const idsTemp: number[] = [];
    const counts = new Uint32Array(positionCount);

    for (let i = 0; i < positionCount; i++) {
      const base = i * 3;
      const x = positions[base];
      const y = positions[base + 1];
      const z = positions[base + 2];
      const candidates = grid.queryCandidates(x, y, z, radius);
      let added = 0;
      for (const id of candidates) {
        if (excludeIds && excludeIds.has(id)) continue;
        const e = byId.get(id);
        if (!e) continue;
        if (team && e.team !== team) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        const dz = e.z - z;
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        idsTemp.push(id);
        added++;
      }
      counts[i] = added;
    }

    const ids = out && out.length >= idsTemp.length ? out : new Uint32Array(idsTemp.length);
    for (let i = 0; i < idsTemp.length; i++) ids[i] = idsTemp[i];
    return { ids: idsTemp.length === ids.length ? ids : ids.subarray(0, idsTemp.length), counts };
  }

  return { world, grid, add, update, remove, queryNeighbors, queryBulkRadius };
}

