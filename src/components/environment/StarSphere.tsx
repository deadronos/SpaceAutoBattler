import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Camera, Mesh, Texture, WebGLRenderer, Material } from 'three';
import {
  Euler,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
  NoBlending,
  DoubleSide,
  Quaternion,
} from 'three';
import fragmentShaderRaw from '../../renderer/shaders/mainsequencestar.glsl';
import { COMMON_GLSL } from '../../renderer/shaders/index.js';
import vertexShader from '../../renderer/shaders/starSphere.vertex.glsl';
import type {
  StarLightConfig,
  CelestialEnvironmentConfig,
  StarDiskHazeConfig,
  StarDiskBoundaryConfig,
} from '../../config/environment.js';
import { useStarTextures } from '../../hooks/useStarTextures.js';
import { useStarMaterial } from '../../hooks/useStarMaterial.js';
import { updateMainSequenceStarUniforms } from '../../renderer/starDiskMaterial.js';
import { isCopilotDebugEnabled } from '../../utils/copilotDebug.js';
import { useUiStore } from '../../game/uiStore.js';
import { clamp, clamp01 } from '../../utils/math.js';
import { reportMaterialError, reportWebGLError } from '../../utils/errorReporting.js';
import { useStarDebug, useDebugOverlayCleanup } from '../../hooks/useStarDebug.js';
import {
  computeStarDiskQuaternion,
  computeViewAlignment,
  createViewAlignmentScratch,
  type ViewAlignment,
} from '../../renderer/starDiskOrientation.js';

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

interface CopilotDebugWindow {
  __copilot_forceBasicMaterialRequest?: boolean;
  __copilot_forceBasicMaterialActive?: boolean;
  __copilot_forceBasicMaterialColor?: string;
  __copilot_forceBasicMaterialApplied?: number;
  __copilot_restoreOriginalStarMaterial?: boolean;
  __copilot_restoreOriginalStarMaterialApplied?: number;
  __copilot_setStarBasicMaterial?: (opts?: { color?: string }) => {
    applied: boolean;
    reason?: string;
  };
  __copilot_restoreStarMaterial?: () => { restored: boolean; reason?: string };
  __copilot_setStarLayer?: (layerIndex?: unknown) => {
    set: boolean;
    layer?: number;
    reason?: string;
  };
  __copilot_resetStarLayer?: () => { reset: boolean; reason?: string };
  __copilot_starLayerSetAt?: number;
  __copilot_starLayerResetAt?: number;
  __copilot_rotateCameraDeltaDeg?: number | null;
  __copilot_rotateAppliedAt?: number;
  __copilot_cameraPosition?: { x: number; y: number; z: number };
  __copilot_cameraRotation?: { x: number; y: number; z: number };
  __copilot_visualMesh?: Mesh;
  __copilot_appliedMaterial?: ShaderMaterial | null;
}

interface CopilotUserData {
  __copilot_origMaterial?: Material;
  __copilot_forcedMaterial?: MeshBasicMaterial;
  __copilot_origLayerMask?: number;
}

function getCopilotUserData(mesh: Mesh): CopilotUserData {
  if (!mesh.userData) {
    mesh.userData = {};
  }
  return mesh.userData as CopilotUserData;
}

