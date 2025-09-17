import * as THREE from 'three';
import * as logger from '../utils/logger.js';
import type { GameState, RendererHandles, Ship, Bullet } from '../types/index.js';
import { createEffectsManager } from './effects.js';
import {
  initParticleRenderer,
  renderParticleSystem as renderParticleSystemPass,
  disposeParticleRenderer,
} from './particleRenderer.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { RendererEffectsConfig } from '../config/rendererEffectsConfig.js';
import { defaultSVGConfig, getShipSVGUrl } from '../config/svgConfig.js';
import { loadSVGAsset } from '../core/svgLoader.js';
import { BulletInstancer } from './bulletInstancer.js';
import { HealthBarInstancer } from './healthBarInstancer.js';
import { shipInstancer } from './shipInstancer.js';
import { updateBillboardBars } from './overlay.js';
import {
  setCachedCameraBasis,
  setupCamera,
  attachOrbitControls,
  updateCameraPosition as cameraManagerUpdate,
  setCameraDistance,
  getCameraDistance,
  setCameraRotation,
  setCameraTarget,
  getCameraMatrix,
} from './cameraManager.js';
import { _ } from 'vitest/dist/chunks/reporters.d.BFLkQcL6.js';
import { createRNG } from '../utils/rng.js';
import { perfBegin, perfEnd } from '../utils/perf.js';
export { updateBillboardBars };

// Pool of billboard ShaderMaterials keyed by color+alpha to reduce GL state changes
const billboardMaterials = new Set<THREE.ShaderMaterial>();
const billboardMaterialPool = new Map<string, THREE.ShaderMaterial>();

// Renderer-side cache for program-like parameter introspection.
// Keyed by a renderer-owned object (usually the material instance) so it
// can be GC'd when the material/mesh is disposed.
const rendererProgramCache = new WeakMap<object, unknown>();

// Cached temporary vectors to reduce per-frame allocations
const tempCamRight = new THREE.Vector3();
const tempCamUp = new THREE.Vector3();
const tempCamForward = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();

// Note: temporary debug instrumentation removed.

