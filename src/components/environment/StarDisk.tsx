import { useMemo, useRef, useEffect, useCallback } from 'react';
import type { Mesh, Texture } from 'three';
import {
  Vector3,
  ShaderMaterial,
  RepeatWrapping,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  SRGBColorSpace,
  Quaternion,
  MeshBasicMaterial,
  DoubleSide,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { StarLightConfig, CelestialEnvironmentConfig, StarDiskHazeConfig, StarDiskBoundaryConfig } from '../../config/environment.js';
import { useOptionalGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import {
  createMainSequenceStarMaterial,
  updateMainSequenceStarUniforms,
  disposeMainSequenceStarMaterial,
  type MainSequenceStarUniformUpdate,
} from '../../renderer/starDiskMaterial.js';
import { STAR_DISK_TEXTURE_PATHS, type StarDiskTextureKey } from '../../assets/starDiskTextures.js';
import {
  computeStarDiskQuaternion,
  createViewAlignmentScratch,
  computeViewAlignment,
  type ViewAlignment,
} from '../../renderer/starDiskOrientation.js';

function isCopilotDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const win = window as Window & { __copilotDebugForce?: boolean };
    if (win.__copilotDebugForce) {
      return true;
    }
    const search = typeof win.location?.search === 'string' ? win.location.search : '';
    return /[?&]copilot_debug=1/.test(search);
  } catch {
    return false;
  }
}

interface StarDiskProps {
  config: StarLightConfig;
  /** Size of the star disk billboard in world units */
  size?: number;
  /** Opacity of the star disk */
  opacity?: number;
  /** Multiplier applied to starLight.distance to compute disk offset */
  distanceMultiplier?: number;
  /** Enable/disable the star disk */
  enabled?: boolean;
  /** Optional haze taper configuration overriding environment defaults. */
  haze?: StarDiskHazeConfig;
  /** Optional boundary feather configuration overriding environment defaults. */
  boundary?: StarDiskBoundaryConfig;
}

