/**
 * Shader utilities and common GLSL code
 *
 * This module provides shared GLSL functions that can be injected
 * into shader source code at runtime via string concatenation.
 */

import commonGLSL from './common.glsl';

/**
 * Common GLSL utility functions shared across multiple shaders.
 *
 * Includes:
 * - snoise(vec3, float): Simplified 3D noise function
 * - hash(float): Simple hash function for float input
 * - hash(vec2): Hash function for vec2 input
 *
 * Usage: Prepend to shader source code via string concatenation:
 * ```typescript
 * const shaderSource = COMMON_GLSL + '\n' + originalShaderCode;
 * ```
 */
export const COMMON_GLSL = commonGLSL;