function resolveMaterial(material: Material | Material[]): Material | null {
  if (Array.isArray(material)) {
    return material[0] ?? null;
  }
  return material;
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
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig })
    .__CELESTIAL__;
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

  const paused = useUiStore((s) => s.paused);
  const lastTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);

  // Prefer passed-in textures; otherwise use the global loader hook.
  const { organic: loadedOrganic, noise: loadedNoise } = useStarTextures();
  const organic = organicOverride ?? loadedOrganic ?? null;
  const noise = noiseOverride ?? loadedNoise ?? null;

  const debugEnabled = useMemo(() => {
    return isCopilotDebugEnabled();
  }, []);

  const removeDebugOverlay = useDebugOverlayCleanup();
  useStarDebug(debugEnabled, removeDebugOverlay);

  const createdMaterial = useStarMaterial(debugEnabled, vertexShader);
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
  }, [config, defaultDistanceMultiplier]);

  const baseQuaternion = useMemo(() => {
    if (!config) return new Quaternion();
    return computeStarDiskQuaternion(config.direction);
  }, [config]);

  const viewAlignmentRef = useRef<ViewAlignment>({ x: 0, y: 0, z: 1 });
  const viewScratch = useMemo(() => createViewAlignmentScratch(), []);
  const meshWorldPosition = useMemo(() => new Vector3(), []);

  // Assign the shader to the visual mesh and ensure it performs depth
  // testing (so it can be occluded) but does not write depth. The depth
  // mesh handles writing depth to preserve occlusion for nearer objects.
  useEffect(() => {
    const mesh = visualMeshRef.current;
    const mat = appliedMaterial;
    if (!mesh) return;
    if (mat) {
      try {
        mesh.material = mat;
        try {
          mat.depthTest = true;
          mat.depthWrite = false;
          mat.needsUpdate = true;
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

  // Synchronize orientation from baseQuaternion to both meshes
  useEffect(() => {
    const depthMesh = depthMeshRef.current;
    if (depthMesh && depthMesh.quaternion) {
      depthMesh.quaternion.copy(baseQuaternion);
    }
    const visualMesh = visualMeshRef.current;
    if (visualMesh && visualMesh.quaternion) {
      visualMesh.quaternion.copy(baseQuaternion);
    }
  }, [baseQuaternion]);

  // Precompute a depth core radius used by the shader and the depth
  // geometry. This is derived from either the explicit prop or the
  // configured boundary.featherStart with a conservative offset.
  const boundaryStart = Number(boundary?.featherStart ?? fallbackBoundary?.featherStart ?? 0.88);
  const derivedDepthCoreRadius =
    depthCoreRadiusProp !== undefined
      ? clamp01(Number(depthCoreRadiusProp))
      : clamp(boundaryStart - 0.12, 0.02, 0.95);
  const depthMeshNormalized = clamp(derivedDepthCoreRadius, 0.02, 0.99);
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
    const prev = depthMaterialRef.current;
    if (prev && typeof prev.dispose === 'function') {
      try {
        prev.dispose();
      } catch (error) {
        // Expected: Material may already be disposed
        reportMaterialError('dispose', 'depthMaterial', error);
      }
    }

    if (appliedMaterial instanceof ShaderMaterial) {
      try {
        const shaderMat = appliedMaterial;
        // Prepend shared GLSL utilities (noise, hash, etc.) to the fragment shader
        const fragmentShader = COMMON_GLSL + '\n' + fragmentShaderRaw;
        const depthMat = new ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: shaderMat.uniforms,
          defines: { DEPTH_PASS: '1' },
          depthWrite: true,
          depthTest: true,
          colorWrite: false,
          blending: NoBlending,
          transparent: false,
          premultipliedAlpha: shaderMat.premultipliedAlpha || false,
        });
        // Slight polygon offset to reduce z-fighting with the visual mesh
        depthMat.polygonOffset = true;
        depthMat.polygonOffsetFactor = -1;
        depthMat.polygonOffsetUnits = 1;
        depthMaterialRef.current = depthMat;
        try {
          depthMesh.material = depthMat;
        } catch (error) {
          // Expected: Mesh may be disposed during unmount
          reportMaterialError('depthMeshAssignment', 'ShaderMaterial', error);
        }
      } catch (err) {
        // Fall back to basic depth-only material if shader material creation fails
        reportMaterialError('shaderCreation', 'depthShaderMaterial', err);
        const basic = new MeshBasicMaterial({
          color: '#000',
          depthWrite: true,
          depthTest: true,
          colorWrite: false,
        });
        depthMaterialRef.current = basic;
        try {
          depthMesh.material = basic;
        } catch (error) {
          // Expected: Mesh may be disposed during unmount
          reportMaterialError('depthMeshAssignment', 'BasicMaterial', error);
        }
      }
    } else {
      // No shader available: simple depth-only basic material
      const basic = new MeshBasicMaterial({
        color: '#000',
        depthWrite: true,
        depthTest: true,
        colorWrite: false,
      });
      depthMaterialRef.current = basic;
      try {
        depthMesh.material = basic;
      } catch (error) {
        // Expected: Mesh may be disposed during unmount
        reportMaterialError('depthMeshAssignment', 'BasicMaterial', error);
      }
    }

    return () => {
      const p = depthMaterialRef.current;
      if (p && typeof p.dispose === 'function') {
        try {
          p.dispose();
        } catch (error) {
          // Expected: Material may already be disposed
          reportMaterialError('cleanup.dispose', 'depthMaterial', error);
        }
      }
      depthMaterialRef.current = null;
    };
  }, [appliedMaterial, radius]);

  // Attempt to enable alpha-to-coverage on the raw GL context and toggle
  // material.alphaToCoverage when supported. This can reduce aliasing on
  // alpha-tested edges when the browser's MSAA is active.
  useEffect(() => {
    if (!enableAlphaToCoverage) return;
    try {
      // Access raw WebGL context for alpha-to-coverage
      const renderer = gl as WebGLRenderer;
      const raw = renderer.getContext?.() as WebGL2RenderingContext | WebGLRenderingContext | null;
      if (raw && typeof raw.enable === 'function') {
        const SAMPLE_ALPHA_TO_COVERAGE = 0x809e; // GL constant
        try {
          raw.enable(SAMPLE_ALPHA_TO_COVERAGE);
        } catch (error) {
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
        appliedMaterial.alphaToCoverage = true;
      }
      const depthMat = depthMaterialRef.current;
      if (depthMat) {
        depthMat.alphaToCoverage = true;
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

    let debugWin: CopilotDebugWindow | undefined;
    const mesh = visualMeshRef.current;

    // We conditionally enable dev/debug tools at runtime based on query parameters
    if (debugEnabled) {
      debugWin =
        typeof window !== 'undefined' ? (window as unknown as CopilotDebugWindow) : undefined;
      if (debugWin) {
        debugWin.__copilot_cameraPosition = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        };
        debugWin.__copilot_cameraRotation = {
          x: camera.rotation.x,
          y: camera.rotation.y,
          z: camera.rotation.z,
        };
      }

      // Handle camera rotation delta request from E2E tests
      if (
        debugWin &&
        debugWin.__copilot_rotateCameraDeltaDeg !== undefined &&
        debugWin.__copilot_rotateCameraDeltaDeg !== null
      ) {
        const deg = Number(debugWin.__copilot_rotateCameraDeltaDeg);
        if (Number.isFinite(deg)) {
          camera.rotation.y += (deg * Math.PI) / 180;
          camera.updateMatrixWorld();
          try {
            debugWin.__copilot_rotateAppliedAt = Date.now();
          } catch {
            /* ignore */
          }
        }
        try {
          debugWin.__copilot_rotateCameraDeltaDeg = null;
        } catch {
          /* ignore */
        }
      }

      // Handle basic material request / setup methods on window
      if (debugWin && mesh) {
        debugWin.__copilot_visualMesh = mesh;
        debugWin.__copilot_appliedMaterial = appliedMaterial;
        if (!debugWin.__copilot_setStarBasicMaterial) {
          debugWin.__copilot_setStarBasicMaterial = (opts: { color?: string } = {}) => {
            try {
              const meshLocal = visualMeshRef.current;
              if (!meshLocal) {
                return { applied: false, reason: 'no-mesh' };
              }
              const userData = getCopilotUserData(meshLocal);
              if (!userData.__copilot_origMaterial) {
                userData.__copilot_origMaterial = resolveMaterial(meshLocal.material) ?? undefined;
              }
              const color = typeof opts.color === 'string' ? opts.color : '#ffffff';
              if (!userData.__copilot_forcedMaterial) {
                userData.__copilot_forcedMaterial = new MeshBasicMaterial({
                  color,
                  depthTest: false,
                  depthWrite: false,
                  side: DoubleSide,
                });
              } else {
                userData.__copilot_forcedMaterial.color.set(color);
              }
              meshLocal.material = userData.__copilot_forcedMaterial;
              debugWin!.__copilot_forceBasicMaterialActive = true;
              debugWin!.__copilot_forceBasicMaterialColor = color;
              debugWin!.__copilot_forceBasicMaterialApplied = Date.now();
              return { applied: true };
            } catch (error) {
              return { applied: false, reason: String(error) };
            }
          };
        }

        if (!debugWin.__copilot_restoreStarMaterial) {
          debugWin.__copilot_restoreStarMaterial = () => {
            try {
              const meshLocal = visualMeshRef.current;
              if (!meshLocal) {
                return { restored: false, reason: 'no-mesh' };
              }
              const userData = getCopilotUserData(meshLocal);
              const originalMaterial = userData.__copilot_origMaterial;
              if (originalMaterial) {
                const forcedMaterial = resolveMaterial(meshLocal.material);
                forcedMaterial?.dispose();
                meshLocal.material = originalMaterial;
                delete userData.__copilot_origMaterial;
                delete userData.__copilot_forcedMaterial;
                debugWin!.__copilot_restoreOriginalStarMaterialApplied = Date.now();
                return { restored: true };
              }
              return { restored: false, reason: 'no-orig' };
            } catch (error) {
              return { restored: false, reason: String(error) };
            }
          };
        }

        if (!mesh.userData) {
          mesh.userData = {};
        }
        const meshUserData = getCopilotUserData(mesh);
        if (meshUserData.__copilot_origLayerMask == null) {
          const rawLayers = mesh.layers as { mask?: number } | undefined;
          const mask = rawLayers && typeof rawLayers.mask === 'number' ? rawLayers.mask : 1;
          meshUserData.__copilot_origLayerMask = Number.isFinite(mask) ? mask : 1;
        }

        if (!debugWin.__copilot_setStarLayer) {
          debugWin.__copilot_setStarLayer = (layerIndex: unknown = 0) => {
            try {
              const meshLocal = visualMeshRef.current;
              if (!meshLocal) {
                return { set: false, reason: 'no-mesh' };
              }
              const value = Number(layerIndex);
              const idx = Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), 31)) : 0;
              const layers = meshLocal.layers as
                | { set?: (layer: number) => void; mask?: number }
                | undefined;
              if (layers && typeof layers.set === 'function') {
                layers.set(idx);
              } else if (layers) {
                layers.mask = idx;
              }
              debugWin!.__copilot_starLayerSetAt = Date.now();
              return { set: true, layer: idx };
            } catch (error) {
              return { set: false, reason: String(error) };
            }
          };
        }

        if (!debugWin.__copilot_resetStarLayer) {
          debugWin.__copilot_resetStarLayer = () => {
            try {
              const meshLocal = visualMeshRef.current;
              if (!meshLocal) {
                return { reset: false, reason: 'no-mesh' };
              }
              const userData = getCopilotUserData(meshLocal);
              const orig = userData.__copilot_origLayerMask;
              if (typeof orig === 'number') {
                const layers = meshLocal.layers as
                  | { mask?: number; set?: (layer: number) => void }
                  | undefined;
                if (layers && typeof layers.set === 'function') {
                  layers.set(orig);
                } else if (layers) {
                  layers.mask = orig;
                }
              } else {
                const layers = meshLocal.layers as
                  | { mask?: number; set?: (layer: number) => void }
                  | undefined;
                if (layers && typeof layers.set === 'function') {
                  layers.set(0);
                } else if (layers) {
                  layers.mask = 0;
                }
              }
              debugWin!.__copilot_starLayerResetAt = Date.now();
              return { reset: true };
            } catch (error) {
              return { reset: false, reason: String(error) };
            }
          };
        }
      }

      // Handle persistent basic material enforcement if toggled active
      if (debugWin && debugWin.__copilot_forceBasicMaterialActive && mesh) {
        try {
          const userData = getCopilotUserData(mesh);
          if (!userData.__copilot_origMaterial) {
            userData.__copilot_origMaterial = resolveMaterial(mesh.material) ?? undefined;
          }
          if (!userData.__copilot_forcedMaterial) {
            const color =
              typeof debugWin.__copilot_forceBasicMaterialColor === 'string'
                ? debugWin.__copilot_forceBasicMaterialColor
                : '#ffffff';
            userData.__copilot_forcedMaterial = new MeshBasicMaterial({
              color,
              depthTest: false,
              depthWrite: false,
              side: DoubleSide,
            });
          } else if (typeof debugWin.__copilot_forceBasicMaterialColor === 'string') {
            userData.__copilot_forcedMaterial.color.set(debugWin.__copilot_forceBasicMaterialColor);
          }
          if (mesh.material !== userData.__copilot_forcedMaterial) {
            mesh.material = userData.__copilot_forcedMaterial;
          }
          debugWin.__copilot_forceBasicMaterialApplied =
            debugWin.__copilot_forceBasicMaterialApplied || Date.now();
        } catch {
          /* ignore */
        }
      }

      // Create / position the `#copilot-star-screen-indicator` overlay
      if (mesh) {
        try {
          mesh.updateMatrixWorld();
          const meshWorldPosition = new Vector3();
          meshWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
          const dirX = config?.direction?.x ?? 0;
          const dirY = config?.direction?.y ?? 0;
          const dirZ = config?.direction?.z ?? 1;
          const dir = new Vector3(dirX, dirY, dirZ).normalize();
          const pos = meshWorldPosition.clone().addScaledVector(dir, radius);
          const proj = pos.project(camera);
          const ndcX = proj.x;
          const ndcY = proj.y;
          const width = state.size.width;
          const height = state.size.height;
          const pxX = Math.round((ndcX * 0.5 + 0.5) * width);
          const pxY = Math.round((-ndcY * 0.5 + 0.5) * height);

          let el = document.getElementById('copilot-star-screen-indicator');
          if (!el) {
            el = document.createElement('div');
            el.id = 'copilot-star-screen-indicator';
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.width = '12px';
            el.style.height = '12px';
            el.style.borderRadius = '50%';
            el.style.background = 'rgba(255,0,0,0.9)';
            el.style.zIndex = '2147483647';
            el.style.transform = 'translate(-50%, -50%)';
            document.body.appendChild(el);
          }
          el.style.left = pxX + 'px';
          el.style.top = pxY + 'px';
          el.setAttribute('data-copilot-screen-pos', `${pxX},${pxY}`);
        } catch {
          // ignore
        }
      }
    }

    // Compute view alignment to compensate for camera viewing angle
    const cameraPosition = camera.position;
    if (mesh && typeof mesh.updateMatrixWorld === 'function' && cameraPosition) {
      mesh.updateMatrixWorld();
      if (mesh.matrixWorld) {
        meshWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
      }
      computeViewAlignment(
        baseQuaternion, // Use baseQuaternion (Z-aligned) for view alignment calculation
        meshWorldPosition,
        cameraPosition,
        viewScratch,
        viewAlignmentRef.current,
      );
    }

    const mat = appliedMaterial;
    if (!mat) return;

    // Access camera rotation z component (roll) safely
    const rotation = (camera as Camera & { rotation?: Euler }).rotation;
    const roll = rotation?.z;
    const cameraRoll = typeof roll === 'number' && Number.isFinite(roll) ? roll : 0;

    const elapsed = state.clock.getElapsedTime();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = elapsed;
      accumulatedTimeRef.current = elapsed;
    }
    const delta = elapsed - lastTimeRef.current;
    lastTimeRef.current = elapsed;
    if (!paused) {
      accumulatedTimeRef.current += delta;
    }

    updateMainSequenceStarUniforms(mat, {
      time: accumulatedTimeRef.current,
      resolution: {
        width: Number(viewportSize.width) || Math.max(1, gl.domElement.width),
        height: Number(viewportSize.height) || Math.max(1, gl.domElement.height),
      },
      organic: organic ?? null,
      noise: noise ?? null,
      cameraRoll,
      starNorth: 0,
      viewAlignment: viewAlignmentRef.current,
      haze: haze ?? fallbackHaze,
      boundary: boundary ?? fallbackBoundary,
      depthCoreRadius: derivedDepthCoreRadius,
    });
  });

  if (!enabled) return null;

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
          nearer scene objects render in front. */}
      <mesh ref={visualMeshRef} visible={enabled} renderOrder={1}>
        <sphereGeometry args={[radius, 128, 64]} />
        {appliedMaterial ? (
          <primitive attach="material" object={appliedMaterial as unknown as object} />
        ) : (
          // Fallback material for when shader creation fails or is
          // intentionally omitted. Use depth-enabled basic material so it
          // both contributes color and occludes other objects as expected.
          <meshBasicMaterial
            color="#fff"
            transparent={true}
            opacity={defaultOpacity}
            depthWrite={true}
            depthTest={true}
          />
        )}
      </mesh>
    </group>
  );
}
