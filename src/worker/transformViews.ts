import type { TransformSoAViews } from './transformsLayout.js';

/**
 * Copies every transform field from `src` into `dst` (assumed same layout).
 *
 * @param {TransformSoAViews} src - Source views.
 * @param {TransformSoAViews} dst - Destination views.
 */
export function copyTransformViews(src: TransformSoAViews, dst: TransformSoAViews): void {
  dst.positions.set(src.positions);
  dst.rotations.set(src.rotations);
  dst.scales.set(src.scales);
  dst.shipHp.set(src.shipHp);
  dst.shipShield.set(src.shipShield);
  dst.shipThrust.set(src.shipThrust);
}
