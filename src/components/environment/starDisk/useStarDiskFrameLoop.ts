import { useFrame } from '@react-three/fiber';
import { resolveMaterial } from './utils.js';
import { useRef, type MutableRefObject } from 'react';
import {
  DoubleSide,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
  type Material,
  type Mesh,
  type Texture,
} from 'three';
import type { GameState } from '../../../types/index.js';
import {
  updateMainSequenceStarUniforms,
  type MainSequenceStarUniformUpdate,
} from '../../../renderer/starDiskMaterial.js';
import {
  computeViewAlignment,
  type ViewAlignment,
  type ViewAlignmentScratch,
} from '../../../renderer/starDiskOrientation.js';
import { wrapStarTime, isCopilotDebugEnabled } from '../../../utils/starDisk.js';
import { appendCappedMutable } from '../../../utils/cappedBuffer.js';

interface CopilotStarMeshStatus {
  present: boolean;
  visible?: boolean;
  renderOrder?: number;
  materialType?: string | null;
  materialTransparent?: boolean;
  materialOpacity?: number | null;
  userDataKeys?: string[];
  worldPosition?: { x: number; y: number; z: number };
  timestamp: number;
}

interface CopilotDiagnosticsEntry {
  time: number;
  iTime: number;
  applied: boolean;
  materialType: string | null;
  starCompiled: unknown;
}