export function createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles {
  // Narrow global debug helpers used by the renderer for safer casting
  type DebugHelpers = Partial<{
    __applyEffectsManagerGlobalPatches: () => void;
    __listNonInstancedMeshes: (opts?: {
      near?: { x: number; y: number; z: number; radius: number };
    }) => Record<string, unknown>[];
    __focusCameraOn: (pos: { x: number; y: number; z: number }, distance?: number) => unknown;
    scene: THREE.Scene;
    threeCamera: THREE.Camera;
    __dumpShipsNearBounds: (r?: number) => Record<string, unknown>[];
    __listInstancedHealthBarShips: () => number[];
    __listShipsWithHealthBar: () => number[];
    __hbInstancerStats: () => unknown;
    __hbDebugScale: (shipId: number) => number | null;
    __hbDebugMatrix: (shipId: number) => unknown | null;
    __hbPeriodicStart: () => void;
    __hbPeriodicStop: () => void;
  }>;
  const gAny = globalThis as unknown as DebugHelpers;
  // Lightweight mapping type used locally to avoid widespread `any` casts when
  // wiring developer helpers onto globalThis. Keeps runtime behaviour identical
  // while satisfying `@typescript-eslint/no-explicit-any` in many places.
  type LooseDict = Record<string, unknown>;
  const _G = globalThis as unknown as LooseDict;
  const rng = state.rng ?? createRNG(String(Date.now()));
  // Apply global readPixels/prototype patches early, if available.
  try {
    if (typeof gAny.__applyEffectsManagerGlobalPatches === 'function') {
      try {
        gAny.__applyEffectsManagerGlobalPatches();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  // Helper: list non-instanced meshes with world positions. Optional filter: { near: {x,y,z, radius} }
  try {
    _G.__listNonInstancedMeshes = function (opts?: {
      near?: { x: number; y: number; z: number; radius: number };
    }) {
      const out: {
        id: string | null;
        name: string | null;
        type: string | null;
        position: { x: number; y: number; z: number };
        visible: boolean;
      }[] = [];
      const groups = [shipsGroup, bulletsGroup, healthBarsGroup, shieldEffectsGroup, scene];
      const near = opts && opts.near ? opts.near : null;
      const checkNear = (p: { x: number; y: number; z: number }) => {
        if (!near) return true;
        const dx = p.x - near.x;
        const dy = p.y - near.y;
        const dz = p.z - near.z;
        return dx * dx + dy * dy + dz * dz <= (near.radius || 10) * (near.radius || 10);
      };

      groups.forEach((g) => {
        g.traverse((obj: THREE.Object3D) => {
          // skip instanced meshes
          if ((obj as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return;
          // Cast to Mesh for runtime geometry/isMesh checks
          const meshObj = obj as unknown as THREE.Mesh;
          if (!meshObj.geometry && !meshObj.isMesh) return;
          // get world position
          const wp = new THREE.Vector3();
          meshObj.getWorldPosition(wp);
          const p = { x: wp.x, y: wp.y, z: wp.z };
          if (!checkNear(p)) return;
          const rawUserId = getUserData(meshObj)?.id;
          const id =
            typeof rawUserId === 'string' || typeof rawUserId === 'number'
              ? String(rawUserId)
              : null;
          out.push({
            id,
            name: meshObj.name || null,
            type: meshObj.type || null,
            position: p,
            visible: meshObj.visible === undefined ? true : meshObj.visible,
          });
        });
      });
      console.info('[HB_DEV] Non-instanced meshes found:', out.length);
      return out;
    };
    // Temporarily highlight matching non-instanced meshes. Stores original materials in registry.
    {
      type NonInstancedEntry = {
        id: string | null;
        name: string | null;
        type: string | null;
        position: { x: number; y: number; z: number };
        visible: boolean;
      };
      const G = globalThis as unknown as Record<string, unknown>;

      G.__highlightNonInstancedMeshes = function (opts?: {
        near?: { x: number; y: number; z: number; radius: number };
        color?: number;
      }) {
        const listFn = G.__listNonInstancedMeshes as unknown as
          | ((o?: {
              near?: { x: number; y: number; z: number; radius: number };
            }) => NonInstancedEntry[])
          | undefined;
        const list = listFn ? listFn(opts) : [];
        const registryKey = '__hb_highlight_registry';
        let registry = G[registryKey] as
          | Map<THREE.Object3D, THREE.Material | THREE.Material[] | null>
          | undefined;
        if (!registry) {
          registry = new Map<THREE.Object3D, THREE.Material | THREE.Material[] | null>();
          G[registryKey] = registry;
        }
        const color = opts && opts.color ? opts.color : 0xffff00;

        list.forEach((entry) => {
          scene.traverse((o: THREE.Object3D) => {
            if (!(o as THREE.Mesh).isMesh) return;
            const mesh = o as THREE.Mesh;
            const wp = new THREE.Vector3();
            mesh.getWorldPosition(wp);
            if (
              Math.abs(wp.x - entry.position.x) < 0.001 &&
              Math.abs(wp.y - entry.position.y) < 0.001 &&
              Math.abs(wp.z - entry.position.z) < 0.001
            ) {
              if (registry!.has(mesh)) return;
              const orig = mesh.material;
              registry!.set(mesh, orig as THREE.Material | THREE.Material[] | null);
              try {
                mesh.material = new THREE.MeshBasicMaterial({ color, wireframe: true });
              } catch {
                // ignore failures creating material
              }
            }
          });
        });
        return { ok: true, count: list.length };
      } as unknown;

      G.__unhighlightNonInstancedMeshes = function () {
        const registryKey = '__hb_highlight_registry';
        const registry = G[registryKey] as
          | Map<THREE.Object3D, THREE.Material | THREE.Material[] | null>
          | undefined;
        if (!registry) return { ok: false, reason: 'none' };
        registry.forEach((orig, obj) => {
          try {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              try {
                (mesh.material as THREE.Material)?.dispose?.();
              } catch {
                logger.error('Failed disposing highlight material');
              }
              try {
                if (orig != null) {
                  mesh.material = orig as THREE.Material | THREE.Material[];
                } else {
                  mesh.material = new THREE.MeshBasicMaterial();
                }
              } catch {
                // ignore assignment errors
              }
            }
          } catch {
            // ignore per-object restore errors
          }
        });
        registry.clear();
        return { ok: true };
      } as unknown;
    }
  } catch {
    logger.error('Failed setting up __listNonInstancedMeshes');
  }

  // Diagnostic: list all scene objects that have health-bar related probe/origin markers
  try {
    // Note: legacy developer object listing removed.
  } catch {
    logger.error('Failed setting up __listInstancedHealthBarShips');
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  // Use canonical CameraState created by cameraManager
  const cameraState = setupCamera(state);
  const camera = cameraState.camera;

  // Use canonical CameraState created by cameraManager (setupCamera set initial values)

  let lastSimulatedTime = state.time; // Track last simulated time for interpolation
  const fixedSimulationDt = 1 / state.simConfig.tickRate; // Fixed timestep for simulation

  // Initial camera position already set by setupCamera
  // Attach orbit-style controls to CameraState (best-effort)
  let _orbitCtrl: { dispose: () => void } | null = null;
  try {
    _orbitCtrl = attachOrbitControls?.(cameraState, canvas as unknown as HTMLElement) ?? null;
  } catch {
    /* ignore attach failures */
  }

  // Delegate camera positioning to cameraManager's update function when needed
  function updateCameraPosition() {
    try {
      cameraManagerUpdate(cameraState);
    } catch {
      // ignore
    }
  }

  // Expose a simple helper to focus the internal camera on a world position and adjust distance
  try {
    _G.__focusCameraOn = function (pos: { x: number; y: number; z: number }, distance?: number) {
      try {
        if (!pos) return { ok: false, reason: 'no-pos' };
        // update canonical CameraState
        cameraState.target.x = pos.x;
        cameraState.target.y = pos.y;
        cameraState.target.z = pos.z;
        if (typeof distance === 'number') cameraState.distance = distance;
        // push transform
        cameraManagerUpdate(cameraState);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    };
    // Also expose scene and camera references for external scripts (read-only)
    _G.scene = scene;
    _G.threeCamera = camera;
  } catch {
    logger.error('Failed setting up __focusCameraOn');
  }

  // Procedural Skybox Generation
  function generateStarfieldTexture(
    width: number,
    height: number,
    face: string,
    seed: number,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // Prefer a context optimized for frequent readbacks (getImageData).
    // Some browsers may not support the option; fall back gracefully.
    const ctx =
      (canvas.getContext('2d', {
        willReadFrequently: true,
      } as unknown) as CanvasRenderingContext2D) || canvas.getContext('2d')!;

    // Fill with deep space background
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) / 2,
    );
    gradient.addColorStop(0, '#000011');
    gradient.addColorStop(0.5, '#000033');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Simple seeded random for consistent generation
    let rng = seed;
    const random = () => {
      rng = (rng * 9301 + 49297) % 233280;
      return rng / 233280;
    };

    // Generate stars based on face
    const starCount =
      face === 'top' || face === 'bottom'
        ? RendererEffectsConfig.skybox.starfield.starCounts.top
        : RendererEffectsConfig.skybox.starfield.starCounts.sides;
    const starColors = ['#ffffff', '#e6e6ff', '#ccccff', '#b3b3ff', '#9999ff'];

    for (let i = 0; i < starCount; i++) {
      const x = random() * width;
      const y = random() * height;

      // Vary star size and brightness
      const size = random() < 0.7 ? 1 : random() < 0.9 ? 2 : 3;
      const brightness = random();

      // Different star patterns for different faces
      let shouldDraw = true;
      if (face === 'top') {
        // Milky Way-like band across top face
        const centerDist = Math.abs(y - height / 2) / (height / 2);
        shouldDraw = random() < 1 - centerDist * 0.7;
      } else if (face === 'bottom') {
        // Sparse stars on bottom face
        shouldDraw = random() < 0.3;
      } else if (face === 'front' || face === 'back') {
        // Dense star fields on side faces
        shouldDraw = random() < 0.8;
      }

      if (shouldDraw) {
        ctx.fillStyle = starColors[Math.floor(random() * starColors.length)];
        ctx.globalAlpha = 0.3 + brightness * 0.7;

        if (size === 1) {
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Add some nebula-like structures for visual interest
    if (face === 'front' || face === 'back') {
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < RendererEffectsConfig.skybox.starfield.nebula.count; i++) {
        const nebulaX = random() * width;
        const nebulaY = random() * height;
        const nebulaRadius =
          RendererEffectsConfig.skybox.starfield.nebula.minRadius +
          random() * RendererEffectsConfig.skybox.starfield.nebula.maxRadius;

        const nebulaGradient = ctx.createRadialGradient(
          nebulaX,
          nebulaY,
          0,
          nebulaX,
          nebulaY,
          nebulaRadius,
        );
        nebulaGradient.addColorStop(0, `hsl(${200 + random() * 60}, 30%, 20%)`);
        nebulaGradient.addColorStop(0.5, `hsl(${200 + random() * 60}, 20%, 10%)`);
        nebulaGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = nebulaGradient;
        ctx.beginPath();
        ctx.arc(nebulaX, nebulaY, nebulaRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas;
  }

  // Animated Skybox System
  let skyboxAnimationTime = 0;
  const skyboxCanvases: HTMLCanvasElement[] = [];
  const skyboxTextures: THREE.CanvasTexture[] = [];

  function createAnimatedSkybox(): THREE.CubeTexture {
    const textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
    const baseSeed = RendererEffectsConfig.skybox.starfield.baseSeed;

    const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];

    // Create animated canvases and textures
    faces.forEach((face, index) => {
      const canvas = generateStarfieldTexture(textureSize, textureSize, face, baseSeed + index);
      skyboxCanvases.push(canvas);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      skyboxTextures.push(texture);
    });

    const cubeTexture = new THREE.CubeTexture(skyboxCanvases);
    cubeTexture.needsUpdate = true;

    return cubeTexture;
  }

  // Holder for optional sphere skybox so animation updater can access it
  let sphereSkybox: THREE.Mesh | null = null;

  // Precompute star fields as simple arrays so we can redraw without pixel reads
  interface StarData {
    x: number;
    y: number;
    size: number;
    color: string;
    baseBrightness: number;
  }
  const skyboxStarFields: StarData[][] = [];
  (function initStarFields() {
    const textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
    const baseSeed = RendererEffectsConfig.skybox.starfield.baseSeed;
    const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    faces.forEach((face, faceIndex) => {
      let rng = baseSeed + faceIndex;
      const random = () => {
        rng = (rng * 9301 + 49297) % 233280;
        return rng / 233280;
      };
      const starCount =
        face === 'top' || face === 'bottom'
          ? RendererEffectsConfig.skybox.starfield.starCounts.top
          : RendererEffectsConfig.skybox.starfield.starCounts.sides;
      const list: StarData[] = [];
      const starColors = ['#ffffff', '#e6e6ff', '#ccccff', '#b3b3ff', '#9999ff'];
      for (let i = 0; i < starCount; i++) {
        const x = Math.floor(random() * textureSize);
        const y = Math.floor(random() * textureSize);
        const size = random() < 0.7 ? 1 : random() < 0.9 ? 2 : 3;
        const color = starColors[Math.floor(random() * starColors.length)];
        const baseBrightness = 0.3 + random() * 0.7;
        list.push({ x, y, size, color, baseBrightness });
      }
      skyboxStarFields.push(list);
    });
  })();

  function updateSkyboxAnimation(dt: number) {
    skyboxAnimationTime += dt;
    if (
      Math.floor(skyboxAnimationTime * 10) %
        RendererEffectsConfig.skybox.starfield.animation.updateFrequency !==
      0
    )
      return;

    // const textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
    skyboxTextures.forEach((texture, index) => {
      const canvas = skyboxCanvases[index];
      const ctx = canvas.getContext('2d')!;
      // Clear and redraw background and stars from precomputed data
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Recreate gradient background quickly
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) / 2,
      );
      gradient.addColorStop(0, '#000011');
      gradient.addColorStop(0.5, '#000033');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw nebula overlays for front/back faces if needed (cheap translucent fills)
      if (index === 2 || index === 4) {
        ctx.globalAlpha = 0.08;
        for (let n = 0; n < RendererEffectsConfig.skybox.starfield.nebula.count; n++) {
          const nebX = rng.next() * canvas.width;
          const nebY = rng.next() * canvas.height;
          const nebRadius =
            RendererEffectsConfig.skybox.starfield.nebula.minRadius +
            rng.next() * RendererEffectsConfig.skybox.starfield.nebula.maxRadius;
          const nebulaGradient = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, nebRadius);
          nebulaGradient.addColorStop(0, `hsl(${200 + rng.next() * 60}, 30%, 20%)`);
          nebulaGradient.addColorStop(0.5, `hsl(${200 + rng.next() * 60}, 20%, 10%)`);
          nebulaGradient.addColorStop(1, 'transparent');
          ctx.fillStyle = nebulaGradient;
          ctx.beginPath();
          ctx.arc(nebX, nebY, nebRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw stars from precomputed list with twinkling factor
      const stars = skyboxStarFields[index] || [];
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle =
          Math.sin(
            skyboxAnimationTime * RendererEffectsConfig.skybox.starfield.animation.twinkleSpeed +
              i * 0.001,
          ) *
            0.3 +
          s.baseBrightness;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, twinkle));
        ctx.fillStyle = s.color;
        if (s.size === 1) ctx.fillRect(s.x, s.y, 1, 1);
        else {
          ctx.beginPath();
          ctx.arc(s.x + 0.5, s.y + 0.5, s.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;
      texture.needsUpdate = true;
    });

    // Update sphere skybox texture
    if (
      sphereSkybox &&
      sphereSkybox.material instanceof THREE.MeshBasicMaterial &&
      skyboxTextures.length > 0
    ) {
      (sphereSkybox.material as THREE.MeshBasicMaterial).map = skyboxTextures[0]; // Use first face for sphere
      sphereSkybox.material.needsUpdate = true;
    }
  }

  // Create animated skybox using sphere approach (more reliable than CubeTexture)
  function createSphereSkybox(): THREE.Mesh {
    const skyboxGeometry = new THREE.SphereGeometry(
      RendererEffectsConfig.skybox.sphere.radius,
      RendererEffectsConfig.skybox.sphere.geometrySegments,
      RendererEffectsConfig.skybox.sphere.geometrySegments,
    );
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      map: skyboxTextures[0], // Use first face texture for now
      side: THREE.BackSide, // Render inside of sphere
    });
    const skyboxMesh = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    return skyboxMesh;
  }

  // Create animated skybox and use it as the scene background.
  // This populates `skyboxCanvases` and `skyboxTextures` and returns a CubeTexture.
  try {
    const animatedSkyboxTexture = createAnimatedSkybox();
    scene.background = animatedSkyboxTexture;

    // Also create an interior sphere skybox that uses the first generated face texture as a fallback
    // (useful for snapshotting or when CubeTexture sampling is undesirable).
    if (skyboxTextures.length > 0) {
      sphereSkybox = createSphereSkybox();
      // Ensure the sphere uses the generated canvas texture
      if (sphereSkybox.material instanceof THREE.MeshBasicMaterial && skyboxTextures.length > 0) {
        (sphereSkybox.material as THREE.MeshBasicMaterial).map = skyboxTextures[0];
        sphereSkybox.material.needsUpdate = true;
      }
      scene.add(sphereSkybox);
    }
  } catch (e) {
    // Fallback: solid deep blue background if procedural generation fails
    logger.warn('Animated skybox generation failed, falling back to solid background', e);
    scene.background = new THREE.Color(0x000011); // Dark blue space color
    sphereSkybox = createSphereSkybox();
    scene.add(sphereSkybox);
  }

  // Add some basic lighting to help with wireframe visibility
  const ambientLight = new THREE.AmbientLight(
    RendererEffectsConfig.lighting.ambient.color,
    RendererEffectsConfig.lighting.ambient.intensity,
  );
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    RendererEffectsConfig.lighting.directional.color,
    RendererEffectsConfig.lighting.directional.intensity,
  );
  directionalLight.position.set(
    RendererEffectsConfig.lighting.directional.position.x,
    RendererEffectsConfig.lighting.directional.position.y,
    RendererEffectsConfig.lighting.directional.position.z,
  );
  scene.add(directionalLight);

  // World boundaries visualization (wireframe-only box)
  const boxGeom = new THREE.BoxGeometry(
    state.simConfig.simBounds.width,
    state.simConfig.simBounds.height,
    state.simConfig.simBounds.depth,
  );
  // Use edges geometry to display only the boundary lines (no filled interior)
  const edges = new THREE.EdgesGeometry(boxGeom);
  const lineMat = new THREE.LineBasicMaterial({
    color: RendererEffectsConfig.worldBoundaries.color,
    transparent: true,
    opacity: RendererEffectsConfig.worldBoundaries.opacity,
  });
  const boxWire = new THREE.LineSegments(edges, lineMat);
  boxWire.position.set(
    state.simConfig.simBounds.width / 2,
    state.simConfig.simBounds.height / 2,
    state.simConfig.simBounds.depth / 2,
  );
  scene.add(boxWire);

  // Containers for ships and bullets
  const shipsGroup = new THREE.Group();
  const bulletsGroup = new THREE.Group();
  const healthBarsGroup = new THREE.Group();
  const shieldEffectsGroup = new THREE.Group();
  // Instrument healthBarsGroup.add to trace unexpected Mesh additions (helpful when debugging stray bars)
  try {
    const _origHealthBarsAdd: (...objs: THREE.Object3D[]) => void = (
      healthBarsGroup as THREE.Group
    ).add.bind(healthBarsGroup as THREE.Group);
    (healthBarsGroup as unknown as { add: (...objs: THREE.Object3D[]) => void }).add = function (
      ...objs: THREE.Object3D[]
    ) {
      try {
        for (const o of objs) {
          if (!o) continue;
          // only inspect Mesh-like objects
          if ((o as THREE.Mesh).isMesh) {
            const wp = new THREE.Vector3();
            try {
              o.getWorldPosition(wp);
            } catch {
              logger.error('Failed getting world position of added health bar mesh');
            }
            // If mesh is near the known fleet Y used in formations (y=400), log a stack trace
            if (Math.abs(wp.y - 400) < 0.001) {
              try {
                console.info(
                  '[HB_TRACE][healthBarsGroup.add] adding mesh near y=400 pos=',
                  wp,
                  '\nstack=',
                  new Error().stack,
                );
              } catch {
                logger.error('Failed logging health bar add trace');
              }
            }
          }
        }
      } catch {
        logger.error('Error inspecting health bar group additions');
      }
      return _origHealthBarsAdd(...objs);
    };
  } catch {
    logger.error('Failed instrumenting healthBarsGroup.add');
  }

  // Also instrument shipsGroup.add and scene.add to catch stray Mesh additions
  try {
    const _origShipsAdd: (...objs: THREE.Object3D[]) => void = (shipsGroup as THREE.Group).add.bind(
      shipsGroup as THREE.Group,
    );
    (shipsGroup as unknown as { add: (...objs: THREE.Object3D[]) => void }).add = function (
      ...objs: THREE.Object3D[]
    ) {
      try {
        for (const o of objs) {
          if (!o) continue;
          if ((o as THREE.Mesh).isMesh) {
            const wp = new THREE.Vector3();
            try {
              o.getWorldPosition(wp);
            } catch {
              logger.error('Failed getting world position of added ship mesh');
            }
            if (Math.abs(wp.y - 400) < 0.001) {
              try {
                const _HB_TRACE_shipgroupname = _origShipsAdd.name;
                console.info(
                  '[HB_TRACE][shipsGroup.add] name=',
                  _HB_TRACE_shipgroupname,
                  ' adding mesh near y=400 pos=',
                  wp,
                  '\nstack=',
                  new Error().stack,
                );
              } catch {
                logger.error('Failed logging ships group add trace');
              }
            }
          }
        }
      } catch {
        logger.error('Error inspecting ships group additions');
      }
      return _origShipsAdd(...objs);
    };
  } catch {
    logger.error('Failed instrumenting shipsGroup.add');
  }

  try {
    const _origSceneAdd: (...objs: THREE.Object3D[]) => void = (scene as THREE.Scene).add.bind(
      scene as unknown as THREE.Scene,
    );
    (scene as unknown as { add: (...objs: THREE.Object3D[]) => void }).add = function (
      ...objs: THREE.Object3D[]
    ) {
      try {
        for (const o of objs) {
          if (!o) continue;
          if ((o as THREE.Mesh).isMesh) {
            const wp = new THREE.Vector3();
            try {
              o.getWorldPosition(wp);
            } catch {
              logger.error('Failed getting world position of added scene mesh');
            }
            if (Math.abs(wp.y - 400) < 0.001) {
              try {
                console.info(
                  '[HB_TRACE][scene.add] adding mesh near y=400 pos=',
                  wp,
                  '\nstack=',
                  new Error().stack,
                );
              } catch {
                logger.error('Failed logging scene add trace');
              }
            }
          }
        }
      } catch {
        logger.error('Error inspecting scene additions');
      }
      return _origSceneAdd(...objs);
    };
  } catch {
    logger.error('Failed instrumenting scene.add');
  }

  scene.add(shipsGroup);
  scene.add(bulletsGroup);
  scene.add(healthBarsGroup);
  scene.add(shieldEffectsGroup);

  try {
    initParticleRenderer({ state, scene });
  } catch (err) {
    logger.error('Failed to initialize particle renderer', err);
  }

  // Dev helpers: expose lightweight runtime inspection utilities on globalThis
  // These are safe no-ops in production but helpful when debugging bundled builds.
  try {
    // Guarded, opt-in GameState exposure for Playwright debugging.
    // Only enabled when URL contains ?debugState=1 or ?debugState=true to avoid accidental exposure.
    try {
      const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
      const dbg = params.get('debugState');
      if (dbg === '1' || dbg === 'true') {
        // Expose a minimal, read-only snapshot accessor that Playwright can call.
        _G.__GAME_STATE__ = {
          // Return a small snapshot with only primitive values for quick inspection
          getSnapshot: () => {
            try {
              const safeShips = state.ships.map((s: Ship) => ({
                id: s.id,
                class: s.class,
                team: s.team,
                pos: { x: s.pos?.x, y: s.pos?.y, z: s.pos?.z },
                hp: s.health ?? null,
              }));
              const safeBullets = state.bullets.map((b: Bullet) => ({
                id: b.id,
                pos: { x: b.pos?.x, y: b.pos?.y, z: b.pos?.z },
                vel: { x: b.vel?.x, y: b.vel?.y, z: b.vel?.z },
                ttl: b.ttl ?? null,
              }));
              return { ships: safeShips, bullets: safeBullets, time: Date.now() };
            } catch (e) {
              return { error: String(e) };
            }
          },
          // Convenience: shallow lists of ids for quick checks
          listShipIds: () => state.ships.map((s: Ship) => s.id),
          listBulletIds: () => state.bullets.map((b: Bullet) => b.id),
        };
        try {
          console.info('[HB_DEV] __GAME_STATE__ snapshot accessor enabled (debugState)');
        } catch (_e) {
          void _e;
        }
      }
    } catch (_e) {
      void _e;
    }
    gAny.__dumpShipsNearBounds = function (radius = 1) {
      const b = state.simConfig.simBounds;
      const near = state.ships
        .filter((s: Ship) => {
          // consider ships within `radius` units of any boundary plane
          return (
            Math.abs(s.pos.x - 0) <= radius ||
            Math.abs(s.pos.x - b.width) <= radius ||
            Math.abs(s.pos.y - 0) <= radius ||
            Math.abs(s.pos.y - b.height) <= radius ||
            Math.abs(s.pos.z - 0) <= radius ||
            Math.abs(s.pos.z - b.depth) <= radius
          );
        })
        .map((s: Ship) => ({ id: s.id, class: s.class, pos: s.pos }));
      console.info('[HB_DEV] Ships near bounds (radius=' + radius + '):', near);
      return near;
    };

    gAny.__listShipsWithHealthBar = function () {
      const ids = Array.from(healthBarMeshes.keys());
      console.info('[HB_DEV] Ships with non-instanced health bars:', ids);
      return ids;
    };
  } catch {
    logger.error('Failed setting up __dumpShipsNearBounds');
  }

  const shipMeshes = new Map<number, THREE.Object3D>();
  const bulletMeshes = new Map<number, THREE.Object3D>();
  const healthBarMeshes = new Map<number, THREE.Object3D>();
  const shieldEffectMeshes = new Map<number, THREE.Object3D>();

  // Initialize bullet instancer if enabled
  let bulletInstancer: BulletInstancer | null = null;
  if (RendererConfig.instancing.enableBullets) {
    bulletInstancer = new BulletInstancer(scene, bulletsGroup);
  }

  // Initialize health bar instancer if enabled
  let healthBarInstancer: HealthBarInstancer | null = null;
  if (RendererConfig.instancing.enableBars) {
    healthBarInstancer = new HealthBarInstancer(scene, healthBarsGroup);
  }

  // Additional dev helpers for instanced health bars (if instancer is present)
  try {
    gAny.__listInstancedHealthBarShips = function () {
      if (!healthBarInstancer) {
        console.info('[HB_DEV] instancer not enabled');
        return [];
      }
      const instDbg = healthBarInstancer as unknown as { getActiveShipIds?: () => number[] };
      const ids = instDbg.getActiveShipIds ? instDbg.getActiveShipIds() : [];
      console.info('[HB_DEV] Instanced health bar ship ids:', ids);
      return ids;
    };

    gAny.__hbInstancerStats = function () {
      if (!healthBarInstancer) return null;
      try {
        return (healthBarInstancer as unknown as { getStats?: () => unknown }).getStats?.();
      } catch {
        return null;
      }
    };

    gAny.__hbDebugScale = function (shipId: number) {
      if (!healthBarInstancer) return null;
      try {
        return (
          (
            healthBarInstancer as unknown as {
              debugGetInstanceScale?: (id: number) => number | null;
            }
          ).debugGetInstanceScale?.(shipId) ?? null
        );
      } catch {
        return null;
      }
    };

    gAny.__hbDebugMatrix = function (shipId: number) {
      if (!healthBarInstancer) return null;
      try {
        return (
          (
            healthBarInstancer as unknown as {
              debugGetInstanceMatrix?: (id: number) => unknown | null;
            }
          ).debugGetInstanceMatrix?.(shipId) ?? null
        );
      } catch {
        return null;
      }
    };

    // Note: temporary developer marker helpers removed.
  } catch {
    logger.error('Failed setting up instanced health bar dev helpers');
  }

  // Periodic dev logger - reports ships near bounds and instancer stats every intervalMs
  (function setupPeriodicDevLogger() {
    let timer: number | null = null;
    const intervalMs = 2000;

    function logOnce() {
      try {
        const G =
          typeof gAny !== 'undefined' ? gAny : (globalThis as unknown as Record<string, unknown>);
        // Safely call optional global dev helper functions if they exist and are callable.
        const dumpFn = (G as unknown as { __dumpShipsNearBounds?: (n: number) => unknown })
          .__dumpShipsNearBounds;
        const near = typeof dumpFn === 'function' ? (dumpFn(5) as unknown[]) : [];

        const listInstFn = (G as unknown as { __listInstancedHealthBarShips?: () => unknown })
          .__listInstancedHealthBarShips;
        const instIds = typeof listInstFn === 'function' ? (listInstFn() as unknown[]) : [];

        const listShipsFn = (G as unknown as { __listShipsWithHealthBar?: () => unknown })
          .__listShipsWithHealthBar;
        const nonInst = typeof listShipsFn === 'function' ? (listShipsFn() as unknown[]) : [];

        const statsFn = (G as unknown as { __hbInstancerStats?: () => unknown }).__hbInstancerStats;
        const stats = typeof statsFn === 'function' ? statsFn() : null;
        if (
          (near && near.length > 0) ||
          (instIds && instIds.length > 0) ||
          (nonInst && nonInst.length > 0)
        ) {
          console.info(
            '[HB_DEV][periodic] near=',
            near,
            'instancedIds=',
            instIds,
            'nonInst=',
            nonInst,
            'stats=',
            stats,
          );
        }
      } catch {
        logger.error('Failed logging periodic dev stats');
      }
    }

    _G.__hbPeriodicStart = function () {
      if (timer != null) return false;
      timer = window.setInterval(logOnce, intervalMs);
      return true;
    };

    _G.__hbPeriodicStop = function () {
      if (timer == null) return false;
      clearInterval(timer);
      timer = null;
      return true;
    };
  })();

  // Initialize ship instancer if enabled
  if (RendererConfig.instancing.enableShips) {
    try {
      shipInstancer.init(scene, shipsGroup);
      logger.info('Ship instancer initialized');
    } catch (e) {
      logger.warn('Ship instancer init failed', e);
    }
  }
  // Prototype registration is now handled after GLTF models are loaded in main.ts
  // to fix the timing race condition that caused placeholder models to appear.

  const GPU_BILLBOARD = true; // set to true to use shader-based billboarding for health bars
  // Helper to safely access shader-like uniforms from a material without using `any`.
  // Helper to safely access shader-like uniforms from a material without using `any`.
  // We represent uniforms as a record where each entry has a `value` field whose type is unknown.
  function getUniformsSafe(
    mat?: THREE.Material | THREE.ShaderMaterial | null,
  ): Record<string, { value: unknown }> | undefined {
    return (mat as unknown as { uniforms?: Record<string, { value: unknown }> })?.uniforms;
  }

  // Helpers to operate on the uniforms object with safe, conservative typings.
  function hasUniform(
    uniforms: Record<string, { value: unknown }> | undefined,
    name: string,
  ): boolean {
    return !!(
      uniforms &&
      Object.prototype.hasOwnProperty.call(uniforms, name) &&
      uniforms[name] !== undefined
    );
  }

  function getUniformValue<T = unknown>(
    uniforms: Record<string, { value: unknown }> | undefined,
    name: string,
  ): T | undefined {
    if (!uniforms) return undefined;
    const entry = uniforms[name];
    if (!entry) return undefined;
    return entry.value as unknown as T;
  }
  // Small helpers to safely access/ensure Object3D/Material.userData without widespread casts
  function getUserData(obj?: unknown): Record<string, unknown> | undefined {
    return (obj as { userData?: Record<string, unknown> } | undefined)?.userData;
  }

  function ensureUserData(obj?: unknown): Record<string, unknown> | undefined {
    const o = obj as { userData?: Record<string, unknown> } | undefined;
    if (!o) return undefined;
    o.userData = o.userData || {};
    return o.userData;
  }

  function setUserDataKey(obj: unknown, key: string, val: unknown): void {
    const ud = ensureUserData(obj);
    if (!ud) return;
    try {
      ud[key] = val as unknown as unknown;
    } catch {
      // ignore assignment errors in test env
    }
  }
  // Helper to attach a __renderProgram marker into material.userData without using `any` in multiple places.
  function setMaterialRenderProgram(material: THREE.Material | null | undefined, val: unknown) {
    try {
      const m = material as unknown as { userData?: Record<string, unknown> } | undefined;
      if (!m) return;
      m.userData = m.userData || {};
      m.userData.__renderProgram = val;
    } catch {
      // ignore
    }
  }
  // Helper to attach a __renderProgram marker into object.userData without using `any`.
  function setObjectRenderProgram(obj: THREE.Object3D | null | undefined, val: unknown) {
    try {
      const o = obj as unknown as { userData?: Record<string, unknown> } | undefined;
      if (!o) return;
      o.userData = o.userData || {};
      o.userData.__renderProgram = val;
    } catch {
      // ignore
    }
  }
  // Maintain a short ring buffer of recent hits per ship for hex highlight
  const recentShieldHits = new Map<
    number,
    { dir: THREE.Vector3; time: number; strength: number }[]
  >();

  function colorForTeam(team: 'red' | 'blue'): number {
    return team === 'red' ? 0xff5050 : 0x50a0ff;
  }

  function meshForShip(s: Ship): THREE.Object3D {
    const pool = state.assetPool as Map<string, unknown> | undefined;
    const svgUrl = getShipSVGUrl(s.class, defaultSVGConfig);

    const createTextured3DShip = (imageBitmap: ImageBitmap) => {
      const texture = new THREE.Texture(imageBitmap);
      texture.needsUpdate = true;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      // Set proper sRGB encoding for color textures to ensure accurate colors
      texture.colorSpace = THREE.SRGBColorSpace;

      // Create materials - textured for main surfaces, team color for others
      const teamColor = s.team === 'red' ? 0xff4444 : 0x4444ff;
      const texturedMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
      });
      const teamMaterial = new THREE.MeshBasicMaterial({
        color: teamColor,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });

      // Create a group to hold the ship parts
      const shipGroup = new THREE.Group();

      const size =
        ShipVisualConfig.ships[s.class]?.collisionRadius ?? RendererConfig.defaultCollisionRadius;

      // Main body - cylinder with SVG texture on the caps and team color on the sides
      const bodyGeometry = new THREE.CylinderGeometry(size * 0.3, size * 0.4, size * 0.8, 8);
      const bodyMaterials = [teamMaterial, texturedMaterial, texturedMaterial];
      const body = new THREE.Mesh(bodyGeometry, bodyMaterials);
      body.rotation.z = Math.PI / 2; // Orient along X-axis (nose direction)
      shipGroup.add(body);

      // Nose cone - pure team color
      const noseGeometry = new THREE.ConeGeometry(size * 0.3, size * 0.5, 8);
      const nose = new THREE.Mesh(noseGeometry, teamMaterial);
      nose.position.x = size * 0.65;
      nose.rotation.z = -Math.PI / 2; // Point along +X
      shipGroup.add(nose);

      // Wings/fins - textured planes on the sides for visibility from multiple angles
      const wingGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.4);
      const topWing = new THREE.Mesh(wingGeometry, texturedMaterial);
      topWing.position.y = size * 0.25;
      topWing.rotation.x = -Math.PI / 2;
      shipGroup.add(topWing);
      const bottomWing = new THREE.Mesh(wingGeometry, texturedMaterial);
      bottomWing.position.y = -size * 0.25;
      bottomWing.rotation.x = Math.PI / 2;
      shipGroup.add(bottomWing);

      // Side panels
      const sidePanelGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.3);
      const leftPanel = new THREE.Mesh(sidePanelGeometry, texturedMaterial);
      leftPanel.position.z = size * 0.2;
      leftPanel.rotation.y = Math.PI / 2;
      shipGroup.add(leftPanel);
      const rightPanel = new THREE.Mesh(sidePanelGeometry, texturedMaterial);
      rightPanel.position.z = -size * 0.2;
      rightPanel.rotation.y = -Math.PI / 2;
      shipGroup.add(rightPanel);

      // Rear panels and fins
      const rearPanelGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.6);
      const rearPanel = new THREE.Mesh(rearPanelGeometry, texturedMaterial);
      rearPanel.position.x = -size * 0.4;
      rearPanel.rotation.y = Math.PI;
      shipGroup.add(rearPanel);
      const rearFinGeometry = new THREE.PlaneGeometry(size * 0.3, size * 0.2);
      const topRearFin = new THREE.Mesh(rearFinGeometry, texturedMaterial);
      topRearFin.position.set(-size * 0.5, size * 0.15, 0);
      topRearFin.rotation.set(-Math.PI / 3, 0, 0);
      shipGroup.add(topRearFin);
      const bottomRearFin = new THREE.Mesh(rearFinGeometry, texturedMaterial);
      bottomRearFin.position.set(-size * 0.5, -size * 0.15, 0);
      bottomRearFin.rotation.set(Math.PI / 3, 0, 0);
      shipGroup.add(bottomRearFin);

      // Position the entire ship
      shipGroup.position.set(s.pos.x, s.pos.y, s.pos.z);
      return shipGroup;
    };

    // If we already have an asset in pool, build plane from it
    try {
      if (pool && pool.has(svgUrl)) {
        const svgAsset = pool.get(svgUrl) as { imageBitmap?: ImageBitmap } | undefined;
        if (svgAsset?.imageBitmap) return createTextured3DShip(svgAsset.imageBitmap);
      }
    } catch {
      logger.error('Error accessing asset pool for ship SVG');
    }

    // Fallback placeholder, and kick off async load to replace visual when ready
    const geom = new THREE.ConeGeometry(8, 24, 8);
    const mat = new THREE.MeshPhongMaterial({ color: colorForTeam(s.team), emissive: 0x111122 });
    const placeholder = new THREE.Mesh(geom, mat);
    placeholder.rotation.z = 0; // Will be set correctly in updateTransforms
    placeholder.position.set(s.pos.x, s.pos.y, s.pos.z);

    // Lazy-load SVG and swap geometry/material once available
    (async () => {
      try {
        // If GLTF models are enabled and a glTF prototype exists in the asset pool, skip SVG rasterization.
        try {
          const shouldUseGltf =
            (RendererConfig as { loadGltfModels?: boolean }).loadGltfModels ?? false;
          if (shouldUseGltf && state && state.assetPool) {
            const gltfKeyTeam = `ship-${s.class}-${s.team}`;
            const gltfKey = `ship-${s.class}`;
            const proto = state.assetPool.get(gltfKeyTeam) ?? state.assetPool.get(gltfKey);
            if (proto && typeof proto === 'object') {
              try {
                shipInstancer.allocate(s.id, s.class, s.team, state);
              } catch (_e) {
                void _e;
              }
              return; // skip SVG rasterization
            }
          }
        } catch (_e) {
          void _e;
        }

        const teamColor =
          s.team === 'red' ? defaultSVGConfig.teamColors.red : defaultSVGConfig.teamColors.blue;
        // If SVG subsystem has been explicitly disabled, skip rasterization and keep placeholder.
        if ((RendererConfig as { disableSvgSubsystem?: boolean }).disableSvgSubsystem) {
          logger.debug(
            '[threeRenderer] SVG subsystem disabled; skipping SVG rasterization for',
            svgUrl,
          );
          return; // keep placeholder
        }

        const asset = await loadSVGAsset(svgUrl, {
          width: defaultSVGConfig.defaultRasterSize.width,
          height: defaultSVGConfig.defaultRasterSize.height,
          teamColor: teamColor,
        });
        if (pool) pool.set(svgUrl, asset);
        if (asset?.imageBitmap && placeholder.parent) {
          const ship3D = createTextured3DShip(asset.imageBitmap);
          ship3D.position.copy(placeholder.position);
          shipsGroup.add(ship3D);
          shipsGroup.remove(placeholder);
          shipMeshes.set(s.id, ship3D);
        }
      } catch (err) {
        // Loading/parsing of SVG failed — log and keep placeholder
        logger.error('Failed to load SVG asset for ship', err);
      }
    })();

    // Return placeholder while async asset loads
    return placeholder;
  }

  function meshForBullet(b: Bullet): THREE.Object3D {
    const geom = new THREE.SphereGeometry(2.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    const mesh = new THREE.Mesh(geom, mat);
    try {
      setObjectRenderProgram(mesh, mat);
    } catch {
      /* ignore test env */
    }
    mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
    return mesh;
  }

  function createHealthBar(ship: Ship): THREE.Object3D {
    try {
      logger.info(
        `[HB_TRACE][threeRenderer] createHealthBar() called for ship=${ship?.id} class=${ship?.class} pos=${ship?.pos?.x},${ship?.pos?.y},${ship?.pos?.z}`,
      );
    } catch (_e) {
      void _e;
    }
    const config = RendererConfig.healthBars;
    const barGroup = new THREE.Group();

    // Background bar
    const bgGeom = new THREE.PlaneGeometry(config.width, config.position.height);
    let bgMat: THREE.Material;
    if (GPU_BILLBOARD) {
      const mat = getPooledBillboardMaterial(new THREE.Color(config.colors.background), 1.0);
      bgMat = mat;
    } else {
      bgMat = new THREE.MeshBasicMaterial({ color: config.colors.background });
    }
    const bgMesh = new THREE.Mesh(bgGeom, bgMat);
    try {
      setUserDataKey(
        bgMesh,
        '__renderProgram',
        (getUserData(bgMat)?.['__renderProgram'] as unknown) ?? bgMat,
      );
    } catch {
      /* ignore */
    }
    barGroup.add(bgMesh);

    // Health bar
    const healthGeom = new THREE.PlaneGeometry(config.width - 2, config.position.height - 2);
    let healthMat: THREE.Material;
    if (GPU_BILLBOARD) {
      const mat = getPooledBillboardMaterial(new THREE.Color(config.colors.health.full), 1.0);
      healthMat = mat;
    } else {
      healthMat = new THREE.MeshBasicMaterial({ color: config.colors.health.full });
    }
    const healthMesh = new THREE.Mesh(healthGeom, healthMat);
    try {
      setUserDataKey(
        healthMesh,
        '__renderProgram',
        (getUserData(healthMat)?.['__renderProgram'] as unknown) ?? healthMat,
      );
    } catch {
      /* ignore */
    }
    barGroup.add(healthMesh);

    // Shield bar (if ship has shield)
    let shieldMesh: THREE.Mesh | null = null;
    if (ship.maxShield > 0) {
      const shieldGeom = new THREE.PlaneGeometry(config.width - 2, config.position.height - 2);
      let shieldMat: THREE.Material;
      if (GPU_BILLBOARD) {
        const mat = getPooledBillboardMaterial(new THREE.Color(config.colors.shield.full), 0.8);
        shieldMat = mat;
      } else {
        shieldMat = new THREE.MeshBasicMaterial({
          color: config.colors.shield.full,
          transparent: true,
          opacity: 0.8,
        });
      }
      shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
      try {
        setUserDataKey(
          shieldMesh,
          '__renderProgram',
          (getUserData(shieldMat)?.['__renderProgram'] as unknown) ?? shieldMat,
        );
      } catch {
        /* ignore */
      }
      shieldMesh.position.z = 0.1; // slightly in front
      barGroup.add(shieldMesh);
    }

    // Border
    const borderGeom = new THREE.RingGeometry(
      config.width / 2 - config.border.width / 2,
      config.width / 2 + config.border.width / 2,
      8,
    );
    const borderMat = new THREE.MeshBasicMaterial({
      color: config.border.color,
      transparent: true,
      opacity: 0.5,
    });
    const borderMesh = new THREE.Mesh(borderGeom, borderMat);
    borderMesh.position.z = 0.2;
    barGroup.add(borderMesh);

    // Store references for updating
    setUserDataKey(barGroup, 'healthMesh', healthMesh);
    setUserDataKey(barGroup, 'shieldMesh', shieldMesh);
    setUserDataKey(barGroup, 'bgMesh', bgMesh);

    return barGroup;
  }

  // DEV LOG: inline health bar creation
  try {
    logger.info('[HB_TRACE][threeRenderer] createHealthBar defined (inline)');
  } catch {
    logger.error('Failed logging health bar creation trace');
  }

  function updateHealthBar(ship: Ship, barGroup: THREE.Object3D) {
    const config = RendererConfig.healthBars;
    const healthMesh = (barGroup as unknown as { healthMesh?: THREE.Mesh })
      .healthMesh as THREE.Mesh;
    const shieldMesh = (barGroup as unknown as { shieldMesh?: THREE.Mesh | null })
      .shieldMesh as THREE.Mesh | null;

    // Position the bar above the ship (3D) - always update position
    const newPos = {
      x: ship.pos.x + config.position.offsetX,
      y: ship.pos.y + config.position.offsetY,
      z: ship.pos.z + ShipVisualConfig.healthBar.offset.z,
    };
    try {
      if (Math.abs(newPos.y - 400) < 0.001)
        console.info(
          '[HB_TRACE][threeRenderer] updateHealthBar positioning near y=400 for ship=',
          ship.id,
          'pos=',
          newPos,
        );
    } catch (_e) {
      void _e;
    }
    barGroup.position.set(newPos.x, newPos.y, newPos.z);

    // Only update health bar if health changed (dirty flag optimization)
    if (ship._healthDirty) {
      const healthPercent = ship.health / ship.maxHealth;
      healthMesh.scale.x = Math.max(0, healthPercent);

      // Color based on health percentage
      let healthColor = config.colors.health.full;
      if (healthPercent < 0.3) {
        healthColor = config.colors.health.critical;
      } else if (healthPercent < 0.7) {
        healthColor = config.colors.health.damaged;
      }
      const hUniforms = getUniformsSafe(
        healthMesh.material as THREE.Material | THREE.ShaderMaterial,
      );
      if (GPU_BILLBOARD && hUniforms && hasUniform(hUniforms, 'uColor')) {
        const mat = healthMesh.material as THREE.ShaderMaterial;
        // Acquire pooled material for the new color/alpha and swap if different
        const alphaVal = getUniformValue<number>(hUniforms, 'uAlpha') ?? 1.0;
        const newMat = getPooledBillboardMaterial(new THREE.Color(healthColor), alphaVal);
        if (newMat !== mat) {
          (healthMesh.material as THREE.Material) = newMat;
        }
      } else {
        (healthMesh.material as THREE.MeshBasicMaterial).color.setStyle(healthColor);
      }

      // Clear dirty flag after update
      ship._healthDirty = false;
    }

    // Only update shield bar if shield changed (dirty flag optimization)
    if (ship._shieldDirty && shieldMesh && ship.maxShield > 0) {
      const shieldPercent = ship.shield / ship.maxShield;
      shieldMesh.scale.x = Math.max(0, shieldPercent);

      // Color based on shield percentage
      const shieldColor =
        shieldPercent > 0.5 ? config.colors.shield.full : config.colors.shield.damaged;
      const sUniforms = getUniformsSafe(
        shieldMesh?.material as THREE.Material | THREE.ShaderMaterial,
      );
      if (shieldMesh && GPU_BILLBOARD && sUniforms && hasUniform(sUniforms, 'uColor')) {
        const mat = shieldMesh.material as THREE.ShaderMaterial;
        const alpha = 0.8;
        const newMat = getPooledBillboardMaterial(new THREE.Color(shieldColor), alpha);
        if (newMat !== mat) {
          (shieldMesh.material as THREE.Material) = newMat;
        }
      } else if (shieldMesh) {
        (shieldMesh.material as THREE.MeshBasicMaterial).color.setStyle(shieldColor);
      }

      // Clear dirty flag after update
      ship._shieldDirty = false;
    }
  }

  function createShieldEffect(ship: Ship): THREE.Object3D {
    const config = RendererConfig.shield;
    const shieldGroup = new THREE.Group();

    // Spherical shield bubble with rim lighting and directional hit arc
    const geom = new THREE.SphereGeometry(
      (ShipVisualConfig.ships[ship.class]?.collisionRadius ?? 16) * 1.1,
      24,
      24,
    );
    const teamColor = new THREE.Color(ship.team === 'red' ? config.colors.red : config.colors.blue);

    const HIT_MAX = Math.max(1, Math.floor(RendererConfig.shield.hexGrid.hitMax));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: teamColor },
        uTime: { value: 0.0 },
        uOpacity: { value: config.opacity.base },
        // Hex grid params
        uHexDensity: { value: config.hexGrid.density },
        uEdgeWidth: { value: config.hexGrid.edgeWidth },
        // Hit arc (directional)
        uHitDir: { value: new THREE.Vector3(0, 0, 1) },
        uHitStrength: { value: 0.0 },
        // Hex hit highlighting
        uHitCount: { value: 0 },
        uHitDirs: { value: Array.from({ length: HIT_MAX }, () => new THREE.Vector3(0, 0, 1)) },
        uHitTimes: { value: new Float32Array(HIT_MAX).fill(-1000) },
        uHitStrengths: { value: new Float32Array(HIT_MAX).fill(0) },
        uHitWindow: { value: config.hexGrid.hitWindow },
        uHexSplashRadius: { value: config.hexGrid.splashRadius },
        // Ripple settings
        uRippleAmplitude: { value: config.ripple.amplitude },
        uRippleSpeed: { value: config.ripple.speed },
        uRippleFalloff: { value: config.ripple.falloff },
        // Arc params
        uArcAlignStart: { value: config.arc.alignStart },
        uArcAlignEnd: { value: config.arc.alignEnd },
        uArcAlphaScale: { value: config.arc.alphaScale },
        uArcColorScale: { value: config.arc.colorScale },
        // Damage scaling
        uDamageNormalizeBy: { value: RendererConfig.shield.damage.normalizeBy },
        uDamageMinScale: { value: RendererConfig.shield.damage.minScale },
        uDamageMaxScale: { value: RendererConfig.shield.damage.maxScale },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uHitDir;
        uniform float uHitStrength;
  uniform float uHexDensity;
        uniform float uEdgeWidth;
        uniform int uHitCount;
  uniform vec3 uHitDirs[${HIT_MAX}];
  uniform float uHitTimes[${HIT_MAX}];
  uniform float uHitStrengths[${HIT_MAX}];
        uniform float uHitWindow;
        uniform float uHexSplashRadius;
        uniform float uRippleAmplitude;
        uniform float uRippleSpeed;
        uniform float uRippleFalloff;
  uniform float uArcAlignStart;
  uniform float uArcAlignEnd;
  uniform float uArcAlphaScale;
  uniform float uArcColorScale;
  uniform float uDamageNormalizeBy;
  uniform float uDamageMinScale;
  uniform float uDamageMaxScale;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        const float PI = 3.141592653589793;

        // Map a direction vector to spherical UV (lon/lat)
        vec2 dirToUV(vec3 n) {
          n = normalize(n);
          float lon = atan(n.z, n.x); // [-pi,pi]
          float lat = asin(clamp(n.y, -1.0, 1.0)); // [-pi/2,pi/2]
          return vec2((lon + PI) / (2.0*PI), (lat + PI*0.5) / PI);
        }

        // Convert 2D axial coordinates helpers for hex grid
        // From Red Blob Games hex grid guide (cube coordinates)
        vec3 axialToCube(vec2 a){ return vec3(a.x, a.y, -a.x - a.y); }
        vec2 cubeToAxial(vec3 c){ return vec2(c.x, c.y); }
        vec3 cubeRound(vec3 h){
          vec3 rh = round(h);
          vec3 diff = abs(rh - h);
          if (diff.x > diff.y && diff.x > diff.z) rh.x = -rh.y - rh.z;
          else if (diff.y > diff.z) rh.y = -rh.x - rh.z;
          else rh.z = -rh.x - rh.y;
          return rh;
        }
        float axialDistance(vec2 a, vec2 b){
          vec3 ac = axialToCube(a);
          vec3 bc = axialToCube(b);
          return max(abs(ac.x-bc.x), max(abs(ac.y-bc.y), abs(ac.z-bc.z)));
        }
        vec2 hexAxialFromUV(vec2 uv, float density){
          // Scale UV to hex space; density ~ number around equator
          vec2 p = uv * vec2(density, density);
          float q = (sqrt(3.0)/3.0 * p.x - 1.0/3.0 * p.y);
          float r = (2.0/3.0 * p.y);
          vec3 cube = cubeRound(vec3(q, r, -q - r));
          return cubeToAxial(cube);
        }
        // Distance to hex edge for visual grid lines
        float hexEdge(vec2 uv, float density){
          vec2 p = uv * vec2(density, density);
          // Get rounded cell center in axial, then back to local offset
          float q = (sqrt(3.0)/3.0 * p.x - 1.0/3.0 * p.y);
          float r = (2.0/3.0 * p.y);
          vec3 cube = cubeRound(vec3(q, r, -q - r));
          // Convert cube center back to 2D position in p-space
          vec2 center = vec2(
            sqrt(3.0)*(cube.x + 0.5*cube.y),
            1.5*cube.y
          );
          vec2 d = p - center; d = abs(d);
          // Signed distance to regular hex with circumradius=1
          float a = dot(vec2(sqrt(3.0), 1.0), d);
          float edge = a - 1.0;
          return edge;
        }
        void main() {
          // Rim lighting based on view angle
          float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), -normalize(vViewDir))), 2.0);
          float pulse = 0.9 + 0.1 * sin(uTime * 6.28318 * 0.3);
          float alpha = uOpacity * (0.2 + 0.8 * rim) * pulse;

          // Directional hit highlight where normal aligns with hit direction
          float align = max(0.0, dot(normalize(vWorldNormal), normalize(uHitDir)));
          float arc = smoothstep(uArcAlignStart, uArcAlignEnd, align);
          vec3 col = uColor * (0.4 + 0.6 * rim);
          col += uHitStrength * arc * uArcColorScale * vec3(1.0, 0.9, 0.6);
          alpha += uHitStrength * arc * uArcAlphaScale;

          // Hex grid overlay and per-hex highlight
          vec2 uv = dirToUV(vWorldNormal);
          float edge = hexEdge(uv, uHexDensity);
          float gridLine = smoothstep(0.0, uEdgeWidth, max(0.0, -edge)); // brighten near edges
          col += gridLine * (uColor * 0.35 + vec3(0.05));

          // Highlight hex cell that matches any recent hit direction
          vec2 cell = hexAxialFromUV(uv, uHexDensity);
          float hexHighlight = 0.0;
          for (int i = 0; i < ${HIT_MAX}; i++) {
            if (i >= uHitCount) break;
            vec2 hitUv = dirToUV(normalize(uHitDirs[i]));
            vec2 hitCell = hexAxialFromUV(hitUv, uHexDensity);
            // splash within axial distance threshold
            float dist = axialDistance(hitCell, cell);
            if (dist <= uHexSplashRadius + 0.001) {
              float t = max(0.0, uTime - uHitTimes[i]);
              float s = clamp(1.0 - t / uHitWindow, 0.0, 1.0);
              // damage-scaled
              s *= clamp(uHitStrengths[i] / uDamageNormalizeBy, uDamageMinScale, uDamageMaxScale);
              // radial ripple falloff across neighbors
              s *= exp(-uRippleFalloff * dist);
              hexHighlight = max(hexHighlight, s);
            }
          }
          // Add ripple pattern expanding from impact
          float ripple = 0.0;
          for (int i = 0; i < ${HIT_MAX}; i++) {
            if (i >= uHitCount) break;
            float t = max(0.0, uTime - uHitTimes[i]);
            float w = clamp(1.0 - t / uHitWindow, 0.0, 1.0);
            // distance on sphere between this normal and impact dir
            float ang = acos(clamp(dot(normalize(vWorldNormal), normalize(uHitDirs[i])), -1.0, 1.0));
            float wave = sin(ang * 20.0 - t * uRippleSpeed * 6.28318);
            wave = max(0.0, wave) * w * uRippleAmplitude;
            ripple = max(ripple, wave);
          }
          col += hexHighlight * vec3(1.2, 1.0, 0.7) + ripple * vec3(0.6, 0.7, 1.0);
          alpha += hexHighlight * 0.5 + ripple * 0.3;

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const shieldMesh = new THREE.Mesh(geom, material);
    // Attach a stable program-like key so external systems can cache
    // parameter introspection keyed by this object.
    try {
      setMaterialRenderProgram(material, material);
    } catch {
      /* ignore */
    }
    try {
      setObjectRenderProgram(shieldMesh, material);
    } catch {
      /* ignore */
    }
    shieldGroup.add(shieldMesh);
    (shieldGroup as unknown as Record<string, unknown>).shieldMesh = shieldMesh;
    (shieldGroup as unknown as Record<string, unknown>).pulsePhase = rng.next() * Math.PI * 2;
    return shieldGroup;
  }

  function updateShieldEffect(ship: Ship, shieldGroup: THREE.Object3D, currentTime: number) {
    const config = RendererConfig.shield;
    const shieldMesh = (shieldGroup as unknown as { shieldMesh?: THREE.Mesh })
      .shieldMesh as THREE.Mesh;
    const mat = shieldMesh.material as THREE.ShaderMaterial;

    // Position the shield around the ship (3D)
    shieldGroup.position.set(ship.pos.x, ship.pos.y, ship.pos.z);

    // Scale based on ship class
    const scale = ShipVisualConfig.ships[ship.class]?.scale ?? RendererConfig.defaultScale;
    shieldGroup.scale.setScalar(scale);

    // Update uniforms
    mat.uniforms.uTime.value = currentTime;
    const shieldPercent = ship.maxShield > 0 ? ship.shield / ship.maxShield : 0;
    mat.uniforms.uOpacity.value =
      config.opacity.base * shieldPercent + config.opacity.min * (1 - shieldPercent);

    const lastHitTime = ship.lastShieldHitTime || 0;
    const hitWindow = RendererConfig.shield.hexGrid.hitWindow; // seconds
    let timeDecay = 0.0;
    if (currentTime - lastHitTime < hitWindow) {
      timeDecay = 1.0 - (currentTime - lastHitTime) / hitWindow;
      // Push into recent hits buffer for hex highlighting (avoid duplicates per hit)
      const list = recentShieldHits.get(ship.id) ?? [];
      const d = ship.lastShieldHitDir || { x: 0, y: 0, z: 1 };
      const dmg = Math.max(0, ship.lastShieldHitStrength ?? 0);
      // Only push once per unique hit time
      if (list.length === 0 || Math.abs(list[list.length - 1].time - lastHitTime) > 1e-3) {
        list.push({ dir: new THREE.Vector3(d.x, d.y, d.z), time: lastHitTime, strength: dmg });
      }
      // Keep only the most recent few and drop stale ones
      const HIT_MAX = Math.max(1, Math.floor(RendererConfig.shield.hexGrid.hitMax));
      while (list.length > HIT_MAX) list.shift();
      const pruned = list.filter((h) => currentTime - h.time <= hitWindow);
      recentShieldHits.set(ship.id, pruned);
    }
    // Scale directional arc by damage as well
    const dmgNorm = RendererConfig.shield.damage.normalizeBy;
    const dmgMin = RendererConfig.shield.damage.minScale;
    const dmgMax = RendererConfig.shield.damage.maxScale;
    const dmgScale = Math.min(dmgMax, Math.max(0.0, (ship.lastShieldHitStrength ?? 0) / dmgNorm));
    const dmgScaleClamped = Math.max(dmgMin, dmgScale);
    mat.uniforms.uHitStrength.value = timeDecay * dmgScaleClamped;
    const dir = ship.lastShieldHitDir || { x: 0, y: 0, z: 1 };
    (mat.uniforms.uHitDir.value as THREE.Vector3).set(dir.x, dir.y, dir.z).normalize();

    // Update array uniforms for hex highlights
    const list = recentShieldHits.get(ship.id) ?? [];
    const HIT_MAX = Math.max(1, Math.floor(RendererConfig.shield.hexGrid.hitMax));
    const maxN = Math.min(HIT_MAX, list.length);
    mat.uniforms.uHitCount.value = maxN;
    const uDirs = mat.uniforms.uHitDirs.value as THREE.Vector3[];
    const uTimes = mat.uniforms.uHitTimes.value as Float32Array;
    const uStrengths = mat.uniforms.uHitStrengths.value as Float32Array;
    for (let i = 0; i < HIT_MAX; i++) {
      if (i < maxN) {
        uDirs[i].copy(list[i].dir).normalize();
        uTimes[i] = list[i].time;
        uStrengths[i] = list[i].strength;
      } else {
        uDirs[i].set(0, 0, 1);
        uTimes[i] = -1000;
        uStrengths[i] = 0;
      }
    }
  }

  function syncEntities() {
    // Update camera uniforms for health bar instancer if enabled
    if (RendererConfig.instancing.enableBars && healthBarInstancer) {
      healthBarInstancer.updateCameraUniforms(camera);
    }

    // Ships
    // Previously this required shipInstancer.isReady(), but that created a circular
    // dependency (isReady only becomes true after first allocation/createGroup).
    // Allow allocate() to drive readiness transition.
    const useShipInstancing = RendererConfig.instancing.enableShips;
    for (const s of state.ships) {
      if (!shipMeshes.has(s.id)) {
        // If ship instancing is enabled and we can allocate, don't create an individual mesh
        if (useShipInstancing && shipInstancer.allocate) {
          const allocated = shipInstancer.allocate(s.id, s.class, s.team, state);
          if (allocated) {
            // create a lightweight placeholder transform via the instancer only
            shipMeshes.set(s.id, new THREE.Object3D()); // track existence
          } else {
            const m = meshForShip(s);
            shipMeshes.set(s.id, m);
            shipsGroup.add(m);
          }
        } else {
          const m = meshForShip(s);
          shipMeshes.set(s.id, m);
          shipsGroup.add(m);
        }
      }
      // Health bars
      // Guard: only create health bars for recognized ship classes and valid positions.
      // This avoids accidentally creating bars for non-ship objects or placeholders that
      // may be present in state.ships (which can show up at the world bounds/box).
      // DEV LOG: inline health bar creation
      const hasKnownClass = !!(ShipVisualConfig.ships as Record<string, unknown>)[
        s.class as string
      ];
      const posValid =
        Number.isFinite(s.pos?.x) && Number.isFinite(s.pos?.y) && Number.isFinite(s.pos?.z);
      if (RendererConfig.visual.enableHealthBars && hasKnownClass && posValid) {
        if (RendererConfig.instancing.enableBars && healthBarInstancer) {
          if (!healthBarInstancer.hasShip(s.id)) healthBarInstancer.allocateInstance(s.id);
        } else {
          if (!healthBarMeshes.has(s.id)) {
            try {
              logger.info('[HB_TRACE] calling createHealthBar for ship', s.id, 'pos', s.pos);
              logger.info(new Error('HB_STACK createHealthBar').stack);
            } catch {
              logger.error('Failed logging health bar creation trace');
            }
          }
          const bar = createHealthBar(s);
          try {
            logger.info(
              `[HB_TRACE][threeRenderer] created health bar (inline) for ship=${s.id} class=${s.class} pos=(${s.pos.x},${s.pos.y},${s.pos.z})`,
            );
          } catch {
            logger.error('Failed logging health bar creation trace');
          }
          healthBarMeshes.set(s.id, bar);
          healthBarsGroup.add(bar);
        }
      } else {
        if (RendererConfig.visual.enableHealthBars) {
          logger.warn(
            `[HealthBar Debug] (inline) Skipping health bar for ship`,
            s.id,
            `class:`,
            s.class,
            `knownClass:`,
            hasKnownClass,
            `posValid:`,
            posValid,
            `pos:`,
            s.pos,
          );
        }
      }
      // Shield effects
      if (
        RendererConfig.visual.enableShieldEffects &&
        s.maxShield > 0 &&
        !shieldEffectMeshes.has(s.id)
      ) {
        const shield = createShieldEffect(s);
        shieldEffectMeshes.set(s.id, shield);
        shieldEffectsGroup.add(shield);
      }
    }
    for (const [id, m] of shipMeshes) {
      if (!state.ships.find((s) => s.id === id)) {
        shipsGroup.remove(m);
        shipMeshes.delete(id);
        // Also remove health bar
        if (RendererConfig.instancing.enableBars && healthBarInstancer) {
          healthBarInstancer.freeInstance(id);
        } else {
          const bar = healthBarMeshes.get(id);
          if (bar) {
            healthBarsGroup.remove(bar);
            healthBarMeshes.delete(id);
          }
        }
        // Also remove shield effect
        const shield = shieldEffectMeshes.get(id);
        if (shield) {
          shieldEffectsGroup.remove(shield);
          shieldEffectMeshes.delete(id);
        }
        // Free ship instancer entry if present
        if (RendererConfig.instancing.enableShips) shipInstancer.free(id);
      }
    }
    // Remove health bars for ships that no longer exist (non-instanced only)
    if (!RendererConfig.instancing.enableBars) {
      for (const [id, bar] of healthBarMeshes) {
        if (!state.ships.find((s) => s.id === id)) {
          healthBarsGroup.remove(bar);
          healthBarMeshes.delete(id);
        }
      }
    }
    // Remove shield effects for ships that no longer exist or have no shield
    for (const [id, shield] of shieldEffectMeshes) {
      const ship = state.ships.find((s) => s.id === id);
      if (!ship || ship.maxShield <= 0) {
        shieldEffectsGroup.remove(shield);
        shieldEffectMeshes.delete(id);
      }
    }

    // Bullets - use instanced rendering if enabled, otherwise individual meshes
    if (RendererConfig.instancing.enableBullets && bulletInstancer) {
      // Instanced bullet management
      // Add new bullets to instancer
      for (const b of state.bullets) {
        if (!bulletInstancer.hasBullet(b.id)) {
          bulletInstancer.allocateInstance(b.id);
        }
      }

      // Remove bullets that no longer exist
      const currentBulletIds = new Set(state.bullets.map((b) => b.id));
      for (const bulletId of bulletInstancer.getActiveBulletIds()) {
        if (!currentBulletIds.has(bulletId)) {
          bulletInstancer.freeInstance(bulletId);
        }
      }
    } else {
      // Legacy individual mesh management
      for (const b of state.bullets) {
        if (!bulletMeshes.has(b.id)) {
          const m = meshForBullet(b);
          bulletMeshes.set(b.id, m);
          bulletsGroup.add(m);
        }
      }
      for (const [id, m] of bulletMeshes) {
        if (!state.bullets.find((b) => b.id === id)) {
          bulletsGroup.remove(m);
          bulletMeshes.delete(id);
        }
      }
    }

    // Mark instancer matrices as needing update
    if (RendererConfig.instancing.enableBars && healthBarInstancer) {
      healthBarInstancer.markMatricesNeedUpdate();
    }
    if (RendererConfig.instancing.enableShips) shipInstancer.markMatricesNeedUpdate();
  }

  function updateTransforms(interpolationFactor: number) {
    // Use simulation time for renderer-driven effects so shader hit timestamps
    // align with game state timestamps like ship.lastShieldHitTime
    const currentTime = state.time;
    // Do not gate on isReady here either; after first allocate groups exist.
    const useShipInstancing = RendererConfig.instancing.enableShips;
    // Check if interpolation is enabled
    const enableInterp = RendererConfig.enableInterpolation !== false;
    for (const s of state.ships) {
      const m = shipMeshes.get(s.id)!;
      if (!m) continue;

      let finalPos: THREE.Vector3;
      let finalOrientation: THREE.Euler;

      if (enableInterp) {
        // Interpolate position and orientation
        // Guard when prevPos is optional; fall back to current pos when missing
        let interpolatedPos: THREE.Vector3;
        if (s.prevPos) {
          interpolatedPos = new THREE.Vector3().lerpVectors(
            new THREE.Vector3(s.prevPos.x, s.prevPos.y, s.prevPos.z),
            new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z),
            interpolationFactor,
          );
        } else {
          interpolatedPos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
        }
        // Use quaternions for smooth spherical interpolation between orientations
        // Guard when prevOrientation is missing (tests may omit it); fall back to current orientation
        let interpolatedOrientationEuler: THREE.Euler;
        if (s.prevOrientation) {
          const prevEuler = new THREE.Euler(
            s.prevOrientation.pitch,
            s.prevOrientation.yaw,
            s.prevOrientation.roll,
          );
          const nextEuler = new THREE.Euler(
            s.orientation.pitch,
            s.orientation.yaw,
            s.orientation.roll,
          );
          const qPrev = new THREE.Quaternion().setFromEuler(prevEuler);
          const qNext = new THREE.Quaternion().setFromEuler(nextEuler);
          const qInterp = new THREE.Quaternion().slerpQuaternions(qPrev, qNext, interpolationFactor);
          interpolatedOrientationEuler = new THREE.Euler().setFromQuaternion(qInterp);
        } else {
          interpolatedOrientationEuler = new THREE.Euler(
            s.orientation.pitch,
            s.orientation.yaw,
            s.orientation.roll,
          );
        }
        finalPos = interpolatedPos;
        finalOrientation = interpolatedOrientationEuler;
      } else {
        // No interpolation: use current state directly
        finalPos = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
        finalOrientation = new THREE.Euler(
          s.orientation.pitch,
          s.orientation.yaw,
          s.orientation.roll,
        );
      }

      if (useShipInstancing && shipInstancer.hasShip(s.id)) {
        // Reuse a shared temp quaternion to avoid per-frame allocations
        tempQuat.setFromEuler(finalOrientation);
        const scale = ShipVisualConfig.ships[s.class]?.scale ?? RendererConfig.defaultScale;
        shipInstancer.updateTransform(s.id, finalPos, tempQuat, scale);
      } else {
        m.position.copy(finalPos);
        // Set 3D rotation using ship's orientation
        // Ships are modeled pointing along +X axis, so we need to adjust
        // Order: first yaw (Y-axis), then pitch (X-axis), then roll (Z-axis)
        m.rotation.set(
          finalOrientation.x,
          finalOrientation.y,
          finalOrientation.z,
        );

        const scale = ShipVisualConfig.ships[s.class]?.scale ?? RendererConfig.defaultScale;
        m.scale.setScalar(scale);
      }

      // Update health bar
      if (RendererConfig.visual.enableHealthBars) {
        if (RendererConfig.instancing.enableBars && healthBarInstancer) {
          // Update through health bar instancer
          healthBarInstancer.updateHealthBar(s);
        } else {
          // Update through traditional approach
          const bar = healthBarMeshes.get(s.id);
          if (bar) {
            updateHealthBar(s, bar);
          }
        }
      }

      // Update shield effect
      if (RendererConfig.visual.enableShieldEffects && s.maxShield > 0) {
        const shield = shieldEffectMeshes.get(s.id);
        if (shield) {
          updateShieldEffect(s, shield, currentTime);
        }
      }
    }

    // Update bullets - use instanced rendering if enabled, otherwise individual meshes
    if (RendererConfig.instancing.enableBullets && bulletInstancer) {
      // Update instanced bullet transforms. Some tests construct bullets with
      // only `pos` and omit `prevPos`. Guard access to avoid TypeErrors by
      // falling back to `pos` when `prevPos` is missing.
      for (const b of state.bullets) {
        let px = b.pos.x;
        let py = b.pos.y;
        let pz = b.pos.z;
        if (enableInterp && b.prevPos) {
          px = b.prevPos.x;
          py = b.prevPos.y;
          pz = b.prevPos.z;
        }
        const nx = b.pos.x;
        const ny = b.pos.y;
        const nz = b.pos.z;
        const interpolatedPos = new THREE.Vector3();
        interpolatedPos.x = px + (nx - px) * interpolationFactor;
        interpolatedPos.y = py + (ny - py) * interpolationFactor;
        interpolatedPos.z = pz + (nz - pz) * interpolationFactor;
        bulletInstancer.updateBulletTransform(b, interpolatedPos);
      }
      // Mark instance matrix as needing update once per frame
      bulletInstancer.markMatrixNeedsUpdate();
    } else {
      // Legacy individual mesh updates
      for (const b of state.bullets) {
        const m = bulletMeshes.get(b.id);
        if (m) {
          let px = b.pos.x;
          let py = b.pos.y;
          let pz = b.pos.z;
          if (enableInterp && b.prevPos) {
            px = b.prevPos.x;
            py = b.prevPos.y;
            pz = b.prevPos.z;
          }
          const nx = b.pos.x;
          const ny = b.pos.y;
          const nz = b.pos.z;
          const interpolatedPos = new THREE.Vector3();
          interpolatedPos.x = px + (nx - px) * interpolationFactor;
          interpolatedPos.y = py + (ny - py) * interpolationFactor;
          interpolatedPos.z = pz + (nz - pz) * interpolationFactor;
          m.position.copy(interpolatedPos);
        }
      }
    }

    // Update health bar positions to follow ships (non-instanced only)
    if (!RendererConfig.instancing.enableBars) {
      for (const s of state.ships) {
        const bar = healthBarMeshes.get(s.id);
        if (bar) {
          bar.position.set(
            s.pos.x + RendererConfig.healthBars.position.offsetX,
            s.pos.y + RendererConfig.healthBars.position.offsetY,
            s.pos.z + ShipVisualConfig.healthBar.offset.z, // Above the ship
          );
        }
      }
    }

    // Mark instancer matrices as needing update
    if (RendererConfig.instancing.enableBars && healthBarInstancer) {
      healthBarInstancer.markMatricesNeedUpdate();
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Prevent division by zero or very small dimensions
    if (w <= 0 || h <= 0) return;

    // Set canvas drawing buffer to the logical viewport size (unscaled by DPR).
    // Some test environments use a mock renderer that doesn't actually resize the
    // drawing buffer, so set these directly to keep behavior consistent in tests.
    try {
      canvas.width = w;
      canvas.height = h;
    } catch {
      logger.error('Failed to resize canvas');
    }

    // If available, also set the CSS size so the element visually matches the
    // layout; some browsers scale canvas using CSS which can affect the
    // projection if CSS size doesn't match the drawing buffer.
    if ((canvas as unknown as HTMLElement).style) {
      (canvas as unknown as HTMLElement).style.width = `${w}px`;
      (canvas as unknown as HTMLElement).style.height = `${h}px`;
    }

    renderer.setPixelRatio(dpr);
    // Pass `false` for updateStyle because we already set canvas.style above.
    renderer.setSize(w, h, false);

    // Camera projection must use the CSS aspect (width/height) so it matches
    // the visible canvas size regardless of devicePixelRatio.
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Update camera position via camera manager
    cameraManagerUpdate(cameraState);

    try {
      effectsManager?.resize(w, h);
    } catch {
      logger.error('Failed to resize effects manager');
    }
  }

  // Create effects manager (postprocessing) lazily
  let effectsManager: import('./effects.js').EffectsManager | null = null;
  try {
    effectsManager = createEffectsManager(
      // Conservative, runtime-neutral casts: satisfy the expected three.js types
      renderer as unknown as THREE.WebGLRenderer,
      scene as unknown as THREE.Scene,
      camera as unknown as THREE.PerspectiveCamera,
    );
  } catch {
    effectsManager = null;
  }

  function render(_dt: number) {
    // Calculate interpolation factor
    const interpolationFactor = Math.min(1, (state.time - lastSimulatedTime) / fixedSimulationDt);

    perfBegin('renderer.camera');
    // Update camera position based on current rotation, distance, and target
    updateCameraPosition();
    perfEnd('renderer.camera');

    perfBegin('renderer.sync');
    // Sync entities and update transforms
    syncEntities();
    updateTransforms(interpolationFactor);
    perfEnd('renderer.sync');

    perfBegin('renderer.healthbars');
    // Ensure no health bar remained parented to a ship (re-parent to healthBarsGroup)
    // This guarantees bars don't inherit ship rotation.
    for (const [_id, bar] of healthBarMeshes) {
      if (bar.parent !== healthBarsGroup) {
        try {
          if (bar.parent) bar.parent.remove(bar);
        } catch {
          logger.error('Failed to remove health bar from previous parent');
        }
        healthBarsGroup.add(bar);
      }
    }

    // Ensure health bars face the camera (use the runtime collection)
    if (GPU_BILLBOARD) {
      // Update shader uniforms with camera basis vectors for all billboard materials
      // Use cached temporary vectors to avoid per-frame allocations
      camera.getWorldDirection(tempCamForward);
      // Correct right vector: right = forward x up. Previous order (up x forward)
      // produced the left vector which mirrored A/D controls.
      tempCamRight.crossVectors(tempCamForward, camera.up).normalize();
      tempCamUp.copy(camera.up).normalize();
      // Cache camera basis for other systems to reuse (best-effort)
      try {
        setCachedCameraBasis(camera, {
          right: tempCamRight.clone(),
          up: tempCamUp.clone(),
          forward: tempCamForward.clone(),
        });
      } catch {
        logger.error('Failed to set cached camera basis');
      }
      for (const mat of billboardMaterials) {
        if (mat.uniforms) {
          // Use safe helper to extract and copy vector uniforms without `any`.
          const camRight = getUniformValue<THREE.Vector3>(
            mat.uniforms as unknown as Record<string, { value: unknown }>,
            'cameraRight',
          );
          if (camRight) camRight.copy(tempCamRight);
          const camUp = getUniformValue<THREE.Vector3>(
            mat.uniforms as unknown as Record<string, { value: unknown }>,
            'cameraUp',
          );
          if (camUp) camUp.copy(tempCamUp);
        }
      }
    } else {
      updateBillboardBars(Array.from(healthBarMeshes.values()), camera);
    }
    perfEnd('renderer.healthbars');

    perfBegin('renderer.skybox');
    // Update animated skybox
    updateSkyboxAnimation(_dt);
    perfEnd('renderer.skybox');

    // Update particle system (data + GPU buffers) if available
    perfBegin('renderer.particles');
    try {
      renderParticleSystemPass(_dt);
    } catch (err) {
      logger.error('Failed to render particle system', err);
    }
    perfEnd('renderer.particles');

    perfBegin('renderer.effects');
    // Prefer postprocessing composer when available
    if (effectsManager && effectsManager.initDone) {
      try {
        effectsManager.render(_dt);
        perfEnd('renderer.effects');
        return;
      } catch (e) {
        logger.warn('Effects manager render failed, falling back to default renderer', e);
      }
    }
    perfEnd('renderer.effects');

    perfBegin('renderer.culling');
    // Render the scene
    // Ensure instanced meshes have their instanceMatrix flags updated before rendering
    console.log('About to call shipInstancer.cull()');
    try {
      shipInstancer.cull(camera);
    } catch (e) {
      logger.error('Failed to cull ship instancer', e);
    }
    console.log('About to call shipInstancer.sync()');
    try {
      shipInstancer.sync();
    } catch (e) {
      logger.error('Failed to sync ship instancer', e);
    }
    perfEnd('renderer.culling');
    perfEnd('renderer.culling');

    perfBegin('renderer.webgl');
    renderer.render(scene, camera);
    perfEnd('renderer.webgl');

    lastSimulatedTime = state.time; // Update last simulated time for next frame's interpolation
  }

  window.addEventListener('resize', resize);
  resize();
  return {
    initDone: true,
    resize,
    render,
    dispose: () => {
      window.removeEventListener('resize', resize);
      try {
        effectsManager?.dispose();
      } catch {
        logger.error('Failed to dispose effects manager');
      }
      try {
        bulletInstancer?.dispose();
      } catch {
        logger.error('Failed to dispose bullet instancer');
      }
      try {
        healthBarInstancer?.dispose();
      } catch {
        logger.error('Failed to dispose health bar instancer');
      }
      try {
        disposeParticleRenderer();
      } catch (err) {
        logger.error('Failed to dispose particle renderer', err);
      }
      try {
        _orbitCtrl?.dispose();
      } catch {
        logger.error('Failed to dispose orbit controls');
      }
      renderer.dispose();
      shipMeshes.clear();
      bulletMeshes.clear();
      healthBarMeshes.clear();
      shieldEffectMeshes.clear();
      // Dispose pooled billboard materials
      for (const m of billboardMaterialPool.values()) {
        try {
          m.dispose();
        } catch {
          logger.error('Failed to dispose billboard material');
        }
      }
      billboardMaterialPool.clear();
      billboardMaterials.clear();
    },
    // Camera helpers (thin wrappers around cameraManager using internal CameraState).
    getCameraDistance(): number {
      try {
        return getCameraDistance(cameraState);
      } catch {
        return NaN;
      }
    },
    setCameraDistance(v: number): void {
      try {
        setCameraDistance(cameraState, v);
      } catch {
        /* ignore */
      }
    },
    setCameraRotation(r: { x?: number; y?: number; z?: number }): void {
      try {
        setCameraRotation(cameraState, r);
      } catch {
        /* ignore */
      }
    },
    getCameraTarget(): { x: number; y: number; z: number } {
      try {
        return { x: cameraState.target.x, y: cameraState.target.y, z: cameraState.target.z };
      } catch {
        return { x: 0, y: 0, z: 0 };
      }
    },
    setCameraTarget(t: { x?: number; y?: number; z?: number }): void {
      try {
        setCameraTarget(cameraState, t);
      } catch {
        /* ignore */
      }
    },
    getCameraRotation(): { x: number; y: number; z: number } {
      try {
        return { x: cameraState.rotation.x, y: cameraState.rotation.y, z: cameraState.rotation.z };
      } catch {
        return { x: 0, y: 0, z: 0 };
      }
    },
    getCameraMatrix(): unknown {
      try {
        return getCameraMatrix(cameraState);
      } catch {
        return null;
      }
    },
    attachOrbitControls(
      domElement: HTMLElement,
      opts?: { enableRotate?: boolean; enablePan?: boolean; enableZoom?: boolean },
    ) {
      try {
        return attachOrbitControls?.(cameraState, domElement, opts) ?? null;
      } catch {
        return null;
      }
    },
    // Expose the internal effects manager (may be null if postprocessing unavailable)
    effectsManager: effectsManager,
    // Note: internal CameraState is private to the renderer. Use the
    // camera helper methods above (`getCameraDistance`, `setCameraTarget`,
    // `attachOrbitControls`, etc.) for all external camera interactions.
    getParameters: adapterGetParameters,
    invalidateParameters: adapterInvalidateParameters,
    // Expose whether ship instancing is currently used/enabled. Tests rely on
    // this to observe readiness transitions when shipInstancer reports ready.
    getUseShipInstancing(): boolean {
      try {
        return !!(RendererConfig.instancing.enableShips &&
        shipInstancer &&
        typeof (shipInstancer as unknown as { isReady?: () => boolean }).isReady === 'function'
          ? (shipInstancer as unknown as { isReady: () => boolean }).isReady()
          : true);
      } catch {
        return false;
      }
    },
  };
}

