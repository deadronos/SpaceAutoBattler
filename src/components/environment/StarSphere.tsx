import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh, Texture } from 'three';
import { MeshBasicMaterial, ShaderMaterial, Vector3, NoBlending } from 'three';
import fragmentShaderRaw from '../../renderer/shaders/mainsequencestar.glsl';
import { COMMON_GLSL } from '../../renderer/shaders/index.js';
import vertexShader from '../../renderer/shaders/starDisk.vertex.glsl';
import type { StarLightConfig, CelestialEnvironmentConfig, StarDiskHazeConfig, StarDiskBoundaryConfig } from '../../config/environment.js';
import { useStarTextures } from '../../hooks/useStarTextures.js';
import { useStarMaterial } from '../../hooks/useStarMaterial.js';
import { updateMainSequenceStarUniforms } from '../../renderer/starDiskMaterial.js';
import { isCopilotDebugEnabled } from '../../utils/copilotDebug.js';
import { reportMaterialError, reportWebGLError } from '../../utils/errorReporting.js';

interface StarSphereProps {
  config?: StarLightConfig;
  /** Optional override for configured size (world units) */
  size?: number;
  /** Optional override for configured opacity */
  opacity?: number;
  /** Optional multiplier for star distance */
  distanceMultiplier?: number;
  /** Whether the sphere should be rendered */
  enabled?: boolean;
  /** Optional haze configuration override */
  haze?: StarDiskHazeConfig;
  /** Optional boundary configuration override */
  boundary?: StarDiskBoundaryConfig;
  /** Optional texture overrides - when provided these are used instead of the loader */
  organicTexture?: Texture | null;
  noiseTexture?: Texture | null;
  /** Optional pre-built ShaderMaterial to use instead of creating one */
  materialOverride?: ShaderMaterial | null;
  /** Normalized (0..1) radius for the opaque depth core; overrides derived value */
  depthCoreRadius?: number;
  /** Attempt to enable alpha-to-coverage/MSAA for smoother alpha-tested edges when available */
  enableAlphaToCoverage?: boolean;
}

