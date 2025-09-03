import * as THREE from 'three';

export interface ValidatorOptions {
  minScale?: number;
  maxScale?: number;
  warnOnUnlit?: boolean;
  positionThreshold?: number;
  scene?: THREE.Scene;
  failOnMissingAttributes?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
  details?: Record<string, any>;
}

export function validateInstancedMesh(mesh: THREE.InstancedMesh, options: ValidatorOptions = {}): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const details: Record<string, any> = {};

  // R1: matrix updates
  if (mesh.count > 0 && !mesh.instanceMatrix.needsUpdate) {
    warnings.push('instanceMatrix.needsUpdate is false; instance matrices may not upload to GPU');
  }

  // R2: material validation
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((mat, idx) => {
    const m: any = mat;
    if (m.transparent && m.opacity === 0) {
      warnings.push(`material[${idx}] transparent with opacity 0`);
    }
    if (m.transparent && m.depthWrite === false) {
      warnings.push(`material[${idx}] transparent with depthWrite=false`);
    }
  });

  // R3: geometry bounding / frustum culling
  const geom = mesh.geometry;
  if (!geom.boundingSphere) {
    geom.computeBoundingSphere();
    warnings.push('geometry.boundingSphere was missing and has been computed');
  }
  if (!geom.boundingBox) {
    geom.computeBoundingBox();
    warnings.push('geometry.boundingBox was missing and has been computed');
  }

  // R4/R5: scale and position validation
  if (options.minScale !== undefined || options.maxScale !== undefined || options.positionThreshold !== undefined) {
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      matrix.decompose(pos, new THREE.Quaternion(), scale);
      if (options.minScale !== undefined && scale.x < options.minScale) {
        warnings.push(`instance ${i} scale ${scale.x} below minScale ${options.minScale}`);
        break;
      }
      if (options.maxScale !== undefined && scale.x > options.maxScale) {
        warnings.push(`instance ${i} scale ${scale.x} above maxScale ${options.maxScale}`);
        break;
      }
      if (options.positionThreshold !== undefined && pos.length() > options.positionThreshold) {
        warnings.push(`instance ${i} position magnitude ${pos.length()} exceeds threshold ${options.positionThreshold}`);
        break;
      }
    }
  }

  // R6: lighting validation
  if (options.warnOnUnlit) {
    const needsLight = materials.some(m => !(m instanceof THREE.MeshBasicMaterial));
    if (needsLight) {
      const scene = options.scene ?? mesh.parent;
      let hasLight = false;
      scene?.traverse(obj => { if ((obj as THREE.Light).isLight) hasLight = true; });
      if (!hasLight) warnings.push('mesh uses lighting-dependent material but no lights found in scene');
    }
  }

  // R9: geometry attribute validation
  const posAttr = geom.getAttribute('position');
  if (!posAttr || posAttr.count === 0) {
    const msg = 'geometry missing position attribute or has zero size';
    if (options.failOnMissingAttributes) errors.push(msg); else warnings.push(msg);
  }

  // R10: worker transfer validation
  const arr = mesh.instanceMatrix.array;
  if (!(arr instanceof Float32Array)) {
    errors.push('instanceMatrix.array is not Float32Array');
  } else if (arr.length !== 16 * mesh.count) {
    errors.push('instanceMatrix array length mismatch with instance count');
  } else {
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { ok: errors.length === 0, warnings, errors, details };
}

export function enableDebugOverlay(_enabled: boolean): void {
  // Stub for optional debug overlay
}

export interface TraceResult {
  object: THREE.Object3D | null;
  path: string[];
}

export function traceVisibility(object: THREE.Object3D): TraceResult {
  const path: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    path.push(current.name || current.type);
    if (!current.visible) {
      return { object: current, path };
    }
    current = current.parent;
  }
  return { object: null, path };
}

