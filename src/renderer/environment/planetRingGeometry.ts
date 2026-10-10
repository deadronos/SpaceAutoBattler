import { ExtrudeGeometry, Shape } from 'three';

/**
 * Builds the extruded ring geometry (a circle with a concentric hole) used by
 * `PlanetRings`.
 *
 * @param {number} innerRadius - Inner radius of the ring.
 * @param {number} outerRadius - Outer radius of the ring.
 * @param {number} segments - Approximate segment count (controls curve detail).
 * @returns {ExtrudeGeometry}
 */
export function createPlanetRingGeometry(
  innerRadius: number,
  outerRadius: number,
  segments: number,
): ExtrudeGeometry {
  const inner = new Shape();
  inner.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);

  // Use the outer shape and add the inner as a hole.
  const ringShape = new Shape();
  ringShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  ringShape.holes = [inner];

  const thickness = Math.max((outerRadius - innerRadius) * 0.005, 0.01);

  const extrudeSettings = {
    depth: thickness,
    steps: 1,
    bevelEnabled: false,
    curveSegments: Math.max(8, Math.floor(segments / 8)),
  } as const;

  return new ExtrudeGeometry(ringShape, extrudeSettings);
}
