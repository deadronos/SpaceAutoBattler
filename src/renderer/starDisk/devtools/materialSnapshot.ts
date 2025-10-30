import { Texture } from 'three';
import type { ShaderMaterial } from 'three';
import { getStarDebugWindow } from './debugWindow.js';

type UniformRecord = Record<string, unknown>;

type UniformWithValue = { value?: unknown };

const serializeUniformValue = (value: unknown): unknown => {
  if (value == null) return null;
  const type = typeof value;
  if (type === 'number' || type === 'string' || type === 'boolean') {
    return value;
  }

  const maybeArray = value as { toArray?: () => unknown };
  if (maybeArray && typeof maybeArray.toArray === 'function') {
    try {
      return maybeArray.toArray.call(value);
    } catch {
      return String(value);
    }
  }

  if (value instanceof Texture) {
    const image = (value as { image?: { width?: number; height?: number } }).image || null;
    return {
      name: value.name,
      uuid: value.uuid,
      wrapS: value.wrapS,
      wrapT: value.wrapT,
      wrapR: (value as { wrapR?: unknown }).wrapR,
      minFilter: value.minFilter,
      magFilter: value.magFilter,
      anisotropy: value.anisotropy,
      format: value.format,
      type: value.type,
      colorSpace: value.colorSpace,
      image,
    };
  }

  return String(value);
};

const collectUniforms = (material: ShaderMaterial): UniformRecord => {
  const map: UniformRecord = {};
  try {
    const uniforms = material.uniforms as unknown as Record<string, UniformWithValue>;
    for (const key of Object.keys(uniforms ?? {})) {
      const entry = uniforms[key];
      map[key] = serializeUniformValue(entry?.value);
    }
  } catch {
    // Ignore snapshot failures; dev-only helper
  }
  return map;
};

export const recordMaterialSnapshot = (material: ShaderMaterial): void => {
  const win = getStarDebugWindow();
  if (!win) return;
  win.__copilot_starUniforms = win.__copilot_starUniforms || [];
  const snapshot = {
    time: Date.now(),
    name: material.name,
    uuid: material.uuid,
    uniforms: collectUniforms(material),
  };
  try {
    win.__copilot_starUniforms.push(snapshot);
  } catch {
    // ignore push failures
  }
};
