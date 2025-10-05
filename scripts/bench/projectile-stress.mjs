#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const BULLET_TYPES = ['bullet:laser', 'bullet:plasma', 'bullet:ion', 'bullet:heavy'];

class JsInstanceAllocator {
  constructor(capacity) {
    if (capacity <= 0) throw new Error('capacity must be positive');
    this.capacity = capacity;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i -= 1) {
      this.free.push(i);
    }
    this.map = new Map();
    this.active = new Set();
    this.saturated = false;
  }

  beginFrame() {
    this.active.clear();
    this.saturated = false;
  }

  allocate(key) {
    if (this.map.has(key)) {
      const index = this.map.get(key);
      this.active.add(key);
      return index;
    }
    if (this.free.length === 0) {
      this.saturated = true;
      return null;
    }
    const index = this.free.pop();
    this.map.set(key, index);
    this.active.add(key);
    return index;
  }

  endFrame() {
    for (const [key, index] of this.map) {
      if (!this.active.has(key)) {
        this.map.delete(key);
        insertFreeIndex(this.free, index);
      }
    }
  }
}

function insertFreeIndex(free, index) {
  let lo = 0;
  let hi = free.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (free[mid] > index) lo = mid + 1;
    else hi = mid;
  }
  free.splice(lo, 0, index);
}

function buildProjectiles(count) {
  const projectiles = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const type = BULLET_TYPES[i % BULLET_TYPES.length];
    projectiles[i] = { id: i, type };
  }
  return projectiles;
}

function runLegacy(projectiles, iterations) {
  const start = performance.now();
  let checksum = 0;
  for (let iter = 0; iter < iterations; iter += 1) {
    for (const projectile of projectiles) {
      checksum += projectile.id;
    }
  }
  const end = performance.now();
  return { msPerFrame: (end - start) / iterations, checksum };
}

function runInstanced(projectiles, iterations) {
  const groups = new Map();
  for (const type of BULLET_TYPES) {
    const capacity = Math.ceil(projectiles.length / BULLET_TYPES.length) + 64;
    groups.set(type, new JsInstanceAllocator(capacity));
  }
  const start = performance.now();
  let checksum = 0;
  for (let iter = 0; iter < iterations; iter += 1) {
    for (const allocator of groups.values()) allocator.beginFrame();
    for (const projectile of projectiles) {
      const allocator = groups.get(projectile.type);
      const index = allocator.allocate(projectile.id);
      if (index != null) checksum += index;
    }
    for (const allocator of groups.values()) allocator.endFrame();
  }
  const end = performance.now();
  return {
    msPerFrame: (end - start) / iterations,
    checksum,
    saturated: Array.from(groups.values()).some((allocator) => allocator.saturated),
  };
}

function format(number) {
  return number.toFixed(3).padStart(8, ' ');
}

function run() {
  const counts = [1000, 5000, 10000];
  const iterations = 120;
  console.log('Projectile Instancing Stress Harness');
  console.log('===================================');
  console.log('count | groups | legacy draw | instanced draw | legacy ms | instanced ms | saturated');
  for (const count of counts) {
    const projectiles = buildProjectiles(count);
    const legacy = runLegacy(projectiles, iterations);
    const instanced = runInstanced(projectiles, iterations);
    const groups = new Set(projectiles.map((p) => p.type)).size;
    const legacyDrawCalls = count;
    const instancedDrawCalls = groups;
    const row = [
      count.toString().padStart(5, ' '),
      groups.toString().padStart(6, ' '),
      legacyDrawCalls.toString().padStart(12, ' '),
      instancedDrawCalls.toString().padStart(15, ' '),
      format(legacy.msPerFrame),
      format(instanced.msPerFrame),
      instanced.saturated ? '   yes' : '    no',
    ];
    console.log(row.join(' | '));
  }
}

run();
