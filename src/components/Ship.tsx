import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type React from 'react';
import { Box3, Color, ShaderMaterial, Sphere, type Group, Vector3, type Mesh } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShieldRipple, ShipEntity, ShipHull } from '../types/index.js';
import { getShieldVisuals } from '../config/renderer.js';
import { useFrame as useRenderFrame } from '@react-three/fiber';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';

export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const group = useRef<Group>(null);

  // Resolve path via helper to ensure it's always defined.
  const modelPath = resolveModelPath(entity.model);
  const hasValidPath = typeof modelPath === 'string' && modelPath.length > 0;

  // Use drei's useGLTF which provides caching and convenience helpers.
  const gltf = hasValidPath ? (useGLTF(modelPath) as GLTF) : null;
  const scene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf?.scene]);

  // Compute a per-model bounding radius to size the shield bubble properly.
  const fallbackRadiusByHull: Record<ShipHull, number> = {
    fighter: 1.6,
    corvette: 2.1,
    frigate: 2.8,
    destroyer: 3.4,
    carrier: 4.4,
  };

  const modelRadius = useMemo(() => {
    // If scene not loaded, return a conservative fallback based on hull.
    if (!scene) return fallbackRadiusByHull[entity.ship.hull] ?? 2.0;
    const box = new Box3().setFromObject(scene);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    // Slight margin so the bubble sits outside the hull — configurable per hull.
    const { margin } = getShieldVisuals(entity.ship.hull);
    return sphere.radius * margin;
  }, [scene, entity.ship.hull]);

  useFrame(() => {
    const ref = group.current;
    if (!ref) return;
    ref.position.copy(entity.transform.position);
    ref.quaternion.copy(entity.transform.rotation);
    ref.scale.setScalar(entity.transform.scale);
  });

  if (scene) {
    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} />
        <ShieldBubble entity={entity} radius={modelRadius} />
      </group>
    );
  }

  // Fallback: render a simple placeholder if the model path is invalid.
  return (
    <group ref={group} dispose={null}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.6, 1.6, 6]} />
        <meshStandardMaterial color={entity.ship.team === 'blue' ? new Color('#77aaff') : new Color('#ff7788')} />
      </mesh>
      <ShieldBubble entity={entity} radius={modelRadius} />
    </group>
  );
}

function ShieldBubble({ entity, radius }: { entity: ShipEntity; radius?: number }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);

  // Basic hex shield shader, inspired by common techniques:
  // - Hex grid based on polar coordinates
  // - Emissive edge glow on hex borders
  // - Team tint controls hue
  // - Opacity scales with shield ratio
  // - Ripple: expand ring from impact direction across sphere via dot(N, dir)
  const material = useMemo(() => {
    const { hexScale, edgeWidth, maxAlpha } = getShieldVisuals(entity.ship.hull);
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: new Color(entity.ship.team === 'blue' ? '#66ccff' : '#ff6699') },
        uOpacity: { value: 1 },
        uHexScale: { value: hexScale },
        uEdgeWidth: { value: edgeWidth },
        uMaxAlpha: { value: maxAlpha },
        uRippleDir: { value: new Vector3(0, 0, 1) },
        uRippleT0: { value: -999 },
        uRippleAmp: { value: 0 },
        uRippleSpeed: { value: 2.5 },
        uRippleWidth: { value: 0.2 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vCenter;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          // Sphere center in world space — needed so shading is correct when parented
          vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        varying vec3 vCenter;
        uniform float uTime;
        uniform vec3 uTint;
        uniform float uOpacity;
        uniform float uHexScale;
        uniform float uEdgeWidth;
        uniform float uMaxAlpha;
        uniform vec3 uRippleDir;
        uniform float uRippleT0;
        uniform float uRippleAmp;
        uniform float uRippleSpeed;
        uniform float uRippleWidth;

        // Hash func for hex tiling glow noise
        float hash(vec2 p){return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);}

        // From polar coordinates create hex grid distance to edge
        // Based on Inigo Quilez's hex tiling technique
        vec2 hex(vec2 p){
          const vec2 k = vec2(0.8660254, 0.5);
          p = abs(p);
          p -= 2.0*min(dot(k,p),0.0)*k;
          p -= vec2(clamp(p.x, -k.y, k.y), 1.0);
          return p;
        }

        void main(){
          // Compute normal relative to sphere center (world space)
          vec3 N = normalize(vWorldPos - vCenter);
          // Create hex coordinates from spherical mapping
          vec2 uv = vec2(atan(N.z, N.x)/6.2831853 + 0.5, acos(N.y)/3.1415926);
          uv *= uHexScale;
          // Hex distance
          vec2 h = hex(fract(uv)-0.5);
          float edge = smoothstep(uEdgeWidth, 0.0, max(h.x, h.y));

          // Ripple term: distance along great circle from impact dir
          float t = uTime - uRippleT0;
          float ring = 0.0;
          if(t > 0.0){
            float d = acos(clamp(dot(N, normalize(uRippleDir)), -1.0, 1.0));
            float r = t * uRippleSpeed; // angular radius
            float w = uRippleWidth;
            float a = uRippleAmp;
            float band = 1.0 - smoothstep(r-w, r, d) + smoothstep(r, r+w, d);
            ring = band * a * exp(-t*1.2);
          }

          float glow = edge * (0.7 + 0.3*hash(floor(uv))) + ring;
          vec3 col = uTint * (0.4 + glow);
          float alpha = min(uMaxAlpha, uOpacity * clamp(0.05 + glow, 0.0, 1.0));
          if(alpha <= 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
    return mat;
  }, [entity.ship.team, entity.ship.hull]);

  useRenderFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const u = (material.uniforms as any);
    u.uTime.value += dt;
    // Anchor to parent ship: local origin with identity rotation.
    // The parent <group> already carries the ship's world transform.
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    // Local scale sets bubble radius. Prefer model-computed radius, fallback by hull.
    const fallbackByHull: Record<ShipHull, number> = {
      fighter: 1.8,
      corvette: 2.3,
      frigate: 3.0,
      destroyer: 3.7,
      carrier: 4.6,
    };
    const r = radius ?? fallbackByHull[entity.ship.hull] ?? 2.0;
    mesh.scale.setScalar(r);

    // Opacity from shield strength (smoothed)
    const s = entity.ship.shield / Math.max(1, entity.ship.maxShield);
    u.uOpacity.value = Math.max(0, Math.min(1, s));

    // Pop the most recent ripple to display; cheap single-ripple visualization
    const ripples = entity.shieldRipples;
    if (ripples && ripples.length > 0) {
      const r: ShieldRipple = ripples[ripples.length - 1];
      u.uRippleDir.value.copy(r.dir);
      u.uRippleT0.value = r.t0;
      u.uRippleAmp.value = r.amp * 1.3;
    } else {
      u.uRippleAmp.value = 0.0;
      u.uRippleT0.value = -999.0;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
