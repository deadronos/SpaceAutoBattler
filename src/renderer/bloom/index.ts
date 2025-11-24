/**
 * Bloom System — Public API
 *
 * This module provides selective bloom rendering for Three.js/React Three Fiber applications.
 * It manages bloom groups, layer allocation, and material colorWrite states to enable
 * per-object bloom effects without affecting the main render pass.
 *
 * ## Usage
 *
 * ```tsx
 * // Wrap your scene with BloomProvider
 * <BloomProvider enabled={postprocessingEnabled}>
 *   <Scene />
 * </BloomProvider>
 *
 * // Register objects for bloom using the hook
 * function GlowingObject() {
 *   const ref = useRef<Mesh>(null);
 *   useBloomRegistration(ref, { group: 'engines' });
 *   return <mesh ref={ref}>...</mesh>;
 * }
 *
 * // Or use the context directly for programmatic control
 * function DynamicBloom() {
 *   const ctx = useBloomContext();
 *   useEffect(() => {
 *     if (ctx && meshRef.current) {
 *       ctx.register(meshRef.current, { group: 'explosions' });
 *       return () => ctx.unregister(meshRef.current);
 *     }
 *   }, [ctx]);
 * }
 * ```
 *
 * ## Architecture
 *
 * The bloom system consists of several internal modules:
 * - `constants.ts` - Layer allocation constants and userData keys
 * - `types.ts` - TypeScript interfaces for the public API
 * - `layerAllocator.ts` - Layer index management (layers 11-31 by default)
 * - `selectionManager.ts` - Postprocessing Selection object management
 * - `layerMaskManager.ts` - Three.js layer mask save/restore
 * - `materialManager.ts` - Material colorWrite state management
 *
 * @module bloom
 */

// Public API exports
export { BloomProvider, useBloomContext, useBloomRegistration } from './BloomProvider.js';

// Type exports
export type { BloomRegistrationOptions, BloomContextValue } from './types.js';