interface CopilotDebugWindow extends Window {
  __copilot_forceStarOpaqueRequest?: boolean;
  __copilot_forceStarOpaque?: boolean;
  __copilot_forceStarOpaqueApplied?: number;
  __copilot_starMeshStatus?: CopilotStarMeshStatus;
  __copilot_rotateCameraDeltaDeg?: number | null;
  __copilot_rotateAppliedAt?: number;
  __copilot_starDiskTelemetry?: {
    iTime: number;
    rawTime?: number;
    wrapCycle?: number;
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
  __copilot_dumpStarDebug?: boolean;
  __copilot_starDiskDiagnostics?: CopilotDiagnosticsEntry[];
  __copilot_forceStarOnTopRequest?: boolean;
  __copilot_star_forceOnTop?: boolean;
  __copilot_forceBasicMaterialRequest?: boolean;
  __copilot_forceBasicMaterialApplied?: number;
  __copilot_restoreOriginalStarMaterial?: boolean;
  __copilot_restoreOriginalStarMaterialApplied?: number;
  __copilot_forceBasicMaterialActive?: boolean;
  __copilot_setStarBasicMaterial?: (opts?: { color?: string }) => {
    applied: boolean;
    reason?: string;
  };
  __copilot_restoreStarMaterial?: () => { restored: boolean; reason?: string };
  __copilot_forceBasicMaterial?: boolean;
  __copilot_setStarLayer?: (layerIndex?: unknown) => {
    set: boolean;
    layer?: number;
    reason?: string;
  };
  __copilot_starLayerSetAt?: number;
  __copilot_resetStarLayer?: () => { reset: boolean; reason?: string };
  __copilot_starLayerResetAt?: number;
  __copilot_forceBasicMaterialColor?: string;
  __STAR_COMPILED?: boolean;
}

interface CopilotMeshUserData {
  __copilot_origMaterial?: Material;
  __copilot_forcedMaterial?: MeshBasicMaterial;
  __copilot_origLayerMask?: number;
}



function getCopilotUserData(mesh: Mesh): CopilotMeshUserData {
  if (!mesh.userData || typeof mesh.userData !== 'object') {
    // three.js always initialises userData to an object, but guard defensively
    // to satisfy the type checker when mocks replace the mesh implementation.
    mesh.userData = {} as Record<string, unknown>;
  }
  return mesh.userData as CopilotMeshUserData;
}

export interface UseStarDiskFrameLoopParams {
  enabled: boolean;
  debugEnabled: boolean;
  meshRef: MutableRefObject<Mesh | null>;
  shaderMaterialRef: MutableRefObject<ShaderMaterial | null>;
  gameState: GameState | null | undefined;
  hazeConfig: MainSequenceStarUniformUpdate['haze'];
  boundaryConfig: MainSequenceStarUniformUpdate['boundary'];
  organicTexture: Texture | undefined;
  noiseTexture: Texture | undefined;
  viewAlignmentRef: MutableRefObject<ViewAlignment>;
  meshWorldPosition: Vector3;
  viewScratch: ViewAlignmentScratch;
  aspectWarnedRef: MutableRefObject<boolean>;
}

export function useStarDiskFrameLoop({
  enabled,
  debugEnabled,
  meshRef,
  shaderMaterialRef,
  gameState,
  hazeConfig,
  boundaryConfig,
  organicTexture,
  noiseTexture,
  viewAlignmentRef,
  meshWorldPosition,
  viewScratch,
  aspectWarnedRef,
}: UseStarDiskFrameLoopParams): void {
  const fallbackTimeRef = useRef(0);
  const lastUniformTimeRef = useRef(0);
  const previousUniformTimeRef = useRef(0);

  // Optimization: Reused objects
  const uniformUpdateRef = useRef<MainSequenceStarUniformUpdate>({
    time: 0,
    resolution: { width: 1, height: 1 },
    viewAlignment: { x: 0, y: 0, z: 1 },
    starNorth: 0,
    cameraRoll: 0,
  });

  useFrame((state, delta) => {
    if (!enabled) {
      return;
    }

    let debugWin: CopilotDebugWindow | undefined;
    if (import.meta.env.DEV) {
      debugWin =
        debugEnabled && typeof window !== 'undefined' ? (window as CopilotDebugWindow) : undefined;

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
    }

    const mat = shaderMaterialRef.current;
    if (!mat) {
      return;
    }

    if (import.meta.env.DEV && debugWin) {
      const meshLocal = meshRef.current;
      if (meshLocal) {
        try {
          const meshMaterial = meshLocal.material;
          const resolvedMaterial = Array.isArray(meshMaterial)
            ? ((meshMaterial[0] as Material | undefined) ?? null)
            : (meshMaterial ?? null);
          const materialTransparent =
            resolvedMaterial != null &&
            typeof (resolvedMaterial as { transparent?: unknown }).transparent === 'boolean'
              ? Boolean((resolvedMaterial as { transparent: boolean }).transparent)
              : false;
          const materialOpacity =
            resolvedMaterial != null &&
            typeof (resolvedMaterial as { opacity?: unknown }).opacity === 'number'
              ? (resolvedMaterial as { opacity: number }).opacity
              : null;
          const materialType = resolvedMaterial?.type ?? null;
          const wp = meshLocal.getWorldPosition
            ? meshLocal.getWorldPosition(new Vector3())
            : meshLocal.position;
          debugWin.__copilot_starMeshStatus = {
            present: true,
            visible: !!meshLocal.visible,
            renderOrder: Number(meshLocal.renderOrder || 0),
            materialType,
            materialTransparent,
            materialOpacity,
            userDataKeys: Object.keys(meshLocal.userData ?? {}),
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
    if (
      import.meta.env.DEV &&
      debugWin &&
      debugWin.__copilot_rotateCameraDeltaDeg !== undefined &&
      debugWin.__copilot_rotateCameraDeltaDeg !== null
    ) {
      const deg = Number(debugWin.__copilot_rotateCameraDeltaDeg);
      if (Number.isFinite(deg)) {
        camera.rotation.y += (deg * Math.PI) / 180;
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
    const renderClock = (
      state as { clock?: { getElapsedTime?: () => number; elapsedTime?: number } }
    ).clock;
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

    const previousRawTime = lastUniformTimeRef.current;
    let rawElapsed: number;
    const usedFallback = !(
      Number.isFinite(candidateTime) && candidateTime > previousRawTime + EPSILON
    );
    if (!usedFallback) {
      rawElapsed = candidateTime;
      fallbackTimeRef.current = rawElapsed;
    } else {
      const base = Math.max(previousRawTime, fallbackTimeRef.current);
      fallbackTimeRef.current = base + fallbackStep;
      rawElapsed = fallbackTimeRef.current;
    }

    lastUniformTimeRef.current = rawElapsed;
    const { wrapped: wrappedElapsed, cycles: wrapCycles } = wrapStarTime(rawElapsed);

    if (import.meta.env.DEV && isCopilotDebugEnabled()) {
      const now = Date.now();
      const deltaTime = rawElapsed - previousUniformTimeRef.current;
      const isProgressing = deltaTime > 0;
      const rapierDiagnostics = gameState?.simulation?.rapierDiagnostics;

      try {
        const debugGlobal = window as Window & {
          __copilot_starDiskTelemetry?: {
            iTime: number;
            rawTime?: number;
            wrapCycle?: number;
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

        const prevTelemetry = debugGlobal.__copilot_starDiskTelemetry;
        const frameCount = (prevTelemetry?.frameCount ?? 0) + 1;

        debugGlobal.__copilot_starDiskTelemetry = {
          iTime: wrappedElapsed,
          rawTime: rawElapsed,
          wrapCycle: wrapCycles,
          deltaTime,
          isProgressing,
          timestamp: now,
          frameCount,
          simTime: hasSimTime ? (simTime as number) : undefined,
          renderTime,
          usedFallback,
          rapierPanicCount: rapierDiagnostics?.stepPanics,
          lastRapierPanicTick:
            rapierDiagnostics?.lastStepPanicTick !== -1
              ? rapierDiagnostics?.lastStepPanicTick
              : undefined,
          ticksSinceLastPanic:
            rapierDiagnostics && rapierDiagnostics.lastStepPanicTick !== -1
              ? (sim?.lastTickIndex ?? 0) - rapierDiagnostics.lastStepPanicTick
              : undefined,
        };
      } catch {
        // ignore telemetry publishing errors
      }

      previousUniformTimeRef.current = rawElapsed;
    }

    const rawAspect = viewport.aspect;
    const safeAspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;
    if (safeAspect > 8 && !aspectWarnedRef.current) {
      console.warn(`[StarDisk] Unusually high viewport aspect detected: ${safeAspect.toFixed(2)}.`);
      aspectWarnedRef.current = true;
    }
    const { width, height } = state.size;

    const uniformUpdate = uniformUpdateRef.current;
    uniformUpdate.time = wrappedElapsed;
    uniformUpdate.resolution.width = Number.isFinite(width) && width > 0 ? width : 1;
    uniformUpdate.resolution.height = Number.isFinite(height) && height > 0 ? height : 1;

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
      computeViewAlignment(
        meshQuaternion,
        meshWorldPosition,
        cameraPosition,
        viewScratch,
        alignment,
      );

      if (import.meta.env.DEV && debugEnabled) {
        try {
          const pos = meshWorldPosition.clone();
          const proj = pos.project(camera);
          const ndcX = proj.x;
          const ndcY = proj.y;
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
            /* ignore */
          }
        } catch {
          /* ignore */
        }
      }
    }

    uniformUpdate.viewAlignment = alignment;
    if (hazeConfig) {
      uniformUpdate.haze = hazeConfig;
    }
    uniformUpdate.boundary = boundaryConfig;

    const cameraRotation = (camera as { rotation?: { z?: unknown } }).rotation;
    const roll =
      cameraRotation && typeof cameraRotation.z === 'number' ? cameraRotation.z : undefined;
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

    if (
      import.meta.env.DEV &&
      debugEnabled &&
      debugWin &&
      debugWin.__copilot_dumpStarDebug === true
    ) {
      try {
        const meshLocal = meshRef.current;
        const matCurrent = shaderMaterialRef.current;
        const applied = !!(meshLocal && matCurrent && meshLocal.material === matCurrent);
        const diagnosticsMaterial = meshLocal ? resolveMaterial(meshLocal.material) : null;
        const starCompiled = (globalThis as unknown as CopilotDebugWindow).__STAR_COMPILED;
        console.info('[StarDisk][DBG] dumpStarDebug', {
          iTime: uniformUpdate.time,
          applied,
          materialType: diagnosticsMaterial?.type ?? null,
          starCompiled,
        });

        if (!applied && meshLocal && matCurrent) {
          try {
            meshLocal.material = matCurrent;
            matCurrent.needsUpdate = true;
            console.info(
              '[StarDisk][DBG] Reassigned shader material to mesh and flagged needsUpdate',
            );
          } catch (e) {
            console.warn('[StarDisk][DBG] failed to reassign material', e);
          }
        }

        try {
          const win = globalThis as unknown as CopilotDebugWindow;
          const diagnosticsBuffer = (win.__copilot_starDiskDiagnostics ??= []);
          appendCappedMutable(
            diagnosticsBuffer,
            {
              time: Date.now(),
              iTime: uniformUpdate.time,
              applied,
              materialType: diagnosticsMaterial?.type ?? null,
              starCompiled,
            },
            20,
          );
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      try {
        debugWin.__copilot_dumpStarDebug = false;
      } catch {
        /* ignore */
      }
    }

    if (
      import.meta.env.DEV &&
      debugEnabled &&
      debugWin &&
      debugWin.__copilot_forceStarOnTopRequest
    ) {
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
          matImmediate.depthTest = false;
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

    if (
      import.meta.env.DEV &&
      debugEnabled &&
      debugWin &&
      debugWin.__copilot_forceStarOpaqueRequest
    ) {
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

    if (import.meta.env.DEV && debugEnabled && debugWin) {
      const meshLocal = meshRef.current;
      if (debugWin.__copilot_forceBasicMaterialRequest && meshLocal) {
        const userData = getCopilotUserData(meshLocal);
        if (!userData.__copilot_origMaterial) {
          userData.__copilot_origMaterial = resolveMaterial(meshLocal.material) ?? undefined;
        }
        const basic = new MeshBasicMaterial({
          color: '#ffffff',
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        });
        userData.__copilot_forcedMaterial = basic;
        meshLocal.material = basic;
        try {
          debugWin.__copilot_forceBasicMaterialApplied = Date.now();
        } catch {
          /* ignore */
        }
        try {
          debugWin.__copilot_forceBasicMaterialRequest = false;
        } catch {
          /* ignore */
        }
      }
      if (debugWin.__copilot_restoreOriginalStarMaterial && meshLocal) {
        const userData = getCopilotUserData(meshLocal);
        const originalMaterial = userData.__copilot_origMaterial;
        if (originalMaterial) {
          const forcedMaterial = resolveMaterial(meshLocal.material);
          forcedMaterial?.dispose();
          meshLocal.material = originalMaterial;
          delete userData.__copilot_origMaterial;
          delete userData.__copilot_forcedMaterial;
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

    if (import.meta.env.DEV && debugEnabled && debugWin && mesh) {
      if (!debugWin.__copilot_setStarBasicMaterial) {
        debugWin.__copilot_setStarBasicMaterial = (opts: { color?: string } = {}) => {
          try {
            const meshLocal = meshRef.current;
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
            debugWin.__copilot_forceBasicMaterialActive = true;
            debugWin.__copilot_forceBasicMaterialColor = color;
            debugWin.__copilot_forceBasicMaterialApplied = Date.now();
            return { applied: true };
          } catch (error) {
            return { applied: false, reason: String(error) };
          }
        };
      }

      if (!debugWin.__copilot_restoreStarMaterial) {
        debugWin.__copilot_restoreStarMaterial = () => {
          try {
            const meshLocal = meshRef.current;
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
              debugWin.__copilot_restoreOriginalStarMaterialApplied = Date.now();
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
            const meshLocal = meshRef.current;
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
            debugWin.__copilot_starLayerSetAt = Date.now();
            return { set: true, layer: idx };
          } catch (error) {
            return { set: false, reason: String(error) };
          }
        };
      }

      if (!debugWin.__copilot_resetStarLayer) {
        debugWin.__copilot_resetStarLayer = () => {
          try {
            const meshLocal = meshRef.current;
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
            debugWin.__copilot_starLayerResetAt = Date.now();
            return { reset: true };
          } catch (error) {
            return { reset: false, reason: String(error) };
          }
        };
      }
    }

    if (
      import.meta.env.DEV &&
      debugEnabled &&
      debugWin &&
      debugWin.__copilot_forceBasicMaterialActive
    ) {
      const meshLocal = meshRef.current;
      if (meshLocal) {
        const userData = getCopilotUserData(meshLocal);
        if (!userData.__copilot_origMaterial) {
          userData.__copilot_origMaterial = resolveMaterial(meshLocal.material) ?? undefined;
        }
        const activeColor =
          typeof debugWin.__copilot_forceBasicMaterialColor === 'string'
            ? debugWin.__copilot_forceBasicMaterialColor
            : '#ffffff';
        if (!userData.__copilot_forcedMaterial) {
          userData.__copilot_forcedMaterial = new MeshBasicMaterial({
            color: activeColor,
            depthTest: false,
            depthWrite: false,
            side: DoubleSide,
          });
        } else if (typeof debugWin.__copilot_forceBasicMaterialColor === 'string') {
          userData.__copilot_forcedMaterial.color.set(activeColor);
        }
        if (meshLocal.material !== userData.__copilot_forcedMaterial) {
          meshLocal.material = userData.__copilot_forcedMaterial;
        }
        debugWin.__copilot_forceBasicMaterialApplied =
          debugWin.__copilot_forceBasicMaterialApplied || Date.now();
      }
    }
  });
}
