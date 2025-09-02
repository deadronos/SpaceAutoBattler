import * as THREE from 'three';
import * as logger from '../utils/logger.js';
import type { GameState, RendererHandles, Ship, Bullet } from '../types/index.js';
import { createEffectsManager } from './effects.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { RendererEffectsConfig } from '../config/rendererEffectsConfig.js';
import { loadSVGAsset } from '../core/svgLoader.js';
import { defaultSVGConfig, getShipSVGUrl } from '../config/svgConfig.js';
import { BulletInstancer } from './bulletInstancer.js';
import { HealthBarInstancer } from './healthBarInstancer.js';
import { shipInstancer } from './shipInstancer.js';
import { updateBillboardBars } from './overlay.js';
export { updateBillboardBars };
import { setCachedCameraBasis } from './cameraManager.js';

  // Pool of billboard ShaderMaterials keyed by color+alpha to reduce GL state changes
const billboardMaterials = new Set<THREE.ShaderMaterial>();
const billboardMaterialPool = new Map<string, THREE.ShaderMaterial>();

// Safely attach a program-like key to an object's userData without using `any`.
function setRenderProgram(target: object, program: unknown): void {
  try {
    const t = target as unknown as { userData?: Record<string, unknown> };
    t.userData = t.userData || {};
    (t.userData as Record<string, unknown>).__renderProgram = program;
  } catch { void 0; }
}

  // Minimal lightweight instancer interface used to avoid `any` casts in this file.
  type MinimalInstancer = Partial<{
    // Some instancers expose a boolean, others an accessor function
    isReady: boolean | (() => boolean);
    onReady: (cb: () => void) => void;
    // Bullet-related
    hasBullet: (id: number) => boolean;
    allocateInstance: (id: number) => boolean;
    getActiveBulletIds: () => number[];
    freeInstance: (id: number) => void;
    updateBulletTransform: (b: Bullet) => void;
    markMatrixNeedsUpdate: () => void;
    // Ship/health-related
    hasShip: (id: number) => boolean;
    allocate: (id: number, cls: string, team: string) => boolean;
    free: (id: number) => void;
    updateTransform: (id: number, pos: { x: number; y: number; z: number }, q: THREE.Quaternion, scale: number) => void;
    markMatricesNeedUpdate: () => void;
    // General
    sync: () => void;
    dispose: () => void;
  }>;

  // Renderer-side cache for program-like parameter introspection.
  // Keyed by a renderer-owned object (usually the material instance) so it
  // can be GC'd when the material/mesh is disposed.
  const rendererProgramCache = new WeakMap<object, unknown>();

// Cached temporary vectors to reduce per-frame allocations
const tempCamRight = new THREE.Vector3();
const tempCamUp = new THREE.Vector3(); 
const tempCamForward = new THREE.Vector3();
  // Cached, normalized camera basis exposed for consumers (avoids repeated matrix extraction)
  const cameraBasis = {
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    forward: new THREE.Vector3(0, 0, 1),
  };

import TrailManager from './effects/trailManager.js';

// Hoist getPooledBillboardMaterial to top-level scope for visibility
function getPooledBillboardMaterial(color: THREE.Color = new THREE.Color(0xffffff), alpha: number = 1.0): THREE.ShaderMaterial {
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
  try { setRenderProgram(mat, mat); } catch { void 0; }
  billboardMaterialPool.set(key, mat);
  billboardMaterials.add(mat);
  return mat;
}