/**
 * Updates the orientation of health/shield bars to face the camera.
 * @param bars - Array of health/shield bar meshes.
 * @param camera - The active camera.
 */

// Billboard shader: place quad in world space using camera right/up vectors so it always faces the camera.
const billboardVertexShader = `
  uniform vec3 cameraRight;
  uniform vec3 cameraUp;
  uniform float uAlpha;
  uniform vec3 uColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // center of this object in world-space
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    // position.xy are the local quad coords (e.g., -w/2..w/2, -h/2..h/2)
    vec3 worldPos = center + cameraRight * position.x + cameraUp * position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    vColor = uColor;
    vAlpha = uAlpha;
  }
`;

const billboardFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

// Helper: compute a key for the material pool based on color and alpha
function billboardPoolKey(color: THREE.Color, alpha: number) {
  // Use CSS hex + alpha to key materials
  return `${color.getHexString()}|${alpha}`;
}

// Get or create a pooled ShaderMaterial for the given color/alpha
function getPooledBillboardMaterial(
  color: THREE.Color = new THREE.Color(0xffffff),
  alpha: number = 1.0,
): THREE.ShaderMaterial {
  const key = billboardPoolKey(color, alpha);
  const existing = billboardMaterialPool.get(key);
  if (existing) return existing;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      cameraRight: { value: new THREE.Vector3(1, 0, 0) },
      cameraUp: { value: new THREE.Vector3(0, 1, 0) },
      uColor: { value: color.clone() },
      uAlpha: { value: alpha },
    },
    vertexShader: billboardVertexShader,
    fragmentShader: billboardFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Mark a stable program-like key on the material so systems can use it
  // as a canonical identity for GL program-level caching.
  try {
    // userData is an open bag on materials; assert a minimal shape to avoid `any`.
    const matUser = mat as unknown as { userData?: Record<string, unknown> };
    matUser.userData = matUser.userData || {};
    (matUser.userData as Record<string, unknown>).__renderProgram = mat;
  } catch {
    logger.error('Failed to set render program on billboard material');
  }
  billboardMaterialPool.set(key, mat);
  billboardMaterials.add(mat);
  return mat;
}

