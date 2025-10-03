import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Color, Shape, ExtrudeGeometry, ShaderMaterial, DoubleSide, AdditiveBlending, NormalBlending, MeshBasicMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { colorFromConfig } from '../../utils/color.js';
import { RENDER_ORDER_TRANSLUCENT_ADDITIVE } from '../../renderer/sceneLayerOrder.js';
import { useUiStore } from '../../game/uiStore.js';

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
  /** Brightness multiplier for the ring base color */
  brightness?: number;
  /** Fresnel highlight strength (view-dependent) */
  fresnelStrength?: number;
  /** Optional tint color to bias the ring color when postprocessing is off */
  tintColor?: string;
  /** Optional tint mix factor (0..1). When undefined, the renderer chooses a conservative default when postprocessing is off. */
  tintMix?: number;
  /** If true, the ring is intended to be bloom-only (artists opt-in). When true the renderer/bloom manager may route this object's color contributions to the bloom pass and avoid preserving colorWrite. */
  bloomOnly?: boolean;
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
  brightness = 1.4,
  fresnelStrength = 1.2,
  tintColor,
  tintMix,
  bloomOnly = false,
  enabled = true,
}: PlanetRingsProps): React.ReactElement | null {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => {
    // Build a 2D ring shape (circle with a hole) and extrude it to give a small
    // thickness so the rings become real 3D geometry. This avoids some blending
    // and sorting issues and provides a subtle silhouette when lit.
    const outer = new Shape();
    outer.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

    const inner = new Shape();
    inner.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);

    // Use the outer shape and add the inner as a hole
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
  }, [innerRadius, outerRadius, segments]);

  const material = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: colorFromConfig(color) },
        uOpacity: { value: opacity },
        uInnerRadius: { value: innerRadius },
        uOuterRadius: { value: outerRadius },
        // Fresnel-like highlight strength (view-dependent)
        uFresnelStrength: { value: fresnelStrength },
        // Brightness multiplier for base color
        uBrightness: { value: brightness },
        // Optional tint to ensure visibility when postprocessing is off
        uTintColor: { value: colorFromConfig(tintColor ?? '#d9efff') },
        uTintMix: { value: typeof tintMix === 'number' ? tintMix : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vRadius;
        varying vec3 vNormal;
        varying vec3 vPosView;
        // Declare uniforms used in the vertex shader
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        void main() {
          vUv = uv;
          // Compute normalized radius from object-space position instead of UVs.
          float localRadius = length(position.xy);
          vRadius = clamp((localRadius - uInnerRadius) / max((uOuterRadius - uInnerRadius), 1e-6), 0.0, 1.0);

          // Provide transformed normal and view-space position for fresnel calc
          vNormal = normalize(normalMatrix * normal);
          vPosView = (modelViewMatrix * vec4(position, 1.0)).xyz;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        uniform float uFresnelStrength;
        uniform float uBrightness;
        // Declare tint uniforms used below
        uniform vec3 uTintColor;
        uniform float uTintMix;

        varying vec2 vUv;
        varying float vRadius;
        varying vec3 vNormal;
        varying vec3 vPosView;

        void main() {
          float normalizedRadius = vRadius;

          // Base alpha shaped as a bell around the middle of the ring
          float alpha = 1.0 - abs(normalizedRadius - 0.5) * 2.0;
          alpha = smoothstep(0.0, 0.4, alpha) * smoothstep(0.6, 1.0, alpha);

          // Gentle radial texturing
          float ringPattern = sin(normalizedRadius * 80.0) * 0.03 + 0.97;
          alpha *= ringPattern;

          // Edge fade near inner/outer radii
          float edgeFade = smoothstep(0.0, 0.05, normalizedRadius) * smoothstep(0.95, 1.0, normalizedRadius);
          alpha *= edgeFade;

          // Fresnel / view-dependent highlight to simulate icy reflectivity
          vec3 n = normalize(vNormal);
          vec3 viewDir = normalize(-vPosView);
          float fresnel = pow(1.0 - max(0.0, dot(n, viewDir)), 3.0);
          float highlight = fresnel * uFresnelStrength;

          // Apply brightness and mix a small amount of white for specular-ish tint
          vec3 base = uColor * uBrightness;
          vec3 specular = mix(base, vec3(1.0), clamp(highlight * 0.7, 0.0, 1.0));

          // Ensure a larger alpha floor so the ring remains visible even
          // when bloom/postprocessing is disabled. Add fresnel contribution
          // to brighten the rim further.
          alpha = max(alpha, 0.08) + highlight * 0.2;

          // Mix in a tint color to push the ring toward blue-white when
          // postprocessing is disabled or artist requested.
          vec3 finalBase = mix(base, uTintColor, clamp(uTintMix, 0.0, 1.0));

          gl_FragColor = vec4(finalBase, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending: AdditiveBlending,
    });

    try {
      // Ensure this material writes to the main color buffer by default when
      // bloomOnly is not requested. If bloomOnly is true the material will
      // intentionally allow the BloomProvider to toggle colorWrite in order
      // to render the object primarily via bloom.
      (mat as any).colorWrite = true;
      if (!(mat as any).userData) (mat as any).userData = {};
      // forceColorWrite true means "do not let the bloom manager disable
      // colorWrite". We set it to the inverse of bloomOnly so artists can
      // opt-in to bloom-only elements.
      (mat as any).userData.__copilot_forceColorWrite = !(bloomOnly === true);
      // Also expose an explicit bloomOnly flag for clarity/debugging.
      (mat as any).userData.__copilot_bloomOnly = Boolean(bloomOnly === true);
    } catch {
      /* ignore host environment errors */
    }

    return mat;
  }, [color, opacity, innerRadius, outerRadius, brightness, fresnelStrength, tintColor, tintMix, bloomOnly]);

  const basicMaterial = useMemo(() => {
    const color = colorFromConfig(tintColor ?? '#d9efff');
    const bm = new MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: Math.max(0.45, opacity),
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
    });
    try {
      if (!(bm as any).userData) (bm as any).userData = {};
      // For basic fallback, also respect bloomOnly: if bloomOnly is false
      // we want the material to remain color-write enabled always.
      (bm as any).userData.__copilot_forceColorWrite = !(bloomOnly === true);
      (bm as any).userData.__copilot_bloomOnly = Boolean(bloomOnly === true);
    } catch { /* ignore */ }
    return bm;
  }, [tintColor, opacity, bloomOnly]);

  // Read global UI flag to detect when postprocessing is disabled.
  const postprocessingEnabled = useUiStore((s) => s.postprocessingEnabled);

  const materialToUse = postprocessingEnabled ? material : basicMaterial;

  // Update material blending and tint when postprocessing toggles or props change.
  useEffect(() => {
    try {
      if ((materialToUse as any)?.uniforms) {
        // Determine the tint mix to apply. Prefer an explicitly provided
        // tintMix; otherwise pick a conservative default when postprocessing
        // is off so the ring remains visible.
        const desiredTintMix = typeof tintMix === 'number' ? tintMix : (postprocessingEnabled ? 0.0 : 0.9);
        (materialToUse as any).uniforms.uTintMix.value = desiredTintMix;
        // Update tint color if changed
        (materialToUse as any).uniforms.uTintColor.value = colorFromConfig(tintColor ?? '#d9efff');
        // Adjust brightness/opacity slightly when postprocessing is disabled
        (materialToUse as any).uniforms.uBrightness.value = postprocessingEnabled ? brightness : Math.max(brightness, 1.6);
        (materialToUse as any).uniforms.uOpacity.value = postprocessingEnabled ? opacity : Math.max(0.45, opacity);
        // Switch blending mode to Normal when PP is off so the ring remains
        // visible against the dark background without relying on bloom.
        try {
          (materialToUse as any).blending = postprocessingEnabled ? AdditiveBlending : NormalBlending;
        } catch { /* ignore */ }
        try { (materialToUse as any).needsUpdate = true; } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [materialToUse, postprocessingEnabled, opacity, brightness]);

  // Keep uniforms in sync when props change (useful in interactive tweaking)
  useEffect(() => {
    try {
      if ((materialToUse as any)?.uniforms) {
        (materialToUse as any).uniforms.uOpacity.value = opacity;
        (materialToUse as any).uniforms.uInnerRadius.value = innerRadius;
        (materialToUse as any).uniforms.uOuterRadius.value = outerRadius;
        (materialToUse as any).uniforms.uBrightness.value = brightness;
        (materialToUse as any).uniforms.uFresnelStrength.value = fresnelStrength;
        // Ensure the material is refreshed for rendering when values change
        try { (materialToUse as any).needsUpdate = true; } catch { /* ignore */ }
      }
    } catch {
      /* ignore host environment errors */
    }
  }, [materialToUse, opacity, innerRadius, outerRadius, brightness, fresnelStrength]);

  // Attach debug helpers once the material exists so we can adjust uniforms
  // and render order from the console during interactive debugging.
  try {
    if (typeof window !== 'undefined' && /[?&]copilot_debug=1/.test(window.location.search)) {
      try {
        // Use a lightweight effect-like attachment without requiring React's useEffect
        (window as any).__copilot_ringMaterial = materialToUse;
        (window as any).__copilot_setRingOpacity = (v: any) => {
          try {
            const n = Number(v);
            if (!Number.isFinite(n)) return { set: false, reason: 'not-a-number' };
            if ((materialToUse as any)?.uniforms) {
              (materialToUse as any).uniforms.uOpacity.value = Math.max(0, Math.min(n, 1));
            } else if (typeof (materialToUse as any).opacity === 'number') {
              (materialToUse as any).opacity = Math.max(0, Math.min(n, 1));
            }
            try { (materialToUse as any).needsUpdate = true; } catch { /* ignore */ }
            return { set: true, value: (materialToUse as any).uniforms?.uOpacity?.value ?? (materialToUse as any).opacity };
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
  return <mesh ref={meshRef} geometry={geometry} material={materialToUse} rotation={[-Math.PI / 2, 0, 0]} renderOrder={RENDER_ORDER_TRANSLUCENT_ADDITIVE} />;
}

export default PlanetRings;