export function StarDisk({ config, size, opacity, distanceMultiplier, enabled = true, haze, boundary }: StarDiskProps): React.ReactElement | null {
  // Allow defaults to be supplied via the environment config when not passed explicitly
  const env = (globalThis as unknown as { __CELESTIAL__?: CelestialEnvironmentConfig }).__CELESTIAL__;
  const defaultSize = size ?? env?.starDisk?.size ?? 800;
  const defaultOpacity = opacity ?? env?.starDisk?.opacity ?? 0.12;
  const defaultDistanceMultiplier = distanceMultiplier ?? env?.starDisk?.distanceMultiplier ?? 0.8;
  const fallbackHaze = env?.starDisk?.haze;
  const fallbackBoundary = env?.starDisk?.boundary;
  const meshRef = useRef<Mesh>(null);
  const shaderMaterialRef = useRef<ShaderMaterial | null>(null);
  const aspectWarnedRef = useRef(false);
  const fallbackTimeRef = useRef(0);
  const lastUniformTimeRef = useRef(0);
  const previousUniformTimeRef = useRef(0);
  const baseQuaternion = useMemo<Quaternion>(() => computeStarDiskQuaternion(config.direction), [
    config.direction.x,
    config.direction.y,
    config.direction.z,
  ]);
  const meshWorldPosition = useMemo(() => new Vector3(), []);
  const viewScratch = useMemo(() => createViewAlignmentScratch(), []);
  const viewAlignmentRef = useRef<ViewAlignment>({ x: 0, y: 0, z: 1 });
  const hazeConfig = useMemo<MainSequenceStarUniformUpdate['haze']>(() => {
    const source = haze ?? fallbackHaze;
    if (!source) {
      return undefined;
    }
    return {
      taperStrength: source.taperStrength,
      edgeFadeThreshold: source.edgeFadeThreshold,
      edgeExponent: source.edgeExponent,
    };
  }, [
    haze?.taperStrength,
    haze?.edgeFadeThreshold,
    haze?.edgeExponent,
    fallbackHaze?.taperStrength,
    fallbackHaze?.edgeFadeThreshold,
    fallbackHaze?.edgeExponent,
  ]);

  const boundaryConfig = useMemo<MainSequenceStarUniformUpdate['boundary']>(() => {
    const source = boundary ?? fallbackBoundary;
    if (!source) {
      return undefined;
    }
    return {
      featherStart: source.featherStart,
      featherExponent: source.featherExponent,
      alphaFloor: source.alphaFloor,
    };
  }, [
    boundary?.featherStart,
    boundary?.featherExponent,
    boundary?.alphaFloor,
    fallbackBoundary?.featherStart,
    fallbackBoundary?.featherExponent,
    fallbackBoundary?.alphaFloor,
  ]);

  const gameState = useOptionalGameState();
  const { gl, scene, camera } = useThree();
  const starTextures = useTexture(STAR_DISK_TEXTURE_PATHS) as Record<StarDiskTextureKey, Texture | undefined>;
  const organicTexture = starTextures.organic;
  const noiseTexture = starTextures.noiseRgba;
  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return /[?&]copilot_debug=1/.test(window.location.search);
  }, []);
  const removeDebugOverlay = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const overlay = document.getElementById('copilot-star-screen-indicator');
    if (overlay) {
      try {
        overlay.remove();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    if (organicTexture) {
      organicTexture.wrapS = RepeatWrapping;
      organicTexture.wrapT = ClampToEdgeWrapping;
      organicTexture.minFilter = LinearMipmapLinearFilter;
      organicTexture.magFilter = LinearFilter;
      organicTexture.anisotropy = maxAniso;
      organicTexture.colorSpace = SRGBColorSpace;
      organicTexture.needsUpdate = true;
    }
    if (noiseTexture) {
      noiseTexture.wrapS = RepeatWrapping;
      noiseTexture.wrapT = RepeatWrapping;
      noiseTexture.minFilter = NearestFilter;
      noiseTexture.magFilter = NearestFilter;
      noiseTexture.generateMipmaps = false;
      noiseTexture.needsUpdate = true;
    }
  }, [gl, organicTexture, noiseTexture]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || typeof (mesh.quaternion as unknown as { copy?: unknown })?.copy !== 'function') {
      return;
    }
    mesh.quaternion.copy(baseQuaternion);
  }, [baseQuaternion]);

  // Local offset from the parent (StarLight group's origin). When parented, this is the disk's local position.
  const localOffset = useMemo(() => {
    const direction = new Vector3(config.direction.x, config.direction.y, config.direction.z).normalize();
    const distance = Math.max(config.distance * defaultDistanceMultiplier, 8000);
    return direction.multiplyScalar(-distance).toArray();
  }, [config.direction.x, config.direction.y, config.direction.z, config.distance, defaultDistanceMultiplier]);

  const shaderMaterial = useMemo<ShaderMaterial | null>(() => {
    try {
      const mat = createMainSequenceStarMaterial({
        organic: null,
        noise: null,
      });
      shaderMaterialRef.current = mat;
      try {
        if (typeof localStorage !== 'undefined') { localStorage.setItem('copilot_star_material_created', String(Date.now())); }
      } catch { void 0; }
      try { if (typeof document !== 'undefined') { document.documentElement.setAttribute('data-star-material-created', '1'); } } catch { void 0; }
      // DEV: create a transient DOM indicator when the material object is
      // created so developers can visually confirm that the material was
      // instantiated (useful when console output is noisy). Enabled in
      // development or when the debug query param is present.
      try {
        if (debugEnabled && typeof document !== 'undefined') {
          const id = 'copilot-star-material-created-indicator';
          if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            el.textContent = 'STAR MATERIAL CREATED';
            el.style.cssText = 'position:fixed; right:12px; bottom:48px; padding:6px 10px; background:rgba(16,163,127,0.95); color:white; font-size:12px; border-radius:6px; z-index:9999999;';
            document.body.appendChild(el);
            setTimeout(() => { try { el.remove(); } catch { /* ignore */ } }, 4000);
          }
        }
      } catch (err) {
        // swallow debug-only errors
      }
      return mat;
    } catch (error) {
      console.warn('[StarDisk] Failed to create main sequence star material. Falling back to basic material.', error);
      shaderMaterialRef.current = null;
      return null;
    }
  }, [debugEnabled]);

  useEffect(() => {
    const mat = shaderMaterial;
    return () => {
      if (shaderMaterialRef.current === mat) {
        shaderMaterialRef.current = null;
      }
      disposeMainSequenceStarMaterial(mat);
    };
  }, [shaderMaterial]);

  // Ensure the shader material is explicitly assigned to the mesh when
  // available. This guards against render-order or attach timing issues
  // where the <primitive attach="material" /> might not have executed
  // before the first frame update.
  useEffect(() => {
    const mesh = meshRef.current;
    const mat = shaderMaterial;
    if (mesh && mat) {
      try {
        if (mesh.material !== (mat as any)) {
          mesh.material = mat as any;
          // mark needsUpdate to ensure renderer picks up any shader swap
          try { (mat as any).needsUpdate = true; } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [shaderMaterial]);

  // DEV: Force the renderer to compile the scene/camera once so the
  // ShaderMaterial's onBeforeCompile hook runs and we can capture
  // program/link logs (useful when debugging invisible shaders).
  // This is intentionally gated to development builds only.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // Enable in development builds only when explicit debug flag is present.
    if (!debugEnabled) {
      return;
    }

    // If no material or no mesh, there's nothing to compile.
    if (!shaderMaterial || !meshRef.current) {
      return;
    }

    // Poll until the mesh is parented into the scene (or until we give up).
    let attempts = 0;
    const pollInterval = 150; // ms
    const maxAttempts = 20; // ~3s of retries
    const intervalId = setInterval(() => {
      attempts += 1;
      const mesh = meshRef.current;
      if (mesh && mesh.parent) {
        try {
          if (scene && camera && typeof gl.compile === 'function') {
            (gl as any).compile(scene, camera);
            // eslint-disable-next-line no-console
            console.info('[StarDisk][DEV] forced renderer.compile(scene, camera) to trigger shader compilation');
          } else {
            // eslint-disable-next-line no-console
            console.warn('[StarDisk][DEV] Unable to find scene/camera for forced compile');
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[StarDisk][DEV] Forced compile failed', err);
        }
        clearInterval(intervalId);
        return;
      }
      if (attempts >= maxAttempts) {
        // eslint-disable-next-line no-console
        console.warn('[StarDisk][DEV] Giving up waiting for mesh to be parented before compile');
        clearInterval(intervalId);
      }
    }, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [shaderMaterial, gl, scene, camera, debugEnabled]);

  useEffect(() => {
    const clearDebugWindow = () => {
      if (typeof window === 'undefined') {
        return;
      }
  const win = window as unknown as Record<string, unknown>;
      const keys = [
        '__copilot_setStarLayer',
        '__copilot_resetStarLayer',
        '__copilot_setStarBasicMaterial',
        '__copilot_restoreStarMaterial',
        '__copilot_forceBasicMaterialActive',
        '__copilot_forceBasicMaterialColor',
        '__copilot_forceBasicMaterialApplied',
        '__copilot_starLayerSetAt',
        '__copilot_starLayerResetAt',
        '__copilot_forceStarOpaqueRequest',
        '__copilot_forceStarOpaque',
        '__copilot_forceStarOpaqueApplied',
        '__copilot_forceStarOnTopRequest',
        '__copilot_star_forceOnTop',
        '__copilot_forceBasicMaterialRequest',
        '__copilot_restoreOriginalStarMaterial',
        '__copilot_restoreOriginalStarMaterialApplied',
        '__copilot_starMeshStatus',
        '__copilot_rotateCameraDeltaDeg',
        '__copilot_rotateAppliedAt',
      ];
      for (const key of keys) {
        if (key in win) {
          try {
            delete win[key];
          } catch {
            win[key] = undefined;
          }
        }
      }
    };

    if (debugEnabled) {
      return () => {
        clearDebugWindow();
        removeDebugOverlay();
      };
    }

    clearDebugWindow();
    removeDebugOverlay();
    return undefined;
  }, [debugEnabled, removeDebugOverlay]);

  useBloomRegistration(meshRef, { group: 'star', active: enabled && Boolean(shaderMaterial) });

  // Make the disk always face the camera (billboard behavior)
  useFrame((state, delta) => {
    if (!enabled) {
      return;
    }
    const debugWin = debugEnabled && typeof window !== 'undefined' ? (window as any) : undefined;

    // DEV: handle force-opaque requests early so they apply even if the
    // shader material hasn't been created yet. This sets a global flag and
    // triggers `needsUpdate` once the material exists.
    if (debugWin && debugWin.__copilot_forceStarOpaqueRequest) {
      try {
        debugWin.__copilot_forceStarOpaque = true;
      } catch {
        /* ignore */
      }
      const pendingMat = shaderMaterialRef.current;
      if (pendingMat) {
        try {
          pendingMat.needsUpdate = true;
        } catch {
          /* ignore */
        }
        try {
          debugWin.__copilot_forceStarOpaqueApplied = Date.now();
        } catch {
          /* ignore */
        }
        try {
          debugWin.__copilot_forceStarOpaqueRequest = false;
        } catch {
          /* ignore */
        }
      }
    }

    const mat = shaderMaterialRef.current;
    if (!mat) {
      return;
    }

    // DEV: unconditional per-frame mesh status for automation (runs before
    // material checks so it captures presence/visibility early each frame)
    if (debugWin) {
      const meshLocal = meshRef.current;
      if (meshLocal) {
        try {
          const matAny: any = (meshLocal.material as any) || null;
          const wp = meshLocal.getWorldPosition ? meshLocal.getWorldPosition(new Vector3()) : meshLocal.position;
          debugWin.__copilot_starMeshStatus = {
            present: true,
            visible: !!meshLocal.visible,
            renderOrder: Number(meshLocal.renderOrder || 0),
            materialType: matAny ? (matAny.type || null) : null,
            materialTransparent: matAny ? !!matAny.transparent : false,
            materialOpacity: matAny && typeof matAny.opacity === 'number' ? matAny.opacity : null,
            userDataKeys: Object.keys(meshLocal.userData || {}),
            worldPosition: { x: wp.x, y: wp.y, z: wp.z },
            timestamp: Date.now(),
          };
        } catch {
          /* ignore */
        }
      } else {
        try {
          debugWin.__copilot_starMeshStatus = { present: false, timestamp: Date.now() };
        } catch {
          /* ignore */
        }
      }
    }

    const { camera, viewport } = state;
    // DEV: allow external automation to request a small camera rotation by
    // setting `window.__copilot_rotateCameraDeltaDeg = <degrees>`. We apply
    // the rotation here (in the render loop) so the page evaluation does not
    // need to serialize functions or reach into React internals.
    if (debugWin && debugWin.__copilot_rotateCameraDeltaDeg !== undefined && debugWin.__copilot_rotateCameraDeltaDeg !== null) {
      const deg = Number(debugWin.__copilot_rotateCameraDeltaDeg);
      if (Number.isFinite(deg)) {
        camera.rotation.y += deg * Math.PI / 180;
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

    const mesh = meshRef.current;
    const meshQuaternion = mesh?.quaternion ?? null;
    const sim = gameState?.simulation;
    const deltaSeconds = Number.isFinite(delta) && delta > 0 ? delta : 0;
    const simTime = sim ? sim.lastTickStart + sim.alpha * sim.step : undefined;
    const hasSimTime = typeof simTime === 'number' && Number.isFinite(simTime);
    const renderClock = (state as { clock?: { getElapsedTime?: () => number; elapsedTime?: number } }).clock;
    let renderTime: number | undefined;
    if (renderClock) {
      if (typeof renderClock.getElapsedTime === 'function') {
        renderTime = renderClock.getElapsedTime();
      } else if (Number.isFinite(renderClock.elapsedTime ?? NaN)) {
        renderTime = renderClock.elapsedTime as number;
      }
    }
    if (typeof renderTime !== 'number' || !Number.isFinite(renderTime)) {
      renderTime = undefined;
    }

    const EPSILON = 1e-6;
    const fallbackStep = deltaSeconds > 0 ? deltaSeconds : 1 / 60;
    let candidateTime = Number.NEGATIVE_INFINITY;
    if (hasSimTime) {
      candidateTime = Math.max(candidateTime, simTime as number);
    }
    if (typeof renderTime === 'number') {
      candidateTime = Math.max(candidateTime, renderTime);
    }

    let elapsed: number;
    if (Number.isFinite(candidateTime) && candidateTime > lastUniformTimeRef.current + EPSILON) {
      elapsed = candidateTime;
      fallbackTimeRef.current = elapsed;
    } else {
      const base = Math.max(lastUniformTimeRef.current, fallbackTimeRef.current);
      fallbackTimeRef.current = base + fallbackStep;
      elapsed = fallbackTimeRef.current;
    }

    lastUniformTimeRef.current = elapsed;

    // DEV: publish StarDisk uniform telemetry for debugging and correlation with Rapier diagnostics
    if (isCopilotDebugEnabled()) {
      const now = Date.now();
      const deltaTime = elapsed - previousUniformTimeRef.current;
      const isProgressing = deltaTime > 0;
      const rapierDiagnostics = gameState?.simulation?.rapierDiagnostics;
      
      try {
        const debugWin = window as Window & {
          __copilot_starDiskTelemetry?: {
            iTime: number;
            deltaTime: number;
            isProgressing: boolean;
            timestamp: number;
            frameCount: number;
            simTime?: number;
            renderTime?: number;
            usedFallback: boolean;
            rapierPanicCount?: number;
            lastRapierPanicTick?: number;
            ticksSinceLastPanic?: number;
          };
        };
        
        const prevTelemetry = debugWin.__copilot_starDiskTelemetry;
        const frameCount = (prevTelemetry?.frameCount ?? 0) + 1;
        
        debugWin.__copilot_starDiskTelemetry = {
          iTime: elapsed,
          deltaTime,
          isProgressing,
          timestamp: now,
          frameCount,
          simTime: hasSimTime ? simTime as number : undefined,
          renderTime,
          usedFallback: !Number.isFinite(candidateTime) || candidateTime <= lastUniformTimeRef.current + EPSILON,
          rapierPanicCount: rapierDiagnostics?.stepPanics,
          lastRapierPanicTick: rapierDiagnostics?.lastStepPanicTick !== -1 ? rapierDiagnostics?.lastStepPanicTick : undefined,
          ticksSinceLastPanic: rapierDiagnostics && rapierDiagnostics.lastStepPanicTick !== -1
            ? (sim?.lastTickIndex ?? 0) - rapierDiagnostics.lastStepPanicTick
            : undefined,
        };
      } catch {
        // ignore telemetry publishing errors
      }
      
      previousUniformTimeRef.current = elapsed;
    }

    const rawAspect = viewport.aspect;
    const safeAspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;
    if (safeAspect > 8 && !aspectWarnedRef.current) {
      console.warn(`[StarDisk] Unusually high viewport aspect detected: ${safeAspect.toFixed(2)}.`);
      aspectWarnedRef.current = true;
    }
    const { width, height } = state.size;
    const uniformUpdate: MainSequenceStarUniformUpdate = {
      time: elapsed,
      resolution: {
        width: Number.isFinite(width) && width > 0 ? width : 1,
        height: Number.isFinite(height) && height > 0 ? height : 1,
      },
    };

    const alignment = viewAlignmentRef.current;
    alignment.x = 0;
    alignment.y = 0;
    alignment.z = 1;
    const cameraPosition = (camera as { position?: Vector3 }).position;
    if (
      mesh &&
      meshQuaternion &&
      cameraPosition &&
      Number.isFinite(cameraPosition.x) &&
      Number.isFinite(cameraPosition.y) &&
      Number.isFinite(cameraPosition.z)
    ) {
      mesh.updateMatrixWorld();
      meshWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
      computeViewAlignment(meshQuaternion, meshWorldPosition, cameraPosition, viewScratch, alignment);

      // DEV: when debug overlay is enabled, compute screen projection and
      // write a DOM marker so we can sample the canvas at the star's
      // actual on-screen location.
      if (debugEnabled) {
        try {
          const pos = meshWorldPosition.clone();
          const proj = pos.project(camera);
          const ndcX = proj.x; const ndcY = proj.y; const ndcZ = proj.z;
          const pxX = Math.round((ndcX * 0.5 + 0.5) * width);
          const pxY = Math.round((-ndcY * 0.5 + 0.5) * height);
          try {
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
            // swallow overlay errors
          }
        } catch {
          // ignore projection errors in environments without window/camera
        }
      }
    }

    uniformUpdate.viewAlignment = alignment;
    if (hazeConfig) {
      uniformUpdate.haze = hazeConfig;
    }
    uniformUpdate.boundary = boundaryConfig;

    const roll = (camera as any).rotation?.z as number | undefined;
    if (typeof roll === 'number' && Number.isFinite(roll)) {
      uniformUpdate.cameraRoll = roll;
    } else {
      uniformUpdate.cameraRoll = 0;
    }
    uniformUpdate.starNorth = 0;
    if (organicTexture) {
      uniformUpdate.organic = organicTexture;
    }
    if (noiseTexture) {
      uniformUpdate.noise = noiseTexture;
    }
    updateMainSequenceStarUniforms(mat, uniformUpdate);

    // DEV: diagnostic dump & forced apply — when debug automation sets
    // `window.__copilot_dumpStarDebug = true` we'll log state and ensure
    // the shader material is actually assigned to the mesh. This helps
    // diagnose cases where iTime increases but the disk appears static.
    if (debugEnabled && debugWin && (debugWin.__copilot_dumpStarDebug === true)) {
      try {
        const meshLocal = meshRef.current;
        const matCurrent = shaderMaterialRef.current;
        const applied = !!(meshLocal && matCurrent && meshLocal.material === matCurrent);
        // Lightweight console summary for quick inspection
        // eslint-disable-next-line no-console
        console.info('[StarDisk][DBG] dumpStarDebug', { iTime: uniformUpdate.time, applied, materialType: meshLocal ? (meshLocal.material as any)?.type : null, starCompiled: (window as any).__STAR_COMPILED });

        // Try to reassign material if it wasn't applied
        if (!applied && meshLocal && matCurrent) {
          try {
            meshLocal.material = matCurrent as any;
            matCurrent.needsUpdate = true;
            // eslint-disable-next-line no-console
            console.info('[StarDisk][DBG] Reassigned shader material to mesh and flagged needsUpdate');
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[StarDisk][DBG] failed to reassign material', e);
          }
        }

        // Publish a small diagnostics snapshot for automation to inspect
        try {
          const win = window as any;
          win.__copilot_starDiskDiagnostics = win.__copilot_starDiskDiagnostics || [];
          win.__copilot_starDiskDiagnostics.push({ time: Date.now(), iTime: uniformUpdate.time, applied, materialType: meshLocal ? (meshLocal.material as any)?.type : null, starCompiled: (window as any).__STAR_COMPILED });
          if (win.__copilot_starDiskDiagnostics.length > 20) win.__copilot_starDiskDiagnostics.shift();
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      try { debugWin.__copilot_dumpStarDebug = false; } catch { /* ignore */ }
    }

    // DEV: allow automation to request the StarDisk be forced on-top at
    // runtime — only when explicit debug mode is enabled via URL.
    if (debugEnabled && debugWin && debugWin.__copilot_forceStarOnTopRequest) {
      try {
        const meshLocal = meshRef.current;
        if (meshLocal) {
          meshLocal.renderOrder = 99999;
        }
      } catch {
        /* ignore */
      }
      const matImmediate = shaderMaterialRef.current;
      if (matImmediate) {
        try {
          (matImmediate as any).depthTest = false;
          matImmediate.depthWrite = false;
        } catch {
          /* ignore */
        }
      }
      try {
        debugWin.__copilot_star_forceOnTop = true;
      } catch {
        /* ignore */
      }
      try {
        debugWin.__copilot_forceStarOnTopRequest = false;
      } catch {
        /* ignore */
      }
    }

    // DEV: allow automation to request the shader be forced opaque white — only in
    // explicit debug mode.
    if (debugEnabled && debugWin && debugWin.__copilot_forceStarOpaqueRequest) {
      const matImmediate = shaderMaterialRef.current;
      if (matImmediate) {
        try {
          debugWin.__copilot_forceStarOpaque = true;
        } catch {
          /* ignore */
        }
        try {
          matImmediate.needsUpdate = true;
        } catch {
          /* ignore */
        }
        try {
          debugWin.__copilot_forceStarOpaqueRequest = false;
        } catch {
          /* ignore */
        }
        try {
          debugWin.__copilot_forceStarOpaqueApplied = Date.now();
        } catch {
          /* ignore */
        }
      }
    }

    // DEV: allow automation to replace the disk material at runtime for diagnostics
    // — only when explicit debug mode is enabled.
    if (debugEnabled && debugWin) {
      if (debugWin.__copilot_forceBasicMaterialRequest) {
        const meshLocal = meshRef.current;
        if (meshLocal) {
          try {
            if (!meshLocal.userData.__copilot_origMaterial) {
              meshLocal.userData.__copilot_origMaterial = meshLocal.material;
            }
          } catch {
            /* ignore */
          }
          try {
            const basic = new MeshBasicMaterial({ color: '#ffffff', depthTest: false, depthWrite: false, side: DoubleSide });
            meshLocal.material = basic;
            try {
              debugWin.__copilot_forceBasicMaterialApplied = Date.now();
            } catch {
              /* ignore */
            }
          } catch {
            /* ignore */
          }
        }
        try {
          debugWin.__copilot_forceBasicMaterialRequest = false;
        } catch {
          /* ignore */
        }
      }
      if (debugWin.__copilot_restoreOriginalStarMaterial) {
        const meshLocal = meshRef.current;
        if (meshLocal && meshLocal.userData && meshLocal.userData.__copilot_origMaterial) {
          try {
            if (!Array.isArray(meshLocal.material)) {
              (meshLocal.material as any).dispose();
            }
          } catch {
            /* ignore */
          }
          try {
            meshLocal.material = meshLocal.userData.__copilot_origMaterial;
          } catch {
            /* ignore */
          }
          try {
            delete meshLocal.userData.__copilot_origMaterial;
          } catch {
            /* ignore */
          }
          try {
            debugWin.__copilot_restoreOriginalStarMaterialApplied = Date.now();
          } catch {
            /* ignore */
          }
        }
        try {
          debugWin.__copilot_restoreOriginalStarMaterial = false;
        } catch {
          /* ignore */
        }
      }
    }

    // DEV: ensure Playwright can always access helper APIs once the mesh exists
    if (debugEnabled && debugWin && mesh) {
      if (!debugWin.__copilot_setStarBasicMaterial) {
        debugWin.__copilot_setStarBasicMaterial = (opts: any = {}) => {
          try {
            const meshLocal = meshRef.current;
            if (!meshLocal) return { applied: false, reason: 'no-mesh' };
            if (!meshLocal.userData.__copilot_origMaterial) meshLocal.userData.__copilot_origMaterial = meshLocal.material;
            const color = typeof opts.color === 'string' ? opts.color : '#ffffff';
            if (!meshLocal.userData.__copilot_forcedMaterial) {
              meshLocal.userData.__copilot_forcedMaterial = new MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: DoubleSide });
            } else {
              try {
                meshLocal.userData.__copilot_forcedMaterial.color.set(color);
              } catch {
                /* ignore */
              }
            }
            meshLocal.material = meshLocal.userData.__copilot_forcedMaterial;
            try {
              debugWin.__copilot_forceBasicMaterialActive = true;
            } catch {
              /* ignore */
            }
            try {
              debugWin.__copilot_forceBasicMaterialColor = color;
            } catch {
              /* ignore */
            }
            try {
              debugWin.__copilot_forceBasicMaterialApplied = Date.now();
            } catch {
              /* ignore */
            }
            return { applied: true };
          } catch (e) {
            return { applied: false, reason: String(e) };
          }
        };
      }

      if (!debugWin.__copilot_restoreStarMaterial) {
        debugWin.__copilot_restoreStarMaterial = () => {
          try {
            const meshLocal = meshRef.current;
            if (!meshLocal) return { restored: false, reason: 'no-mesh' };
            if (meshLocal.userData && meshLocal.userData.__copilot_origMaterial) {
              try {
                if (!Array.isArray(meshLocal.material)) {
                  (meshLocal.material as any).dispose();
                }
              } catch {
                /* ignore */
              }
              try {
                meshLocal.material = meshLocal.userData.__copilot_origMaterial;
              } catch {
                /* ignore */
              }
              try {
                delete meshLocal.userData.__copilot_origMaterial;
              } catch {
                /* ignore */
              }
              try {
                debugWin.__copilot_restoreOriginalStarMaterialApplied = Date.now();
              } catch {
                /* ignore */
              }
              return { restored: true };
            }
            return { restored: false, reason: 'no-orig' };
          } catch (e) {
            return { restored: false, reason: String(e) };
          }
        };
      }

      if (!mesh.userData.__copilot_origLayerMask) {
        try {
          mesh.userData.__copilot_origLayerMask = (mesh.layers as any).mask;
        } catch {
          mesh.userData.__copilot_origLayerMask = 1;
        }
      }

      if (!debugWin.__copilot_setStarLayer) {
        debugWin.__copilot_setStarLayer = (layerIndex: any = 0) => {
          try {
            const meshLocal = meshRef.current;
            if (!meshLocal) return { set: false, reason: 'no-mesh' };
            const n = Number(layerIndex);
            const idx = Number.isFinite(n) ? Math.max(0, Math.min(Math.floor(n), 31)) : 0;
            meshLocal.layers.set(idx);
            try {
              debugWin.__copilot_starLayerSetAt = Date.now();
            } catch {
              /* ignore */
            }
            return { set: true, layer: idx };
          } catch (e) {
            return { set: false, reason: String(e) };
          }
        };
      }

      if (!debugWin.__copilot_resetStarLayer) {
        debugWin.__copilot_resetStarLayer = () => {
          try {
            const meshLocal = meshRef.current;
            if (!meshLocal) return { reset: false, reason: 'no-mesh' };
            const orig = meshLocal.userData && meshLocal.userData.__copilot_origLayerMask;
            if (typeof orig === 'number') {
              try {
                (meshLocal.layers as any).mask = orig;
              } catch {
                meshLocal.layers.set(0);
              }
            } else {
              meshLocal.layers.set(0);
            }
            try {
              debugWin.__copilot_starLayerResetAt = Date.now();
            } catch {
              /* ignore */
            }
            return { reset: true };
          } catch (e) {
            return { reset: false, reason: String(e) };
          }
        };
      }
    }

    // DEV: persistent forced basic material enforcement (active until cleared)
    // Only enforce when explicit debug mode is enabled.
    if (debugEnabled && debugWin && debugWin.__copilot_forceBasicMaterialActive) {
      const meshLocal = meshRef.current;
      if (meshLocal) {
        if (!meshLocal.userData.__copilot_origMaterial) meshLocal.userData.__copilot_origMaterial = meshLocal.material;
        if (!meshLocal.userData.__copilot_forcedMaterial) {
          const color = typeof debugWin.__copilot_forceBasicMaterialColor === 'string' ? debugWin.__copilot_forceBasicMaterialColor : '#ffffff';
          meshLocal.userData.__copilot_forcedMaterial = new MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: DoubleSide });
        } else if (typeof debugWin.__copilot_forceBasicMaterialColor === 'string') {
          try {
            meshLocal.userData.__copilot_forcedMaterial.color.set(debugWin.__copilot_forceBasicMaterialColor);
          } catch {
            /* ignore */
          }
        }
        if (meshLocal.material !== meshLocal.userData.__copilot_forcedMaterial) {
          meshLocal.material = meshLocal.userData.__copilot_forcedMaterial;
        }
        try {
          debugWin.__copilot_forceBasicMaterialApplied = debugWin.__copilot_forceBasicMaterialApplied || Date.now();
        } catch {
          /* ignore */
        }
      }
    }
  });

  // Cleanup / restore when not in explicit debug mode. Minimal and
  // well-formed: revert forced debug artifacts if debug is not enabled.
  useEffect(() => {
    if (debugEnabled) {
      return;
    }
    const mesh = meshRef.current;
    if (!mesh) return;

    // restore original material if present
    try {
      const orig = mesh.userData && mesh.userData.__copilot_origMaterial;
      if (orig && mesh.material !== orig) {
        try { if (!(Array.isArray(mesh.material))) { (mesh.material as any).dispose(); } } catch { /* ignore */ }
        try { mesh.material = orig; } catch { /* ignore */ }
        try { delete mesh.userData.__copilot_forcedMaterial; } catch { /* ignore */ }
        try { delete mesh.userData.__copilot_origMaterial; } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    try { if (typeof mesh.renderOrder === 'number') mesh.renderOrder = 0; } catch { /* ignore */ }
    try {
      const mat: any = mesh.material as any;
      if (mat) {
        try { if (typeof mat.depthTest === 'boolean') mat.depthTest = true; } catch { /* ignore */ }
        try { if (typeof mat.depthWrite === 'boolean') mat.depthWrite = true; } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    removeDebugOverlay();
  }, [debugEnabled, removeDebugOverlay]);

  if (!enabled) return null;

  const showDebugHelpers = debugEnabled;

  return (
    <mesh ref={meshRef} position={localOffset as [number, number, number]}>
      <circleGeometry args={[defaultSize, 64]} />
      {shaderMaterial ? (
        <primitive object={shaderMaterial as unknown as object} attach="material" />
      ) : (
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={defaultOpacity}
          depthWrite={false}
          depthTest={true}
        />
      )}

      {showDebugHelpers && (
        <>
          {/* Dev helper: small red box at the star local origin to validate placement */}
          <mesh position={[0, 0, 0]} renderOrder={9999}>
            <boxGeometry args={[Math.max(1, defaultSize * 0.05), Math.max(1, defaultSize * 0.05), Math.max(1, defaultSize * 0.05)]} />
            <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
          </mesh>

          {/* Dev helper: axes for orientation/scale debugging */}
          <axesHelper args={[Math.max(10, defaultSize * 0.2)]} />
        </>
      )}
    </mesh>
  );
}