// Adapter-level helpers exposed to systems: introspect and cache parameter
// metadata about a renderer program-like object (material, wrapper, etc.).
// Return a small, serializable shape for caching/inspection.
type ProgramParams = { kind: string; uniforms?: string[]; type?: string };
function adapterGetParameters(programLike?: object | null): ProgramParams | undefined {
  if (!programLike) return undefined;
  try {
    const existing = rendererProgramCache.get(programLike as object) as ProgramParams | undefined;
    if (existing !== undefined) return existing;

    // Best-effort introspection: treat the incoming value as unknown and
    // narrow to the minimal shape we need for safe inspection.
    const p = programLike as unknown as {
      constructor?: { name?: string };
      uniforms?: Record<string, unknown> | undefined;
      type?: string;
    };

    const params: ProgramParams = {
      kind:
        p && p.constructor && typeof p.constructor.name === 'string'
          ? p.constructor.name
          : typeof programLike,
    };

    if (p && p.uniforms && typeof p.uniforms === 'object') {
      try {
        params.uniforms = Object.keys(p.uniforms as Record<string, unknown>);
      } catch {
        params.uniforms = undefined;
      }
    }
    if (p && typeof p.type === 'string') params.type = p.type;
    // Cache the synthesized metadata.
    rendererProgramCache.set(programLike as object, params);
    return params;
  } catch {
    return undefined;
  }
}

function adapterInvalidateParameters(programLike?: object | null): void {
  if (!programLike) return;
  try {
    rendererProgramCache.delete(programLike as object);
  } catch {
    /* ignore */
  }
}
