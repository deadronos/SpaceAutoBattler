import { useMemo, useRef, useEffect } from 'react';
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
        const urlSearch = typeof window !== 'undefined' ? window.location.search : '';
        const enableDebug = process.env.NODE_ENV !== 'production' || /[?&]copilot_debug=1/.test(urlSearch);
        if (enableDebug && typeof document !== 'undefined') {
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
  }, []);

  useEffect(() => {
    const mat = shaderMaterial;
    return () => {
      if (shaderMaterialRef.current === mat) {
        shaderMaterialRef.current = null;
      }
      disposeMainSequenceStarMaterial(mat);
    };
  }, [shaderMaterial]);

  // DEV: Force the renderer to compile the scene/camera once so the
  // ShaderMaterial's onBeforeCompile hook runs and we can capture
  // program/link logs (useful when debugging invisible shaders).
  // This is intentionally gated to development builds only.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // Enable in development builds or when the special debug query
    // parameter is present. This lets us trigger compilation in
    // production-like bundles when debugging remotely.
    const urlSearch = typeof window !== 'undefined' ? window.location.search : '';
    const enableDebug = process.env.NODE_ENV !== 'production' || /[?&]copilot_debug=1/.test(urlSearch);
    if (!enableDebug) {
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
  }, [shaderMaterial, gl]);

  useBloomRegistration(meshRef, { group: 'star', active: enabled && Boolean(shaderMaterial) });

  // Make the disk always face the camera (billboard behavior)
  useFrame((state, delta) => {
    if (!enabled) {
      return;
    }
    // DEV: handle force-opaque requests early so they apply even if the
    // shader material hasn't been created yet. This sets a global flag and
    // triggers `needsUpdate` once the material exists.
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && win.__copilot_forceStarOpaqueRequest) {
        try { win.__copilot_forceStarOpaque = true; } catch { /* ignore */ }
        try {
          const mat = shaderMaterialRef.current;
          if (mat) {
            try { mat.needsUpdate = true; } catch { /* ignore */ }
            try { win.__copilot_forceStarOpaqueApplied = Date.now(); } catch { /* ignore */ }
            try { win.__copilot_forceStarOpaqueRequest = false; } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    const mat = shaderMaterialRef.current;
    if (!mat) {
      return;
    }

    // DEV: unconditional per-frame mesh status for automation (runs before
    // material checks so it captures presence/visibility early each frame)
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win) {
        const meshLocal = meshRef.current;
        if (meshLocal) {
          try {
            const mat: any = (meshLocal.material as any) || null;
            const wp = meshLocal.getWorldPosition ? meshLocal.getWorldPosition(new Vector3()) : meshLocal.position;
            win.__copilot_starMeshStatus = {
              present: true,
              visible: !!meshLocal.visible,
              renderOrder: Number(meshLocal.renderOrder || 0),
              materialType: mat ? (mat.type || null) : null,
              materialTransparent: mat ? !!mat.transparent : false,
              materialOpacity: mat && typeof mat.opacity === 'number' ? mat.opacity : null,
              userDataKeys: Object.keys(meshLocal.userData || {}),
              worldPosition: { x: wp.x, y: wp.y, z: wp.z },
              timestamp: Date.now(),
            };
          } catch { /* ignore */ }
        } else {
          try { win.__copilot_starMeshStatus = { present: false, timestamp: Date.now() }; } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    const { camera, viewport } = state;
    // DEV: allow external automation to request a small camera rotation by
    // setting `window.__copilot_rotateCameraDeltaDeg = <degrees>`. We apply
    // the rotation here (in the render loop) so the page evaluation does not
    // need to serialize functions or reach into React internals.
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && (win.__copilot_rotateCameraDeltaDeg !== undefined) && win.__copilot_rotateCameraDeltaDeg !== null) {
        const deg = Number(win.__copilot_rotateCameraDeltaDeg);
        if (Number.isFinite(deg)) {
          camera.rotation.y += deg * Math.PI / 180;
          // signal application and clear request
          try { win.__copilot_rotateAppliedAt = Date.now(); } catch { /* ignore */ }
        }
        try { win.__copilot_rotateCameraDeltaDeg = null; } catch { /* ignore */ }
      }
    } catch {
      // swallow dev-only errors
    }

    const mesh = meshRef.current;
    const meshQuaternion = mesh?.quaternion ?? null;
    const sim = gameState?.simulation;
    let elapsed: number;
    if (sim) {
      elapsed = sim.lastTickStart + sim.alpha * sim.step;
      fallbackTimeRef.current = elapsed;
    } else {
      fallbackTimeRef.current += delta;
      elapsed = fallbackTimeRef.current;
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
      try {
        const urlSearch = typeof window !== 'undefined' ? window.location.search : '';
        const enableDebug = process.env.NODE_ENV !== 'production' || /[?&]copilot_debug=1/.test(urlSearch);
        if (enableDebug) {
          const pos = meshWorldPosition.clone();
          const proj = pos.project(camera);
          const ndcX = proj.x; const ndcY = proj.y; const ndcZ = proj.z;
          const pxX = Math.round((ndcX * 0.5 + 0.5) * width);
          const pxY = Math.round(( -ndcY * 0.5 + 0.5) * height);
          // expose for automation
          try { (window as any).__copilot_star_screenPos = { ndcX, ndcY, ndcZ, pxX, pxY, width, height, timestamp: Date.now() }; } catch { /* ignore */ }

          // ensure overlay exists
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
        }
      } catch {
        // ignore projection errors in environments without window/camera
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

    // DEV: allow automation to request the StarDisk be forced on-top at runtime
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && win.__copilot_forceStarOnTopRequest) {
        try { const m = meshRef.current; if (m) { m.renderOrder = 99999; } } catch { /* ignore */ }
        try { const matImmediate = shaderMaterialRef.current; if (matImmediate) { (matImmediate as any).depthTest = false; matImmediate.depthWrite = false; } } catch { /* ignore */ }
        try { win.__copilot_star_forceOnTop = true; } catch { /* ignore */ }
        try { win.__copilot_forceStarOnTopRequest = false; } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // DEV: allow automation to request the shader be forced opaque white
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && win.__copilot_forceStarOpaqueRequest) {
        try {
          const mat = shaderMaterialRef.current;
          if (mat) {
            try { (win as any).__copilot_forceStarOpaque = true; } catch { /* ignore */ }
            try { mat.needsUpdate = true; } catch { /* ignore */ }
            try { (win as any).__copilot_forceStarOpaqueRequest = false; } catch { /* ignore */ }
            try { (win as any).__copilot_forceStarOpaqueApplied = Date.now(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // DEV: allow automation to replace the disk material at runtime with a
    // simple bright MeshBasicMaterial for diagnostics.
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && win.__copilot_forceBasicMaterialRequest) {
        try {
          const mesh = meshRef.current;
          if (mesh) {
            // store original material to allow restoration
            try {
              if (!mesh.userData.__copilot_origMaterial) {
                mesh.userData.__copilot_origMaterial = mesh.material;
              }
            } catch { /* ignore */ }

            try {
              const basic = new MeshBasicMaterial({ color: '#ffffff', depthTest: false, depthWrite: false, side: DoubleSide });
              mesh.material = basic;
              try { win.__copilot_forceBasicMaterialApplied = Date.now(); } catch { /* ignore */ }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        try { win.__copilot_forceBasicMaterialRequest = false; } catch { /* ignore */ }
      }
      // allow restoring original material via a separate request
      if (win && win.__copilot_restoreOriginalStarMaterial) {
        try {
          const mesh = meshRef.current;
          if (mesh && mesh.userData && mesh.userData.__copilot_origMaterial) {
            try { if (!(Array.isArray(mesh.material))) { (mesh.material as any).dispose(); } } catch { /* ignore */ }
            try { mesh.material = mesh.userData.__copilot_origMaterial; } catch { /* ignore */ }
            try { delete mesh.userData.__copilot_origMaterial; } catch { /* ignore */ }
            try { win.__copilot_restoreOriginalStarMaterialApplied = Date.now(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        try { win.__copilot_restoreOriginalStarMaterial = false; } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // DEV: WebGL readPixels debug — when requested, read the final framebuffer
    // pixel under the projected star coordinates and write the RGBA + luminance
    // into `window.__copilot_star_pixelRead`. This bypasses canvas drawImage and
    // gives an authoritative per-frame pixel read from the GPU framebuffer.
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (
        win &&
        win.__copilot_doPixelRead &&
        win.__copilot_star_screenPos &&
        state &&
        state.gl &&
        typeof state.gl.getContext === 'function'
      ) {
        try {
          const { pxX, pxY, width, height } = win.__copilot_star_screenPos;
          // Clamp coordinates and convert to bottom-left origin for WebGL readPixels
          const readX = Math.max(0, Math.min(Math.floor(pxX), Math.max(0, (width || state.size.width) - 1)));
          const canvasHeight = height || state.size.height;
          const readY = Math.max(0, Math.min(Math.floor(canvasHeight - 1 - pxY), Math.max(0, canvasHeight - 1)));

          const gl = state.gl.getContext();
          const buffer = new Uint8Array(4);

          // Ensure we are reading from the default framebuffer
          // NOTE: readPixels can be slow; kept gated behind debug flag to avoid perf impact
          gl.readPixels(readX, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

          const [r, g, b, a] = buffer;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          try { win.__copilot_star_pixelRead = { r, g, b, a, luminance, readX, readY, timestamp: Date.now() }; } catch {}
          // Clear the one-shot request so automation can poll the result
          try { win.__copilot_doPixelRead = false; } catch {}
        } catch (inner) {
          // swallow read errors in debug mode so normal rendering isn't affected
        }
      }
    } catch (e) {
      // ignore any unexpected global access errors
    }

    // DEV: ensure Playwright can always access helper APIs once the mesh exists
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && mesh) {
        try {
          if (!win.__copilot_setStarBasicMaterial) {
            win.__copilot_setStarBasicMaterial = (opts: any = {}) => {
              try {
                const meshLocal = meshRef.current;
                if (!meshLocal) return { applied: false, reason: 'no-mesh' };
                if (!meshLocal.userData.__copilot_origMaterial) meshLocal.userData.__copilot_origMaterial = meshLocal.material;
                const color = typeof opts.color === 'string' ? opts.color : '#ffffff';
                // Create or reuse a forced material and enable persistent active flag
                if (!meshLocal.userData.__copilot_forcedMaterial) {
                  meshLocal.userData.__copilot_forcedMaterial = new MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: DoubleSide });
                } else {
                  try { meshLocal.userData.__copilot_forcedMaterial.color.set(color); } catch { /* ignore */ }
                }
                meshLocal.material = meshLocal.userData.__copilot_forcedMaterial;
                try { win.__copilot_forceBasicMaterialActive = true; } catch { /* ignore */ }
                try { win.__copilot_forceBasicMaterialColor = color; } catch { /* ignore */ }
                try { win.__copilot_forceBasicMaterialApplied = Date.now(); } catch { /* ignore */ }
                return { applied: true };
              } catch (e) {
                return { applied: false, reason: String(e) };
              }
            };
          }
        } catch { /* ignore */ }

        try {
          if (!win.__copilot_restoreStarMaterial) {
            win.__copilot_restoreStarMaterial = () => {
              try {
                const meshLocal = meshRef.current;
                if (!meshLocal) return { restored: false, reason: 'no-mesh' };
                if (meshLocal.userData && meshLocal.userData.__copilot_origMaterial) {
                  try { if (!(Array.isArray(meshLocal.material))) { (meshLocal.material as any).dispose(); } } catch { /* ignore */ }
                  try { meshLocal.material = meshLocal.userData.__copilot_origMaterial; } catch { /* ignore */ }
                  try { delete meshLocal.userData.__copilot_origMaterial; } catch { /* ignore */ }
                  try { win.__copilot_restoreOriginalStarMaterialApplied = Date.now(); } catch { /* ignore */ }
                  return { restored: true };
                }
                return { restored: false, reason: 'no-orig' };
              } catch (e) {
                return { restored: false, reason: String(e) };
              }
            };
          }
        } catch { /* ignore */ }

        // New dev helpers: allow tests to change the mesh's render layers at runtime
        try {
          if (win && mesh) {
            try {
              // Persist the original layer mask so we can restore later
              try {
                if (!mesh.userData.__copilot_origLayerMask) {
                  // store raw mask (non-standard but available) for restoration
                  try { mesh.userData.__copilot_origLayerMask = (mesh.layers as any).mask; } catch { mesh.userData.__copilot_origLayerMask = 1; }
                }
              } catch { /* ignore */ }

              if (!win.__copilot_setStarLayer) {
                // setStarLayer(index) -> sets the mesh to a single layer index (0..31)
                win.__copilot_setStarLayer = (layerIndex: any = 0) => {
                  try {
                    const meshLocal = meshRef.current;
                    if (!meshLocal) return { set: false, reason: 'no-mesh' };
                    const n = Number(layerIndex);
                    const idx = Number.isFinite(n) ? Math.max(0, Math.min(Math.floor(n), 31)) : 0;
                    meshLocal.layers.set(idx);
                    try { win.__copilot_starLayerSetAt = Date.now(); } catch { /* ignore */ }
                    return { set: true, layer: idx };
                  } catch (e) {
                    return { set: false, reason: String(e) };
                  }
                };
              }

              if (!win.__copilot_resetStarLayer) {
                // resetStarLayer() -> restores previously persisted layer mask (best-effort)
                win.__copilot_resetStarLayer = () => {
                  try {
                    const meshLocal = meshRef.current;
                    if (!meshLocal) return { reset: false, reason: 'no-mesh' };
                    const orig = meshLocal.userData && meshLocal.userData.__copilot_origLayerMask;
                    if (typeof orig === 'number') {
                      try { (meshLocal.layers as any).mask = orig; } catch { meshLocal.layers.set(0); }
                    } else {
                      meshLocal.layers.set(0);
                    }
                    try { win.__copilot_starLayerResetAt = Date.now(); } catch { /* ignore */ }
                    return { reset: true };
                  } catch (e) {
                    return { reset: false, reason: String(e) };
                  }
                };
              }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    } catch {
      // ignore
    }

    // DEV: persistent forced basic material enforcement (active until cleared)
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win && win.__copilot_forceBasicMaterialActive) {
        try {
          const meshLocal = meshRef.current;
          if (meshLocal) {
            if (!meshLocal.userData.__copilot_origMaterial) meshLocal.userData.__copilot_origMaterial = meshLocal.material;
            if (!meshLocal.userData.__copilot_forcedMaterial) {
              const color = typeof win.__copilot_forceBasicMaterialColor === 'string' ? win.__copilot_forceBasicMaterialColor : '#ffffff';
              meshLocal.userData.__copilot_forcedMaterial = new MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: DoubleSide });
            } else {
              try { if (typeof win.__copilot_forceBasicMaterialColor === 'string') { meshLocal.userData.__copilot_forcedMaterial.color.set(win.__copilot_forceBasicMaterialColor); } } catch { /* ignore */ }
            }
            if (meshLocal.material !== meshLocal.userData.__copilot_forcedMaterial) {
              meshLocal.material = meshLocal.userData.__copilot_forcedMaterial;
            }
            try { win.__copilot_forceBasicMaterialApplied = win.__copilot_forceBasicMaterialApplied || Date.now(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  });

  if (!enabled) {
    return null;
  }

  // Dev flag: when present, force a simple bright MeshBasicMaterial so
  // we can validate geometry/transform/render pipeline visibility.
  const urlSearchForDev = typeof window !== 'undefined' ? window.location.search : '';
  const forceBasicDevMaterial = (process.env.NODE_ENV !== 'production') || /[?&]copilot_debug=1/.test(urlSearchForDev);

  return (
    <mesh ref={meshRef} position={localOffset as [number, number, number]}>
      <circleGeometry args={[defaultSize, 64]} />
      {shaderMaterial ? (
        !forceBasicDevMaterial ? (
          <primitive object={shaderMaterial as unknown as object} attach="material" />
        ) : (
          <meshBasicMaterial
            color="#ffffff"
            transparent={false}
            opacity={1}
            depthWrite={false}
            depthTest={false}
            side={DoubleSide}
          />
        )
      ) : (
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={defaultOpacity}
          depthWrite={false}
          depthTest={true}
        />
      )}

      {forceBasicDevMaterial && (
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