export function StarSphere({
  config,
  size,
  opacity,
  distanceMultiplier,
  enabled = true,
  haze,
  boundary,
  organicTexture: organicOverride,
  noiseTexture: noiseOverride,
  materialOverride,
  depthCoreRadius: depthCoreRadiusProp,
  enableAlphaToCoverage = true,
}: StarSphereProps): React.ReactElement | null {
  // Reuse global environment defaults where present so this sphere matches
  // the existing StarDisk configuration. Treat `starDisk.size` as a radius
  // (this aligns with the `StarDiskConfig` comment that `size` is a radius),
  // so use the configured value directly as the sphere radius.
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig }).__CELESTIAL__;
  const defaultSize = size ?? env?.starDisk?.size ?? 800;
  const defaultOpacity = opacity ?? env?.starDisk?.opacity ?? 0.12;
  const defaultDistanceMultiplier = distanceMultiplier ?? env?.starDisk?.distanceMultiplier ?? 0.8;
  const fallbackHaze = env?.starDisk?.haze;
  const fallbackBoundary = env?.starDisk?.boundary;
  const radius = defaultSize;

  // We keep two meshes:
  // 1) depthMeshRef: a slightly smaller sphere that writes only to the depth
  //    buffer (colorWrite=false). This ensures scene objects can occlude the
  //    star even when the visible shader uses additive blending.
  // 2) visualMeshRef: the visible sphere that receives the star shader.
  const depthMeshRef = useRef<Mesh | null>(null);
  const visualMeshRef = useRef<Mesh | null>(null);
  const { gl, camera, size: viewportSize } = useThree();

  // Prefer passed-in textures; otherwise use the global loader hook.
  const { organic: loadedOrganic, noise: loadedNoise } = useStarTextures();
  const organic = organicOverride ?? loadedOrganic ?? null;
  const noise = noiseOverride ?? loadedNoise ?? null;

  const debugEnabled = useMemo(() => {
    return isCopilotDebugEnabled();
  }, []);

  const createdMaterial = useStarMaterial(debugEnabled);
  // Allow callers to fully override the material if desired (for testing or
  // special-case rendering). Otherwise use the created shader material.
  const appliedMaterial = materialOverride ?? createdMaterial;

  // Compute local offset from parent StarLight group to position the sphere
  // away from the origin along the configured star direction. Mirror the
  // logic from StarDisk so transitions between the two are consistent.
  const localOffset = useMemo(() => {
    if (!config) return [0, 0, 0] as [number, number, number];
    const dir = new Vector3(config.direction.x, config.direction.y, config.direction.z).normalize();
    const distance = Math.max(config.distance * defaultDistanceMultiplier, 8000);
    return dir.multiplyScalar(-distance).toArray() as [number, number, number];
  }, [
    config?.direction.x,
    config?.direction.y,
    config?.direction.z,
    config?.distance,
    defaultDistanceMultiplier,
  ]);

  // Assign the shader to the visual mesh and ensure it performs depth
  // testing (so it can be occluded) but does not write depth. The depth
  // mesh handles writing depth to preserve occlusion for nearer objects.
  useEffect(() => {
    const mesh = visualMeshRef.current;
    const mat = appliedMaterial;
    if (!mesh) return;
    if (mat) {
      try {
        mesh.material = mat as any;
        try {
          (mat as any).depthTest = true;
          (mat as any).depthWrite = false;
          (mat as any).needsUpdate = true;
        } catch (error) {
          // Expected: Material may be disposed during React unmount cycle
          reportMaterialError('depthSettings', 'ShaderMaterial', error);
        }
      } catch (error) {
        // Expected: Material assignment may fail if mesh is disposed
        reportMaterialError('materialAssignment', 'visualMesh', error);
      }
    }
  }, [appliedMaterial]);

  // Precompute a depth core radius used by the shader and the depth
  // geometry. This is derived from either the explicit prop or the
  // configured boundary.featherStart with a conservative offset.
  const boundaryStart = Number(boundary?.featherStart ?? fallbackBoundary?.featherStart ?? 0.88);
  const derivedDepthCoreRadius = depthCoreRadiusProp !== undefined
    ? Math.min(Math.max(Number(depthCoreRadiusProp), 0), 1)
    : Math.min(Math.max(boundaryStart - 0.12, 0.02), 0.95);
  const depthMeshNormalized = Math.min(Math.max(derivedDepthCoreRadius, 0.02), 0.99);
  const depthMeshRadius = radius * depthMeshNormalized * 0.995;

  // Create a shader-driven DEPTH_PASS material when the shader material is
  // available. The depth material shares the same uniforms object so time/
  // texture updates apply to both visual and depth passes. This avoids the
  // duplication and synchronization pitfalls of naive shader cloning.
  const depthMaterialRef = useRef<ShaderMaterial | MeshBasicMaterial | null>(null);
  useEffect(() => {
    const depthMesh = depthMeshRef.current;
    if (!depthMesh) return;

    // Dispose previous depth material we created
    const prev = depthMaterialRef.current as any;
    if (prev && prev.dispose) {
      try { prev.dispose(); } catch (error) {
        // Expected: Material may already be disposed
        reportMaterialError('dispose', 'depthMaterial', error);
      }
    }

    if (appliedMaterial && (appliedMaterial as any).isShaderMaterial) {
      try {
        const shaderMat = appliedMaterial as ShaderMaterial;
        // Prepend shared GLSL utilities (noise, hash, etc.) to the fragment shader
        const fragmentShader = COMMON_GLSL + '\n' + fragmentShaderRaw;
        const depthMat = new ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: shaderMat.uniforms as any,
          defines: { DEPTH_PASS: '1' },
          depthWrite: true,
          depthTest: true,
          colorWrite: false,
          blending: NoBlending,
          transparent: false,
          premultipliedAlpha: (shaderMat as any).premultipliedAlpha || false,
        });
        // Slight polygon offset to reduce z-fighting with the visual mesh
        depthMat.polygonOffset = true;
        depthMat.polygonOffsetFactor = -1;
        depthMat.polygonOffsetUnits = 1;
        depthMaterialRef.current = depthMat;
        try { depthMesh.material = depthMat as any; } catch (error) {
          // Expected: Mesh may be disposed during unmount
          reportMaterialError('depthMeshAssignment', 'ShaderMaterial', error);
        }
      } catch (err) {
        // Fall back to basic depth-only material if shader material creation fails
        reportMaterialError('shaderCreation', 'depthShaderMaterial', err);
        const basic = new MeshBasicMaterial({ color: '#000', depthWrite: true, depthTest: true });
        (basic as any).colorWrite = false;
        depthMaterialRef.current = basic;
        try { depthMesh.material = basic as any; } catch (error) {
          // Expected: Mesh may be disposed during unmount
          reportMaterialError('depthMeshAssignment', 'BasicMaterial', error);
        }
      }
    } else {
      // No shader available: simple depth-only basic material
      const basic = new MeshBasicMaterial({ color: '#000', depthWrite: true, depthTest: true });
      (basic as any).colorWrite = false;
      depthMaterialRef.current = basic;
      try { depthMesh.material = basic as any; } catch (error) {
        // Expected: Mesh may be disposed during unmount
        reportMaterialError('depthMeshAssignment', 'BasicMaterial', error);
      }
    }

    return () => {
      const p = depthMaterialRef.current as any;
      if (p && p.dispose) {
        try { p.dispose(); } catch (error) {
          // Expected: Material may already be disposed
          reportMaterialError('cleanup.dispose', 'depthMaterial', error);
        }
      }
      depthMaterialRef.current = null;
    };
  }, [appliedMaterial, fragmentShaderRaw, vertexShader, radius]);

  // Attempt to enable alpha-to-coverage on the raw GL context and toggle
  // material.alphaToCoverage when supported. This can reduce aliasing on
  // alpha-tested edges when the browser's MSAA is active.
  useEffect(() => {
    if (!enableAlphaToCoverage) return;
    try {
      const raw = (gl as any).getContext ? (gl as any).getContext() : null;
      if (raw && typeof raw.enable === 'function' && typeof (raw as any).SAMPLE_ALPHA_TO_COVERAGE !== 'undefined') {
        try { raw.enable((raw as any).SAMPLE_ALPHA_TO_COVERAGE); } catch (error) {
          // Expected: Some browsers/contexts don't support alpha-to-coverage
          reportWebGLError('SAMPLE_ALPHA_TO_COVERAGE', error);
        }
      }
    } catch (error) {
      // Expected: getContext may not be available in all environments
      reportWebGLError('getContext', error);
    }
    // Also try to enable alphaToCoverage on the shader material if the
    // runtime/three.js version exposes the property.
    try {
      if (appliedMaterial) {
        try { (appliedMaterial as any).alphaToCoverage = true; } catch (error) {
          // Expected: Property may not exist on all material types
          reportMaterialError('alphaToCoverage', 'appliedMaterial', error);
        }
      }
      const depthMat = depthMaterialRef.current;
      if (depthMat) {
        try { (depthMat as any).alphaToCoverage = true; } catch (error) {
          // Expected: Property may not exist on all material types
          reportMaterialError('alphaToCoverage', 'depthMaterial', error);
        }
      }
    } catch (error) {
      // Expected: Material access may fail during unmount
      reportMaterialError('alphaToCoverage.outer', 'materials', error);
    }
  }, [gl, appliedMaterial, enableAlphaToCoverage]);

  // Update shader uniforms each frame. Includes time, resolution, textures,
  // camera roll and optional haze/boundary settings mirroring StarDisk.
  useFrame((state) => {
    if (!enabled) return;
    const mat = appliedMaterial;
    if (!mat) return;

    const roll = (camera as any).rotation?.z as number | undefined;
    const cameraRoll = typeof roll === 'number' && Number.isFinite(roll) ? roll : 0;

    updateMainSequenceStarUniforms(mat as ShaderMaterial, {
      time: state.clock.getElapsedTime(),
      resolution: { width: Number(viewportSize.width) || Math.max(1, gl.domElement.width), height: Number(viewportSize.height) || Math.max(1, gl.domElement.height) },
      organic: organic ?? null,
      noise: noise ?? null,
      cameraRoll,
      starNorth: 0,
      viewAlignment: { x: 0, y: 0, z: 1 },
      haze: haze ?? fallbackHaze,
      boundary: boundary ?? fallbackBoundary,
      depthCoreRadius: derivedDepthCoreRadius,
    });
  });

  if (!enabled) return null;

  // Slightly scale the depth-only sphere down to avoid z-fighting with the
  // visible shader geometry.
  const DEPTH_SCALE = 0.92;

  return (
    <group position={localOffset}>
      {/* Depth-only pass: writes to depth but not to color. Use a simple
          depth-only basic material to avoid cloning the shader and the
          artifacts it previously produced. The depth geometry is slightly
          smaller than the visual sphere so the visible halo can overlap
          without z-fighting. */}
      <mesh ref={depthMeshRef} visible={enabled} renderOrder={0}>
        <sphereGeometry args={[depthMeshRadius, 128, 64]} />
      </mesh>

      {/* Visual pass: shader-driven sphere that tests against depth so
          nearer scene objects render in front. Increased geometry
          segments reduce visible faceting and sampling artifacts. */}
      <mesh ref={visualMeshRef} visible={enabled} renderOrder={1}>
        {/* Use a higher-res sphere so shader sampling looks smooth */}
        <sphereGeometry args={[radius, 128, 64]} />
        {appliedMaterial ? (
          <primitive attach="material" object={appliedMaterial as unknown as object} />
        ) : (
          // Fallback material for when shader creation fails or is
          // intentionally omitted. Use depth-enabled basic material so it
          // both contributes color and occludes other objects as expected.
          <meshBasicMaterial color="#fff" transparent={true} opacity={defaultOpacity} depthWrite={true} depthTest={true} />
        )}
      </mesh>
    </group>
  );
}
