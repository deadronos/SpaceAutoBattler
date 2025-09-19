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
    expect(res.warnings.some((w) => w.includes('instanceMatrix.needsUpdate'))).toBe(true);
  });

  it('warns on transparent material with zero opacity', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    const res = validateInstancedMesh(mesh);
    expect(res.warnings.some((w) => w.includes('transparent with opacity 0'))).toBe(true);
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
    expect(res.warnings.some((w) => w.includes('boundingSphere was missing'))).toBe(true);
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
    expect(res.errors.some((e) => e.includes('position attribute'))).toBe(true);
  });

  it('errors on instanceMatrix length mismatch', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    mesh.instanceMatrix.array = new Float32Array(10);
    const res = validateInstancedMesh(mesh);
    // length 10 is not a multiple of 16, expect specific message
    expect(
      res.errors.some((e) => e.includes('multiple of 16') || e.includes('length mismatch')),
    ).toBe(true);
  });

  it('errors on zero-length (detached) instanceMatrix array', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    mesh.instanceMatrix.array = new Float32Array(0);
    const res = validateInstancedMesh(mesh);
    expect(res.errors.some((e) => e.includes('empty or detached'))).toBe(true);
  });

  it('warns when material requests vertex colors but no instanceColor or color attribute present', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial();
    // set vertexColors flag to simulate a material that expects per-vertex colors
    (mat as unknown as { vertexColors?: boolean }).vertexColors = true;
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    const res = validateInstancedMesh(mesh);
    expect(res.warnings.some((w) => w.includes('vertexColors'))).toBe(true);
  });

  it('warns or errors when lighting material is used but normals are missing', () => {
    const geom = new THREE.BufferGeometry();
    // intentionally omit normals
    geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geom, mat, 1);
    const res = validateInstancedMesh(mesh, { failOnMissingAttributes: false });
    expect(
      res.warnings.some((w) => w.includes('normal')) ||
        res.errors.some((e) => e.includes('normal')),
    ).toBe(true);
  });
});