// Hoist dependencies for getPooledBillboardMaterial
const billboardVertexShader = `
  uniform vec3 cameraRight;
  uniform vec3 cameraUp;
  uniform float uAlpha;
  uniform vec3 uColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
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

function billboardPoolKey(color: THREE.Color, alpha: number) {
  return `${color.getHexString()}|${alpha}`;
}

export function createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles {
  // Apply global readPixels/prototype patches early, if available.
  try {
    const g = globalThis as unknown as { __applyEffectsManagerGlobalPatches?: unknown };
    const patch = g.__applyEffectsManagerGlobalPatches as unknown;
    if (typeof patch === 'function') {
      try { (patch as unknown as () => void)(); } catch { /* swallow */ }
    }
  } catch { /* swallow */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(RendererConfig.camera.fov, canvas.clientWidth / canvas.clientHeight, RendererConfig.camera.near, RendererConfig.camera.far);

  // Initialize camera controls
  const cameraRotation = {
    x: RendererConfig.camera.rotation.pitch,
    y: RendererConfig.camera.rotation.yaw,
    z: RendererConfig.camera.rotation.roll
  };
  // Make camera distance mutable inside renderer and expose via getter/setter so callers
  // (for example `resetToCinematicView` in main.ts) can update it and the internal
  // camera positioning will pick up the change.
  let _cameraDistance = RendererConfig.camera.cameraZ;
  const cameraTarget = {
    x: state.simConfig.simBounds.width / 2,
    y: state.simConfig.simBounds.height / 2,
    z: state.simConfig.simBounds.depth / 2
  };

  // Set initial camera position using spherical coordinates
  updateCameraPosition();

  function updateCameraPosition() {
    // Clamp camera distance using renderer config if available
    const minD = (RendererConfig.camera.minDistance as number) || 1;
    const maxD = (RendererConfig.camera.maxDistance as number) || 1e7;
    if (_cameraDistance < minD) _cameraDistance = minD;
    if (_cameraDistance > maxD) _cameraDistance = maxD;

    // Normalize rotation angles to avoid drift/overflow
    // Pitch (x) should be clamped to [-pi/2 + eps, pi/2 - eps] to avoid gimbal flip
    const EPS_PITCH = 1e-3;
    cameraRotation.x = Math.max(-Math.PI / 2 + EPS_PITCH, Math.min(Math.PI / 2 - EPS_PITCH, cameraRotation.x));
    // Yaw can wrap; keep it in [-pi, pi]
    if (cameraRotation.y > Math.PI || cameraRotation.y < -Math.PI) {
      cameraRotation.y = ((cameraRotation.y + Math.PI) % (2 * Math.PI)) - Math.PI;
    }

    const x = cameraTarget.x + _cameraDistance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
    const y = cameraTarget.y + _cameraDistance * Math.sin(cameraRotation.x);
    const z = cameraTarget.z + _cameraDistance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);

    camera.position.set(x, y, z);
    camera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
    // Ensure camera's world matrix is updated immediately so downstream
    // code (billboards, basis extraction, etc.) can rely on a fresh matrix.
    // Three.js lazily updates matrixWorld during render; force it here.
    try { camera.updateMatrixWorld(true); } catch { /* ignore */ }
    // Extract and cache normalized basis vectors for other systems to reuse
    try {
      (camera.matrixWorld as THREE.Matrix4).extractBasis(tempCamRight, tempCamUp, tempCamForward);
      cameraBasis.right.copy(tempCamRight).normalize();
      cameraBasis.up.copy(tempCamUp).normalize();
      cameraBasis.forward.copy(tempCamForward).normalize();
    } catch { /* ignore */ }
    // Also attach basis to camera.userData for other modules to consume without
    // needing to extract matrices themselves. Best-effort and non-critical.
    try {
      setCachedCameraBasis(camera, cameraBasis);
    } catch { /* ignore */ }
  }

  // Procedural Skybox Generation
  function generateStarfieldTexture(width: number, height: number, face: string, seed: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  // Prefer a 2D context. Some browsers support options but they are optional in lib.dom.
  const ctx = (canvas.getContext('2d') as CanvasRenderingContext2D) || canvas.getContext('2d')!;

    // Fill with deep space background
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
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
    const starCount = face === 'top' || face === 'bottom' ? RendererEffectsConfig.skybox.starfield.starCounts.top : RendererEffectsConfig.skybox.starfield.starCounts.sides;
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
        const centerDist = Math.abs(y - height/2) / (height/2);
        shouldDraw = random() < (1 - centerDist * 0.7);
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
          ctx.arc(x, y, size/2, 0, Math.PI * 2);
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
        const nebulaRadius = RendererEffectsConfig.skybox.starfield.nebula.minRadius + random() * RendererEffectsConfig.skybox.starfield.nebula.maxRadius;

        const nebulaGradient = ctx.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, nebulaRadius);
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
  const _textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
  const baseSeed = RendererEffectsConfig.skybox.starfield.baseSeed;

    const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];

    // Create animated canvases and textures
    faces.forEach((face, index) => {
      const canvas = generateStarfieldTexture(_textureSize, _textureSize, face, baseSeed + index);
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
  interface StarData { x: number; y: number; size: number; color: string; baseBrightness: number }
  const skyboxStarFields: StarData[][] = [];
  (function initStarFields() {
    const _textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
    const baseSeed = RendererEffectsConfig.skybox.starfield.baseSeed;
    const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    faces.forEach((face, faceIndex) => {
      let rng = baseSeed + faceIndex;
      const random = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
      const starCount = face === 'top' || face === 'bottom' ? RendererEffectsConfig.skybox.starfield.starCounts.top : RendererEffectsConfig.skybox.starfield.starCounts.sides;
      const list: StarData[] = [];
      const starColors = ['#ffffff', '#e6e6ff', '#ccccff', '#b3b3ff', '#9999ff'];
      for (let i = 0; i < starCount; i++) {
  const x = Math.floor(random() * _textureSize);
  const y = Math.floor(random() * _textureSize);
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
  if (Math.floor(skyboxAnimationTime * 10) % RendererEffectsConfig.skybox.starfield.animation.updateFrequency !== 0) return undefined;

  const _textureSize = RendererEffectsConfig.skybox.starfield.textureSize;
  skyboxTextures.forEach((texture, index) => {
      const canvas = skyboxCanvases[index];
      const ctx = canvas.getContext('2d')!;
      // Clear and redraw background and stars from precomputed data
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Recreate gradient background quickly
      const gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/2);
      gradient.addColorStop(0, '#000011');
      gradient.addColorStop(0.5, '#000033');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw nebula overlays for front/back faces if needed (cheap translucent fills)
      if (index === 2 || index === 4) {
        ctx.globalAlpha = 0.08;
        for (let n = 0; n < RendererEffectsConfig.skybox.starfield.nebula.count; n++) {
          const nebX = (Math.random() * canvas.width);
          const nebY = (Math.random() * canvas.height);
          const nebRadius = RendererEffectsConfig.skybox.starfield.nebula.minRadius + Math.random() * RendererEffectsConfig.skybox.starfield.nebula.maxRadius;
          const nebulaGradient = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, nebRadius);
          nebulaGradient.addColorStop(0, `hsl(${200 + Math.random() * 60}, 30%, 20%)`);
          nebulaGradient.addColorStop(0.5, `hsl(${200 + Math.random() * 60}, 20%, 10%)`);
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
        const twinkle = Math.sin(skyboxAnimationTime * RendererEffectsConfig.skybox.starfield.animation.twinkleSpeed + i * 0.001) * 0.3 + s.baseBrightness;
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
    if (sphereSkybox && sphereSkybox.material instanceof THREE.MeshBasicMaterial && skyboxTextures.length > 0) {
      (sphereSkybox.material as THREE.MeshBasicMaterial).map = skyboxTextures[0]; // Use first face for sphere
      sphereSkybox.material.needsUpdate = true;
    }
  }

  // Create animated skybox using sphere approach (more reliable than CubeTexture)
  function createSphereSkybox(): THREE.Mesh {
    const skyboxGeometry = new THREE.SphereGeometry(
      RendererEffectsConfig.skybox.sphere.radius,
      RendererEffectsConfig.skybox.sphere.geometrySegments,
      RendererEffectsConfig.skybox.sphere.geometrySegments
    );
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      map: skyboxTextures[0], // Use first face texture for now
      side: THREE.BackSide // Render inside of sphere
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
  } catch (e) { void e;// Fallback: solid deep blue background if procedural generation fails
    logger.warn('Animated skybox generation failed, falling back to solid background', e);
    scene.background = new THREE.Color(0x000011); // Dark blue space color
    // Ensure sphereSkybox is initialized even on error
    if (!sphereSkybox) {
      sphereSkybox = createSphereSkybox();
      scene.add(sphereSkybox);
    }
  }

  // Add some basic lighting to help with wireframe visibility
  const ambientLight = new THREE.AmbientLight(
    RendererEffectsConfig.lighting.ambient.color,
    RendererEffectsConfig.lighting.ambient.intensity
  );
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    RendererEffectsConfig.lighting.directional.color,
    RendererEffectsConfig.lighting.directional.intensity
  );
  directionalLight.position.set(
    RendererEffectsConfig.lighting.directional.position.x,
    RendererEffectsConfig.lighting.directional.position.y,
    RendererEffectsConfig.lighting.directional.position.z
  );
  scene.add(directionalLight);

  // World boundaries visualization (wireframe-only box)
  const boxGeom = new THREE.BoxGeometry(state.simConfig.simBounds.width, state.simConfig.simBounds.height, state.simConfig.simBounds.depth);
  // Use edges geometry to display only the boundary lines (no filled interior)
  const edges = new THREE.EdgesGeometry(boxGeom);
  const lineMat = new THREE.LineBasicMaterial({
    color: RendererEffectsConfig.worldBoundaries.color,
    transparent: true,
    opacity: RendererEffectsConfig.worldBoundaries.opacity
  });
  const boxWire = new THREE.LineSegments(edges, lineMat);
  boxWire.position.set(state.simConfig.simBounds.width/2, state.simConfig.simBounds.height/2, state.simConfig.simBounds.depth/2);
  scene.add(boxWire);

  // Containers for ships and bullets
  const shipsGroup = new THREE.Group();
  const bulletsGroup = new THREE.Group();
  const healthBarsGroup = new THREE.Group();
  const shieldEffectsGroup = new THREE.Group();
  scene.add(shipsGroup);
  scene.add(bulletsGroup);
  scene.add(healthBarsGroup);
  scene.add(shieldEffectsGroup);
  // Per-entity object caches
  const shipMeshes = new Map<number, THREE.Object3D>();
  const bulletMeshes = new Map<number, THREE.Object3D>();
  const healthBarMeshes = new Map<number, THREE.Object3D>();
  const shieldEffectMeshes = new Map<number, THREE.Object3D>();
  // Engine trail manager
  const trailManager = new TrailManager(scene);

  let bulletInstancer: BulletInstancer | null = null;
  if (RendererConfig.instancing.enableBullets) {
    bulletInstancer = new BulletInstancer(scene, bulletsGroup);
  }
  
  // Initialize health bar instancer if enabled
  let healthBarInstancer: HealthBarInstancer | null = null;
  if (RendererConfig.instancing.enableBars) {
    healthBarInstancer = new HealthBarInstancer(scene, healthBarsGroup);
  }

  // Initialize ship instancer if enabled
  if (RendererConfig.instancing.enableShips) {
    try { shipInstancer.init(scene, shipsGroup); } catch (e) { void e;logger.warn('Ship instancer init failed', e); }
  }
  
  // Local runtime guards: only use the instanced codepaths when both the
  // configuration flag is set and the instancer object has signaled readiness.
  // This prevents switching rendering modes to instanced paths when the
  // instancer isn't ready (which results in invisible objects because the
  // instancer may have empty/hidden instance matrices).
  // Dev / feature toggles (DEV_MODE must be defined early because some
  // helper functions run during initialization and reference it).
  const DEV_MODE = (typeof window !== 'undefined' && ((window as unknown as { __DEV__?: boolean }).__DEV__ === true)) || (typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.NODE_ENV !== 'production');
  const GPU_BILLBOARD = true; // set to true to use shader-based billboarding for health bars
  let useBulletInstancing = false;
  let useHealthBarInstancing = false;
  let useShipInstancing = false;
  function instancerReady(inst: MinimalInstancer | null | undefined): boolean {
    if (!inst) return false;
    if (typeof inst.isReady === 'function') {
      try { return !!(inst.isReady as () => boolean)(); } catch (e) { void e; void e; return false; }
    }
    return !!inst.isReady;
  }

  function recomputeInstancingGuards() {
    const bInst = (bulletInstancer as unknown) as MinimalInstancer | null;
    const hInst = (healthBarInstancer as unknown) as MinimalInstancer | null;
    const sInst = (shipInstancer as unknown) as MinimalInstancer | null;

    useBulletInstancing = RendererConfig.instancing.enableBullets && !!bInst && instancerReady(bInst);
    useHealthBarInstancing = RendererConfig.instancing.enableBars && !!hInst && instancerReady(hInst);

    // For shipInstancer, check that allocate exists and readiness is true
  const shipHasAllocate = !!(typeof (sInst?.allocate) === 'function');
  const shipReady = !!instancerReady(sInst);
  useShipInstancing = !!(RendererConfig.instancing.enableShips && shipHasAllocate && shipReady);

    // DEV logging: print a concise summary of the computed guards so runtime ordering
    // issues can be diagnosed quickly when running in development.
    if (DEV_MODE) {
    try {
      console.debug('[threeRenderer] instancing guards:', {
          enableBullets: RendererConfig.instancing.enableBullets,
          bulletInstancerReady: instancerReady(bInst),
          useBulletInstancing,
          enableBars: RendererConfig.instancing.enableBars,
          healthBarInstancerReady: instancerReady(hInst),
          useHealthBarInstancing,
          enableShips: RendererConfig.instancing.enableShips,
          shipInstancerReady: shipReady,
          useShipInstancing,
        });
      } catch (e) { void e; void e; /* ignore */ }
    }
  }

  // Subscribe to instancer readiness notifications where supported so the
  // renderer can flip into the instanced codepaths only once resources are ready.
  // Subscribe to instancer readiness notifications where supported so the
  // renderer can flip into the instanced codepaths only once resources are ready.
  try {
    const bInst = (bulletInstancer as unknown) as MinimalInstancer | null;
    if (bInst && typeof bInst.onReady === 'function') bInst.onReady(() => { try { recomputeInstancingGuards(); } catch (e) { void e;logger.warn('Error recomputing bullet instancing guard', e); } });
  } catch (e) { void e; void e; /* ignore */ }
  try {
    const hInst = (healthBarInstancer as unknown) as MinimalInstancer | null;
    if (hInst && typeof hInst.onReady === 'function') hInst.onReady(() => { try { recomputeInstancingGuards(); } catch (e) { void e;logger.warn('Error recomputing health bar instancing guard', e); } });
  } catch (e) { void e; void e; /* ignore */ }
  try {
    const sInst = (shipInstancer as unknown) as MinimalInstancer | null;
    if (sInst && typeof sInst.onReady === 'function') sInst.onReady(() => { try { recomputeInstancingGuards(); } catch (e) { void e; void e; /* ignore */ } });
  } catch (e) { void e; void e; /* ignore */ }

  // Do an initial computation using current state (some instancers may already be ready)
  recomputeInstancingGuards();
  
  // Maintain a short ring buffer of recent hits per ship for hex highlight
  const recentShieldHits = new Map<number, { dir: THREE.Vector3; time: number; strength: number; }[]>();

  function colorForTeam(team: 'red' | 'blue'): number { return team === 'red' ? 0xff5050 : 0x50a0ff; }

  function meshForShip(s: Ship): THREE.Object3D {
  const pool = (state as unknown as { assetPool?: Map<string, unknown> }).assetPool;
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
        side: THREE.DoubleSide
      });
      const teamMaterial = new THREE.MeshBasicMaterial({
        color: teamColor,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });

      // Create a group to hold the ship parts
      const shipGroup = new THREE.Group();

      const size = ShipVisualConfig.ships[s.class]?.collisionRadius ?? RendererConfig.defaultCollisionRadius;

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
    if (pool && pool.has(svgUrl)) {
      // asset shape is { imageBitmap?: ImageBitmap, ... }
      const svgAssetRaw = pool.get(svgUrl);
      const svgAsset = svgAssetRaw as { imageBitmap?: ImageBitmap } | undefined;
      if (svgAsset && svgAsset.imageBitmap) {
        return createTextured3DShip(svgAsset.imageBitmap);
      }
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
        const teamColor = s.team === 'red' ? defaultSVGConfig.teamColors.red : defaultSVGConfig.teamColors.blue;
        const asset = await loadSVGAsset(svgUrl, {
          width: defaultSVGConfig.defaultRasterSize.width,
          height: defaultSVGConfig.defaultRasterSize.height,
          teamColor: teamColor
        });
        if (pool) {
          // store with a narrow shape to keep typings consistent
          pool.set(svgUrl, asset as { imageBitmap?: ImageBitmap } | undefined);
        }
        const assetTyped = asset as { imageBitmap?: ImageBitmap } | undefined;
        if (assetTyped && assetTyped.imageBitmap && placeholder.parent) {
          const ship3D = createTextured3DShip(assetTyped.imageBitmap);
          ship3D.position.copy(placeholder.position);
          shipsGroup.add(ship3D);
          shipsGroup.remove(placeholder);
          shipMeshes.set(s.id, ship3D);
        }
      } catch (e) { void e;// Loading/parsing of SVG failed — log and keep placeholder
          logger.error('Failed to load SVG asset for ship', e);
        }
    })();

    // Return placeholder while async asset loads
    return placeholder;
  }

  function meshForBullet(b: Bullet): THREE.Object3D {
    const geom = new THREE.SphereGeometry(2.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    const mesh = new THREE.Mesh(geom, mat);
  setRenderProgram(mesh, mat);
    mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
    return mesh;
  }

  // getPooledBillboardMaterial is implemented later; we'll ensure it's available before use.

  function createHealthBar(ship: Ship): THREE.Object3D {
    const config = RendererConfig.healthBars;
    // Narrow shape for bar groups to avoid 'any' casts
    type HealthBarGroup = THREE.Group & { healthMesh?: THREE.Mesh; shieldMesh?: THREE.Mesh | null; bgMesh?: THREE.Mesh };
    const barGroup = new THREE.Group() as HealthBarGroup;

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
  setRenderProgram(bgMesh, (bgMat as unknown));
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
  setRenderProgram(healthMesh, (healthMat as unknown));
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
        shieldMat = new THREE.MeshBasicMaterial({ color: config.colors.shield.full, transparent: true, opacity: 0.8 });
      }
      shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
  setRenderProgram(shieldMesh, (shieldMat as unknown));
      shieldMesh.position.z = 0.1; // slightly in front
      barGroup.add(shieldMesh);
    }

    // Border
    const borderGeom = new THREE.RingGeometry(config.width/2 - config.border.width/2, config.width/2 + config.border.width/2, 8);
    const borderMat = new THREE.MeshBasicMaterial({ color: config.border.color, transparent: true, opacity: 0.5 });
    const borderMesh = new THREE.Mesh(borderGeom, borderMat);
    borderMesh.position.z = 0.2;
    barGroup.add(borderMesh);

  // Store references for updating (typed)
  barGroup.healthMesh = healthMesh;
  barGroup.shieldMesh = shieldMesh;
  barGroup.bgMesh = bgMesh;

    return barGroup;
  }

  function updateHealthBar(ship: Ship, barGroup: THREE.Object3D) {
    const config = RendererConfig.healthBars;
    // Use typed access to avoid 'any'
    const hbGroup = barGroup as (THREE.Group & { healthMesh?: THREE.Mesh; shieldMesh?: THREE.Mesh | null });
    const healthMesh = hbGroup.healthMesh as THREE.Mesh;
    const shieldMesh = hbGroup.shieldMesh as THREE.Mesh | null;

    // Position the bar above the ship (3D) - always update position
    barGroup.position.set(
      ship.pos.x + config.position.offsetX,
      ship.pos.y + config.position.offsetY,
      ship.pos.z + ShipVisualConfig.healthBar.offset.z // Above the ship
    );

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
      if (GPU_BILLBOARD) {
        const matCandidate = healthMesh.material as THREE.Material | THREE.ShaderMaterial;
        const isShader = !!((matCandidate as THREE.ShaderMaterial).uniforms && (matCandidate as THREE.ShaderMaterial).uniforms.uColor);
        if (isShader) {
          const mat = matCandidate as THREE.ShaderMaterial;
          const newMat = getPooledBillboardMaterial(new THREE.Color(healthColor), (mat.uniforms.uAlpha?.value as number) ?? 1.0);
          if (newMat !== mat) {
            healthMesh.material = newMat as unknown as THREE.Material;
          }
        } else {
          (healthMesh.material as THREE.MeshBasicMaterial).color.setStyle(healthColor);
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
      const shieldColor = shieldPercent > 0.5 ? config.colors.shield.full : config.colors.shield.damaged;
      if (shieldMesh) {
        if (GPU_BILLBOARD) {
          const matCandidate = shieldMesh.material as THREE.Material | THREE.ShaderMaterial;
          const isShader = !!((matCandidate as THREE.ShaderMaterial).uniforms && (matCandidate as THREE.ShaderMaterial).uniforms.uColor);
          if (isShader) {
            const mat = matCandidate as THREE.ShaderMaterial;
            const alpha = 0.8;
            const newMat = getPooledBillboardMaterial(new THREE.Color(shieldColor), alpha);
            if (newMat !== mat) shieldMesh.material = newMat as unknown as THREE.Material;
          } else {
            (shieldMesh.material as THREE.MeshBasicMaterial).color.setStyle(shieldColor);
          }
        } else {
          (shieldMesh.material as THREE.MeshBasicMaterial).color.setStyle(shieldColor);
        }
      }
      
      // Clear dirty flag after update  
      ship._shieldDirty = false;
    }
  }

  // ShieldGroup typed to avoid inline 'any' casts
  type ShieldGroup = THREE.Group & { shieldMesh?: THREE.Mesh; pulsePhase?: number };
  function createShieldEffect(ship: Ship): THREE.Object3D {
    const config = RendererConfig.shield;
    const shieldGroup = new THREE.Group() as ShieldGroup;

    // Spherical shield bubble with rim lighting and directional hit arc
    const geom = new THREE.SphereGeometry( 
      (ShipVisualConfig.ships[ship.class]?.collisionRadius ?? 16) * 1.1,
      24, 24
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
        uHitDirs: { value: Array.from({ length: HIT_MAX }, () => new THREE.Vector3(0,0,1)) },
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
  try { setRenderProgram(material, material); } catch { void 0; }
  try { setRenderProgram(shieldMesh, material); } catch { void 0; }
  shieldGroup.add(shieldMesh);

    shieldGroup.shieldMesh = shieldMesh;
    shieldGroup.pulsePhase = Math.random() * Math.PI * 2;
    return shieldGroup;
  }

  function updateShieldEffect(ship: Ship, shieldGroup: THREE.Object3D, currentTime: number) {
    const config = RendererConfig.shield;
  const shieldMesh = (shieldGroup as ShieldGroup).shieldMesh as THREE.Mesh;
    const mat = shieldMesh.material as THREE.ShaderMaterial;

    // Position the shield around the ship (3D)
    shieldGroup.position.set(ship.pos.x, ship.pos.y, ship.pos.z);

    // Scale based on ship class
    const scale = ShipVisualConfig.ships[ship.class]?.scale ?? RendererConfig.defaultScale;
    shieldGroup.scale.setScalar(scale);

    // Update uniforms
    mat.uniforms.uTime.value = currentTime;
    const shieldPercent = ship.maxShield > 0 ? ship.shield / ship.maxShield : 0;
    mat.uniforms.uOpacity.value = config.opacity.base * shieldPercent + config.opacity.min * (1 - shieldPercent);

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
      const pruned = list.filter(h => currentTime - h.time <= hitWindow);
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
    const uDirs = (mat.uniforms.uHitDirs.value as THREE.Vector3[]);
    const uTimes = (mat.uniforms.uHitTimes.value as Float32Array);
    const uStrengths = (mat.uniforms.uHitStrengths.value as Float32Array);
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
    if (useHealthBarInstancing) {
      healthBarInstancer!.updateCameraUniforms(camera);
    }

    // Ships
    for (const s of state.ships) {
      if (!shipMeshes.has(s.id)) {
        // If ship instancing is enabled and we can allocate, don't create an individual mesh
        if (useShipInstancing && typeof ((shipInstancer as unknown as MinimalInstancer).allocate) === 'function') {
          const allocated = (shipInstancer as unknown as MinimalInstancer).allocate!(s.id, s.class, s.team);
          if (allocated) {
            // create a lightweight placeholder transform via the instancer only
            shipMeshes.set(s.id, new THREE.Object3D()); // track existence
          } else {
            const m = meshForShip(s);
            shipMeshes.set(s.id, m); shipsGroup.add(m);
          }
        } else {
          const m = meshForShip(s);
          shipMeshes.set(s.id, m); shipsGroup.add(m);
        }
      }
      // Health bars
      if (RendererConfig.visual.enableHealthBars) {
        if (useHealthBarInstancing) {
          // Use health bar instancer
          if (!healthBarInstancer!.hasShip(s.id)) {
            healthBarInstancer!.allocateInstance(s.id);
          }
        } else {
          // Use traditional approach
          if (!healthBarMeshes.has(s.id)) {
            const bar = createHealthBar(s);
            healthBarMeshes.set(s.id, bar); healthBarsGroup.add(bar);
          }
        }
      }
      // Shield effects
      if (RendererConfig.visual.enableShieldEffects && s.maxShield > 0 && !shieldEffectMeshes.has(s.id)) {
        const shield = createShieldEffect(s);
        shieldEffectMeshes.set(s.id, shield); shieldEffectsGroup.add(shield);
      }
    }
    for (const [id, m] of shipMeshes) {
      if (!state.ships.find(s => s.id === id)) {
        shipsGroup.remove(m); shipMeshes.delete(id);
        // Also remove health bar
        if (useHealthBarInstancing) {
          healthBarInstancer!.freeInstance(id);
        } else {
          const bar = healthBarMeshes.get(id);
          if (bar) { healthBarsGroup.remove(bar); healthBarMeshes.delete(id); }
        }
        // Also remove shield effect
        const shield = shieldEffectMeshes.get(id);
        if (shield) { shieldEffectsGroup.remove(shield); shieldEffectMeshes.delete(id); }
        // Free ship instancer entry if present
        if (useShipInstancing) shipInstancer.free(id);
      }
    }
    // Remove health bars for ships that no longer exist (non-instanced only)
    if (!RendererConfig.instancing.enableBars) {
      for (const [_id, bar] of healthBarMeshes) {
        if (!state.ships.find(s => s.id === _id)) {
            healthBarsGroup.remove(bar); healthBarMeshes.delete(_id);
          }
        }
    // Remove shield effects for ships that no longer exist or have no shield
    // Remove trails for ships that no longer exist
    try {
      const currentShipIds = new Set(state.ships.map(s => s.id));
      for (const id of Array.from(trailManager.trails.keys())) {
        if (!currentShipIds.has(id)) trailManager.remove(id);
      }
    } catch { /* ignore */ }

    // Bullets - use instanced rendering if enabled, otherwise individual meshes
    if (useBulletInstancing) {
      // Instanced bullet management
      // Add new bullets to instancer
      for (const b of state.bullets) {
        if (!bulletInstancer!.hasBullet(b.id)) {
          bulletInstancer!.allocateInstance(b.id);
        }
      }
      
      // Remove bullets that no longer exist
      const currentBulletIds = new Set(state.bullets.map(b => b.id));
      for (const bulletId of bulletInstancer!.getActiveBulletIds()) {
        if (!currentBulletIds.has(bulletId)) {
          bulletInstancer!.freeInstance(bulletId);
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
        if (!state.bullets.find(b => b.id === id)) { 
          bulletsGroup.remove(m); 
          bulletMeshes.delete(id); 
        }
      }
    }

    // Mark instancer matrices as needing update
    if (useHealthBarInstancing) {
      healthBarInstancer!.markMatricesNeedUpdate();
    }
    if (useShipInstancing) shipInstancer.markMatricesNeedUpdate();
  }

  function updateTransforms() {
    // Use simulation time for renderer-driven effects so shader hit timestamps
    // align with game state timestamps like ship.lastShieldHitTime
    const currentTime = state.time;
    for (const s of state.ships) {
      const m = shipMeshes.get(s.id)!;
      if (!m) continue;
      if (useShipInstancing && shipInstancer.hasShip(s.id)) {
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(s.orientation.pitch, s.orientation.yaw - Math.PI/2, s.orientation.roll));
        const scale = ShipVisualConfig.ships[s.class]?.scale ?? RendererConfig.defaultScale;
        shipInstancer.updateTransform(s.id, s.pos, q, scale);
      } else {
        m.position.set(s.pos.x, s.pos.y, s.pos.z);
        // Set 3D rotation using ship's orientation
        // Ships are modeled pointing along +X axis, so we need to adjust
        // Order: first yaw (Y-axis), then pitch (X-axis), then roll (Z-axis)
        m.rotation.set(s.orientation.pitch, s.orientation.yaw - Math.PI/2, s.orientation.roll);
        
        const scale = ShipVisualConfig.ships[s.class]?.scale ?? RendererConfig.defaultScale;
        m.scale.setScalar(scale);
      }

      // Update health bar
      if (RendererConfig.visual.enableHealthBars) {
          if (useHealthBarInstancing) {
            // Update through health bar instancer
            healthBarInstancer!.updateHealthBar(s);
            // DEV: log the resulting per-instance X scale to help diagnose invisible bars
            if (DEV_MODE) {
                  try {
                    const scaleX = (healthBarInstancer as unknown as { debugGetInstanceScale?: (id: number) => number | undefined })?.debugGetInstanceScale?.(s.id);
                    console.debug('[threeRenderer][DEV] healthBar instance scale', { shipId: s.id, scaleX });
                  } catch { void 0; }
            }
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
    if (useBulletInstancing) {
      // Update instanced bullet transforms
      for (const b of state.bullets) {
        bulletInstancer!.updateBulletTransform(b);
      }
      // Mark instance matrix as needing update once per frame
      bulletInstancer!.markMatrixNeedsUpdate();
    } else {
      // Legacy individual mesh updates
      for (const b of state.bullets) {
        const m = bulletMeshes.get(b.id);
        if (m) {
          m.position.set(b.pos.x, b.pos.y, b.pos.z);
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
              s.pos.z + ShipVisualConfig.healthBar.offset.z // Above the ship
          );
        }
      }
    }

    // Mark instancer matrices as needing update
    if (useHealthBarInstancing) {
      healthBarInstancer!.markMatricesNeedUpdate();
    }
  }
  // Track device pixel ratio for trails and renderer
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Create effects manager (postprocessing) lazily
  let effectsManager: import('./effects.js').EffectsManager | null = null;
  try {
    effectsManager = createEffectsManager(
      renderer as unknown as THREE.WebGLRenderer,
      scene as unknown as THREE.Scene,
      camera as unknown as THREE.PerspectiveCamera
    );
  } catch { effectsManager = null; }

  function updateBillboardUniforms() {
    try {
      // Use the cached camera basis (populated by updateCameraPosition) to update billboard materials
      for (const mat of billboardMaterials) {
        const uniforms = (mat as THREE.ShaderMaterial).uniforms as Record<string, { value: unknown }> | undefined;
        if (uniforms && uniforms.cameraRight && uniforms.cameraUp) {
          (uniforms.cameraRight.value as THREE.Vector3).copy(cameraBasis.right);
          (uniforms.cameraUp.value as THREE.Vector3).copy(cameraBasis.up);
        }
      }
    } catch { /* ignore */ }
  }

  function resize() {
    // Compute CSS pixel size of the canvas with robust fallbacks for test envs
    let w = 1, h = 1;
    try {
      const anyCanvas = canvas as unknown as { getBoundingClientRect?: () => { width: number; height: number }; clientWidth?: number; clientHeight?: number; width?: number; height?: number };
      // Prefer viewport size when available (full-window canvas behavior expected by tests)
      const vw = Math.floor((window && typeof window.innerWidth === 'number') ? window.innerWidth : 0);
      const vh = Math.floor((window && typeof window.innerHeight === 'number') ? window.innerHeight : 0);
      if (vw > 0 && vh > 0) {
        w = vw; h = vh;
      } else if (typeof anyCanvas.getBoundingClientRect === 'function') {
        const rect = anyCanvas.getBoundingClientRect();
        w = Math.max(1, Math.floor(rect.width));
        h = Math.max(1, Math.floor(rect.height));
      } else {
        // Fallback for headless/test contexts
        w = Math.max(1, Math.floor((anyCanvas.clientWidth ?? anyCanvas.width ?? 1)));
        h = Math.max(1, Math.floor((anyCanvas.clientHeight ?? anyCanvas.height ?? 1)));
      }
    } catch {
      // Final safety: use canvas width/height or sensible defaults
      const anyCanvas = canvas as unknown as { clientWidth?: number; clientHeight?: number; width?: number; height?: number };
      w = Math.max(1, Math.floor((anyCanvas.clientWidth ?? anyCanvas.width ?? 1)));
      h = Math.max(1, Math.floor((anyCanvas.clientHeight ?? anyCanvas.height ?? 1)));
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    try { renderer.setPixelRatio(dpr); } catch { /* ignore */ }
    try { renderer.setSize(w, h, false); } catch { /* ignore */ }
    try { trailManager.setPixelRatio(dpr); } catch { /* ignore */ }
    // Ensure the backing canvas element reflects the CSS size for tests/environments
    try {
      const anyCanvas = canvas as unknown as { width?: number; height?: number };
      if (typeof anyCanvas.width === 'number') anyCanvas.width = w;
      if (typeof anyCanvas.height === 'number') anyCanvas.height = h;
    } catch { /* ignore */ }

    // Camera projection must use the CSS aspect (width/height) so it matches
    // the visible canvas size regardless of devicePixelRatio.
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateCameraPosition();

    try { effectsManager?.resize(w, h); } catch { /* ignore */ }
  }

  function render(_dt: number) {
    // Ensure camera follows external updates to rotation/target/distance
    updateCameraPosition();
    // Drive animated skybox and entity sync
    updateSkyboxAnimation(_dt);
    syncEntities();
    updateTransforms();
    updateBillboardUniforms();

    // Update engine trails before rendering
    try { trailManager.update(state.ships, _dt); } catch { /* ignore */ }

    // Prefer postprocessing composer when available
    if (effectsManager && effectsManager.initDone) {
        try {
        effectsManager.render(_dt);
        return undefined;
      } catch (e) {
        void e; logger.warn('Effects manager render failed, falling back to default renderer', e as unknown);
      }
    }

    // Ensure instanced meshes have their instanceMatrix flags updated before rendering
    try { shipInstancer.sync(); } catch { /* ignore instancer sync errors */ }
    renderer.render(scene, camera);
  }

  function dispose() {
    try { trailManager.dispose(); } catch { /* ignore */ }
    // Clear entity mesh maps
    try { shipMeshes.clear(); } catch { /* ignore */ }
    try { bulletMeshes.clear(); } catch { /* ignore */ }
    try { healthBarMeshes.clear(); } catch { /* ignore */ }
    try { shieldEffectMeshes.clear(); } catch { /* ignore */ }
    // Dispose pooled billboard materials
    for (const m of billboardMaterialPool.values()) {
      try { m.dispose(); } catch { /* ignore */ }
    }
    billboardMaterialPool.clear();
    billboardMaterials.clear();
  }

  window.addEventListener('resize', resize);
  resize();

  

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
function getPooledBillboardMaterial(color: THREE.Color = new THREE.Color(0xffffff), alpha: number = 1.0): THREE.ShaderMaterial {
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
  try { setRenderProgram(mat, mat); } catch { void 0; }
  billboardMaterialPool.set(key, mat);
  billboardMaterials.add(mat);
  return mat;
}

  // Adapter-level helpers exposed to systems: introspect and cache parameter
  // metadata about a renderer program-like object (material, wrapper, etc.).
  function adapterGetParameters(programLike?: object | null): unknown {
    if (!programLike) return undefined;
    try {
      const existing = rendererProgramCache.get(programLike as object);
      if (existing !== undefined) return existing;

      // Best-effort introspection: if it's a THREE.Material/ShaderMaterial,
      // capture constructor name and uniforms keys (if any). Keep the result
      // small and serializable-ish to avoid memory bloat.
      type ProgramLikeInfo = { constructor?: { name?: string }; uniforms?: Record<string, unknown>; type?: string };
      const p = programLike as unknown as ProgramLikeInfo;
      const params: { kind: string; uniforms?: string[]; type?: string } = {
        kind: p && p.constructor && p.constructor.name ? p.constructor.name : typeof programLike,
      };
      try {
        if (p && p.uniforms && typeof p.uniforms === 'object') {
          params.uniforms = Object.keys(p.uniforms);
        }
      } catch {
        params.uniforms = undefined;
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
    try { rendererProgramCache.delete(programLike as object); } catch { /* ignore */ }
  }

  // Expose a strongly-typed RendererHandles object to callers.
  const handles: RendererHandles = {
    initDone: true,
    resize,
    render,
    dispose,
    cameraRotation,
    get cameraDistance() { return _cameraDistance; },
    set cameraDistance(v: number) { _cameraDistance = v; updateCameraPosition(); },
    cameraTarget,
    getParameters: adapterGetParameters,
    invalidateParameters: adapterInvalidateParameters
  };

  return handles;
}
}
