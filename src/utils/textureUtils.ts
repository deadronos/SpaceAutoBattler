import type { Texture, WebGLRenderer } from 'three';

export type TextureApplyOptions = {
  colorSpace?: Texture['colorSpace'];
  minFilter?: Texture['minFilter'];
  magFilter?: Texture['magFilter'];
  wrapS?: Texture['wrapS'];
  wrapT?: Texture['wrapT'];
  anisotropy?: number;
  generateMipmaps?: boolean;
  flipY?: boolean;
  needsUpdate?: boolean;
};

/**
 * Apply a standard set of texture settings when values are provided.
 */
export function applyTextureSettings(
  texture: Texture | null | undefined,
  opts?: TextureApplyOptions,
  _gl?: WebGLRenderer,
): void {
  if (!texture) return;

  if (opts?.colorSpace !== undefined) texture.colorSpace = opts.colorSpace;
  if (opts?.minFilter !== undefined) texture.minFilter = opts.minFilter;
  if (opts?.magFilter !== undefined) texture.magFilter = opts.magFilter;
  if (opts?.wrapS !== undefined) texture.wrapS = opts.wrapS;
  if (opts?.wrapT !== undefined) texture.wrapT = opts.wrapT;
  if (opts?.flipY !== undefined) texture.flipY = opts.flipY;
  if (opts?.generateMipmaps !== undefined) texture.generateMipmaps = opts.generateMipmaps;
  if (opts?.anisotropy !== undefined) texture.anisotropy = opts.anisotropy;
  if (opts?.needsUpdate !== undefined) texture.needsUpdate = opts.needsUpdate;
}

/**
 * Compute the maximum anisotropy to apply. If a WebGLRenderer is provided we
 * clamp the requested cap against the renderer's reported max anisotropy.
 * Otherwise we fall back to the provided cap or 16.
 */
export function computeMaxAnisotropy(gl: WebGLRenderer | undefined, cap?: number): number {
  const defaultCap = cap ?? 16;
  if (!gl) return defaultCap;
  try {
    const max = gl.capabilities?.getMaxAnisotropy?.();
    if (typeof max === 'number' && Number.isFinite(max)) {
      return Math.min(defaultCap, max);
    }
  } catch {
    // If querying capabilities fails for any reason, fall back to the cap.
  }
  return defaultCap;
}
