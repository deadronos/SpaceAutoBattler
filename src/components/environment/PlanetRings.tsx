import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Color, RingGeometry, ShaderMaterial, DoubleSide, AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';
import { colorFromConfig } from '../../utils/color.js';
import { RENDER_ORDER_TRANSLUCENT_ADDITIVE } from '../../renderer/sceneLayerOrder.js';

interface PlanetRingsProps {
  /** Inner radius of the rings */
  innerRadius: number;
  /** Outer radius of the rings */
  outerRadius: number;
  /** Ring color */
  color?: string;
  /** Ring opacity */
  opacity?: number;
  /** Number of ring segments */
  segments?: number;
  /** Rotation speed in radians per second */
  rotationSpeed?: number;
  /** Enable/disable the rings */
  enabled?: boolean;
}

export function PlanetRings({
  innerRadius,
  outerRadius,
  color = '#ccaa88',
  opacity = 0.6,
  segments = 128,
  rotationSpeed = 0.001,
  enabled = true,
}: PlanetRingsProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => {
    return new RingGeometry(innerRadius, outerRadius, segments, 1);
  }, [innerRadius, outerRadius, segments]);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uColor: { value: colorFromConfig(color) },
        uOpacity: { value: opacity },
        uInnerRadius: { value: innerRadius },
        uOuterRadius: { value: outerRadius },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vRadius;
        // Declare uniforms used in the vertex shader
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        void main() {
          vUv = uv;
          // Compute normalized radius from object-space position instead of UVs.
          // UVs on RingGeometry contain a seam (U jumps from 1->0) which can
          // produce abrupt discontinuities in distance-based patterns and lead
          // to wedge-shaped artifacts when the ring overlays other transparent
          // billboards (like the StarDisk). Using the vertex position avoids
          // the seam and yields a smoothly varying radius across the ring.
          float localRadius = length(position.xy);
          // Normalize localRadius into [0,1] using the provided inner/outer radii.
          vRadius = clamp((localRadius - uInnerRadius) / max((uOuterRadius - uInnerRadius), 1e-6), 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        varying vec2 vUv;
        varying float vRadius;

        void main() {
          // vRadius is now a normalized [0,1] radius computed from object-space
          // position which avoids UV seam discontinuities.
          float normalizedRadius = vRadius;

          // Base alpha shaped as a bell around the middle of the ring
          float alpha = 1.0 - abs(normalizedRadius - 0.5) * 2.0;
          // Use monotonic smoothstep ranges (edge0 < edge1)
          alpha = smoothstep(0.0, 0.4, alpha) * smoothstep(0.6, 1.0, alpha);

          // Fine ringing pattern (radial). Keep this gentle so it doesn't create
          // high-contrast masks that exacerbate blending issues when composited.
          float ringPattern = sin(normalizedRadius * 80.0) * 0.03 + 0.97;
          alpha *= ringPattern;

          // Edge fade near inner/outer radii — use ordered edges
          float edgeFade = smoothstep(0.0, 0.05, normalizedRadius) * smoothstep(0.95, 1.0, normalizedRadius);
          alpha *= edgeFade;

          // Ensure a small alpha floor so the ring remains visible and
          // does not get completely discarded by the compositor. This
          // reduces the chance the ring vanishes due to tiny numerical
          // alpha values while still letting the edges fade gracefully.
          alpha = max(alpha, 0.02);
          gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      // Use additive blending so the ring contributes light instead of darkening
      // underlying surfaces. This avoids the ring making planets look "transparent"
      // where they overlap with soft halo fragments.
      blending: AdditiveBlending,
    });
  }, [color, opacity, innerRadius, outerRadius]);

  // Attach debug helpers once the material exists so we can adjust uniforms
  // and render order from the console during interactive debugging.
  try {
    if (typeof window !== 'undefined' && /[?&]copilot_debug=1/.test(window.location.search)) {
      try {
        // Use a lightweight effect-like attachment without requiring React's useEffect
        (window as any).__copilot_ringMaterial = material;
        (window as any).__copilot_setRingOpacity = (v: any) => {
          try {
            const n = Number(v);
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            material.uniforms.uOpacity.value = Math.max(0, Math.min(n, 1));
            try { (material as any).needsUpdate = true; } catch { /* ignore */ }
            return { set: true, value: material.uniforms.uOpacity.value };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
        (window as any).__copilot_setRingRenderOrder = (v: any) => {
          try {
            const n = Number(v);
            if (!meshRef.current) return { set: false, reason: 'no-mesh' };
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            meshRef.current.renderOrder = Math.floor(n);
            return { set: true, value: meshRef.current.renderOrder };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
      } catch {
        /* swallow debug attach errors */
      }
    }
  } catch {
    /* swallow host environment errors */
  }

  useFrame((_, delta) => {
    if (meshRef.current && rotationSpeed !== 0) {
      meshRef.current.rotation.z += rotationSpeed * delta;
    }
  });

  if (!enabled) return null;

  // Rings use additive blending and translucent layer ordering to render after
  // opaque geometry (planets, star cores) while respecting depth occlusion.
  return <mesh ref={meshRef} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} renderOrder={RENDER_ORDER_TRANSLUCENT_ADDITIVE} />;
}

export default PlanetRings;