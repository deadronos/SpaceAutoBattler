import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { validateInstancedMesh, traceVisibility } from '../../src/renderer/instancingValidator.js';

describe('instancingValidator', () => {
  it('warns when instanceMatrix.needsUpdate is false', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    mesh.instanceMatrix.needsUpdate = false;
    const res = validateInstancedMesh(mesh);
    expect(res.warnings.some(w => w.includes('instanceMatrix.needsUpdate'))).toBe(true);
  });

  it('warns on transparent material with zero opacity', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    const res = validateInstancedMesh(mesh);
    expect(res.warnings.some(w => w.includes('transparent with opacity 0'))).toBe(true);
  });

  it('computes missing bounding volumes', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    geom.boundingSphere = null;
    geom.boundingBox = null;
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    const res = validateInstancedMesh(mesh);
    expect(geom.boundingSphere).toBeTruthy();
    expect(geom.boundingBox).toBeTruthy();
    expect(res.warnings.some(w => w.includes('boundingSphere was missing'))).toBe(true);
  });

  it('traces visibility to first invisible ancestor', () => {
    const parent = new THREE.Group();
    parent.visible = false;
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const child = new THREE.Mesh(geom, mat);
    parent.add(child);
    const trace = traceVisibility(child);
    expect(trace.object).toBe(parent);
  });

  it('errors on missing position attribute when fail option set', () => {
    const geom = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    const res = validateInstancedMesh(mesh, { failOnMissingAttributes: true });
    expect(res.errors.some(e => e.includes('position attribute'))).toBe(true);
  });

  it('errors on instanceMatrix length mismatch', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    mesh.instanceMatrix.array = new Float32Array(10);
    const res = validateInstancedMesh(mesh);
    expect(res.errors.some(e => e.includes('length mismatch'))).toBe(true);
  });
});

