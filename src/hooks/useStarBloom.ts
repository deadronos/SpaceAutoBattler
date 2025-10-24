/**
 * Star disk bloom registration hook
 *
 * Simple wrapper around useBloomRegistration to register the star disk mesh
 * with the bloom effect system.
 */

import type { RefObject } from 'react';
import type { Mesh, ShaderMaterial } from 'three';
import { useBloomRegistration } from '../renderer/BloomProvider.js';

/**
 * Register the star disk mesh with the bloom effect system.
 *
 * @param meshRef - Reference to the star disk mesh (can be null)
 * @param enabled - Whether the star disk is enabled
 * @param shaderMaterial - The shader material (or null if using fallback)
 */
export function useStarBloom(
  meshRef: RefObject<Mesh | null>,
  enabled: boolean,
  shaderMaterial: ShaderMaterial | null,
): void {
  useBloomRegistration(meshRef as RefObject<Mesh>, {
    group: 'star',
    active: enabled && Boolean(shaderMaterial),
  });
}
