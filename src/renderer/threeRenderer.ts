import * as THREE from 'three';
import type { GameState, RendererHandles, Ship, Bullet } from '../types/index.js';
import { createEffectsManager } from './effects.js';
import { loadGLTF } from '../core/assetLoader.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { RendererEffectsConfig } from '../config/rendererEffectsConfig.js';
import { getSVGLoader, loadSVGAsset } from '../core/svgLoader.js';
import { defaultSVGConfig, getShipSVGUrl } from '../config/svgConfig.js';

export function createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(RendererConfig.camera.fov, 1, RendererConfig.camera.near, RendererConfig.camera.far);

  // Initialize camera controls
  const cameraRotation = { x: -Math.PI/6, y: 0, z: 0 }; // pitch, yaw, roll
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
  const x = cameraTarget.x + _cameraDistance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
  const y = cameraTarget.y + _cameraDistance * Math.sin(cameraRotation.x);
  const z = cameraTarget.z + _cameraDistance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);

    camera.position.set(x, y, z);
    camera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
  }

  // Procedural Skybox Generation
  function generateStarfieldTexture(width: number, height: number, face: string, seed: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

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
    const textureSize = 512; // Smaller for animation performance
    const baseSeed = 12345;

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

    const cubeTexture = new THREE.CubeTexture(skyboxTextures);
    cubeTexture.needsUpdate = true;

    return cubeTexture;
  }

  // Holder for optional sphere skybox so animation updater can access it
  let sphereSkybox: THREE.Mesh | null = null;

  function updateSkyboxAnimation(dt: number) {
    skyboxAnimationTime += dt;

    // Update star twinkling every few frames for performance
    if (Math.floor(skyboxAnimationTime * 10) % RendererEffectsConfig.skybox.starfield.animation.updateFrequency === 0) {
      skyboxTextures.forEach((texture, index) => {
        const canvas = skyboxCanvases[index];
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Add subtle twinkling effect to bright stars
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Only affect bright pixels (stars)
          if (r > 100 || g > 100 || b > 100) {
            const twinkle = Math.sin(skyboxAnimationTime * RendererEffectsConfig.skybox.starfield.animation.twinkleSpeed + i * 0.001) * 0.3 + 0.7;
            data[i] = Math.max(0, Math.min(255, r * twinkle));
            data[i + 1] = Math.max(0, Math.min(255, g * twinkle));
            data[i + 2] = Math.max(0, Math.min(255, b * twinkle));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        texture.needsUpdate = true;
      });

      // Update sphere skybox texture
      if (sphereSkybox && sphereSkybox.material instanceof THREE.MeshBasicMaterial && skyboxTextures.length > 0) {
        (sphereSkybox.material as THREE.MeshBasicMaterial).map = skyboxTextures[0]; // Use first face for sphere
        sphereSkybox.material.needsUpdate = true;
      }
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
    console.log('Using animated cube skybox as scene background');

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
      console.log('Added sphere-based skybox (using generated texture)');
    }
  } catch (e) {
    // Fallback: solid deep blue background if procedural generation fails
    console.warn('Animated skybox generation failed, falling back to solid background', e);
    scene.background = new THREE.Color(0x000011); // Dark blue space color
    sphereSkybox = createSphereSkybox();
    scene.add(sphereSkybox);
  }

  // Force texture update on next frame to ensure it's ready
  // setTimeout(() => {
  //   animatedSkyboxTexture.needsUpdate = true;
  //   skyboxTextures.forEach(texture => {
  //     texture.needsUpdate = true;
  //   });
  //   console.log('Skybox textures updated');
  // }, 100);

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

  const shipMeshes = new Map<number, THREE.Object3D>();
  const bulletMeshes = new Map<number, THREE.Object3D>();
  const healthBarMeshes = new Map<number, THREE.Object3D>();
  const shieldEffectMeshes = new Map<number, THREE.Object3D>();
  // Maintain a short ring buffer of recent hits per ship for hex highlight
  const recentShieldHits = new Map<number, { dir: THREE.Vector3; time: number; strength: number; }[]>();

  function colorForTeam(team: 'red' | 'blue'): number { return team === 'red' ? 0xff5050 : 0x50a0ff; }

  function meshForShip(s: Ship): THREE.Object3D {
    const pool = (state as any).assetPool as Map<string, any> | undefined;
    const svgUrl = getShipSVGUrl(s.class, defaultSVGConfig);

    const createTexturedPlane = (imageBitmap: ImageBitmap) => {
      // Create a texture from ImageBitmap (not CanvasTexture)
      const texture = new THREE.Texture(imageBitmap);
      texture.needsUpdate = true;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.05
      });

      const size = (ShipVisualConfig.ships[s.class]?.collisionRadius ?? 16) * 2;
      const geometry = new THREE.PlaneGeometry(size, size);
      const mesh = new THREE.Mesh(geometry, material);
      // Face the camera roughly: rotate so texture plane is X/Y aligned (camera generally outside box)
      mesh.rotation.z = Math.PI / 2; // nose along +X
      mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      // Slight tilt so it reads better in 3D
      mesh.rotation.x = -Math.PI * 0.08;
      return mesh;
    };

    // If we already have an asset in pool, build plane from it
    try {
      if (pool && pool.has(svgUrl)) {
        const svgAsset = pool.get(svgUrl);
        if (svgAsset?.imageBitmap) return createTexturedPlane(svgAsset.imageBitmap);
      }
    } catch (e) { /* ignore */ }

    // Fallback placeholder, and kick off async load to replace visual when ready
    const geom = new THREE.ConeGeometry(8, 24, 8);
    const mat = new THREE.MeshPhongMaterial({ color: colorForTeam(s.team), emissive: 0x111122 });
    const placeholder = new THREE.Mesh(geom, mat);
    placeholder.rotation.z = Math.PI / 2;
    placeholder.position.set(s.pos.x, s.pos.y, s.pos.z);

    // Lazy-load SVG and swap geometry/material once available
    (async () => {
      try {
        const asset = await loadSVGAsset(svgUrl, {
          width: defaultSVGConfig.defaultRasterSize.width,
          height: defaultSVGConfig.defaultRasterSize.height,
        });
        if (pool) pool.set(svgUrl, asset);
        if (asset.imageBitmap && placeholder.parent) {
          const plane = createTexturedPlane(asset.imageBitmap);
          plane.position.copy(placeholder.position);
          plane.rotation.copy(placeholder.rotation);
          shipsGroup.add(plane);
          shipsGroup.remove(placeholder);
          shipMeshes.set(s.id, plane);
        }
      } catch (err) {
        console.warn(`[threeRenderer] Could not load SVG ${svgUrl}`, err);
      }
    })();

    return placeholder;
  }

  function meshForBullet(b: Bullet): THREE.Object3D {
    const geom = new THREE.SphereGeometry(2.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
    return mesh;
  }

  function createHealthBar(ship: Ship): THREE.Object3D {
    const config = RendererConfig.healthBars;
    const barGroup = new THREE.Group();

    // Background bar
    const bgGeom = new THREE.PlaneGeometry(config.width, config.position.height);
    const bgMat = new THREE.MeshBasicMaterial({ color: config.colors.background });
    const bgMesh = new THREE.Mesh(bgGeom, bgMat);
    barGroup.add(bgMesh);

    // Health bar
    const healthGeom = new THREE.PlaneGeometry(config.width - 2, config.position.height - 2);
    const healthMat = new THREE.MeshBasicMaterial({ color: config.colors.health.full });
    const healthMesh = new THREE.Mesh(healthGeom, healthMat);
    barGroup.add(healthMesh);

    // Shield bar (if ship has shield)
    let shieldMesh: THREE.Mesh | null = null;
    if (ship.maxShield > 0) {
      const shieldGeom = new THREE.PlaneGeometry(config.width - 2, config.position.height - 2);
      const shieldMat = new THREE.MeshBasicMaterial({ color: config.colors.shield.full, transparent: true, opacity: 0.8 });
      shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
      shieldMesh.position.z = 0.1; // slightly in front
      barGroup.add(shieldMesh);
    }

    // Border
    const borderGeom = new THREE.RingGeometry(config.width/2 - config.border.width/2, config.width/2 + config.border.width/2, 8);
    const borderMat = new THREE.MeshBasicMaterial({ color: config.border.color, transparent: true, opacity: 0.5 });
    const borderMesh = new THREE.Mesh(borderGeom, borderMat);
    borderMesh.position.z = 0.2;
    barGroup.add(borderMesh);

    // Store references for updating
    (barGroup as any).healthMesh = healthMesh;
    (barGroup as any).shieldMesh = shieldMesh;
    (barGroup as any).bgMesh = bgMesh;

    return barGroup;
  }

  function updateHealthBar(ship: Ship, barGroup: THREE.Object3D) {
    const config = RendererConfig.healthBars;
    const healthMesh = (barGroup as any).healthMesh as THREE.Mesh;
    const shieldMesh = (barGroup as any).shieldMesh as THREE.Mesh | null;

    // Position the bar above the ship (3D)
    barGroup.position.set(
      ship.pos.x + config.position.offsetX,
      ship.pos.y + config.position.offsetY,
      ship.pos.z + ShipVisualConfig.healthBar.offset.z // Above the ship
    );

    // Update health bar
    const healthPercent = ship.health / ship.maxHealth;
    healthMesh.scale.x = Math.max(0, healthPercent);

    // Color based on health percentage
    let healthColor = config.colors.health.full;
    if (healthPercent < 0.3) {
      healthColor = config.colors.health.critical;
    } else if (healthPercent < 0.7) {
      healthColor = config.colors.health.damaged;
    }
    (healthMesh.material as THREE.MeshBasicMaterial).color.setStyle(healthColor);

    // Update shield bar if present
    if (shieldMesh && ship.maxShield > 0) {
      const shieldPercent = ship.shield / ship.maxShield;
      shieldMesh.scale.x = Math.max(0, shieldPercent);

      // Color based on shield percentage
      const shieldColor = shieldPercent > 0.5 ? config.colors.shield.full : config.colors.shield.damaged;
      (shieldMesh.material as THREE.MeshBasicMaterial).color.setStyle(shieldColor);
    }
  }

  function createShieldEffect(ship: Ship): THREE.Object3D {
    const config = RendererConfig.shield;
    const shieldGroup = new THREE.Group();

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
    shieldGroup.add(shieldMesh);

    (shieldGroup as any).shieldMesh = shieldMesh;
    (shieldGroup as any).pulsePhase = Math.random() * Math.PI * 2;
    return shieldGroup;
  }

  function updateShieldEffect(ship: Ship, shieldGroup: THREE.Object3D, currentTime: number) {
    const config = RendererConfig.shield;
    const shieldMesh = (shieldGroup as any).shieldMesh as THREE.Mesh;
    const mat = shieldMesh.material as THREE.ShaderMaterial;

    // Position the shield around the ship (3D)
    shieldGroup.position.set(ship.pos.x, ship.pos.y, ship.pos.z);

    // Scale based on ship class
    const scale = (ShipVisualConfig.shield.scaleMultipliers[ship.class] ?? 1.0) * config.animation.scaleMultiplier;
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
    // Ships
    for (const s of state.ships) {
      if (!shipMeshes.has(s.id)) {
        const m = meshForShip(s);
        shipMeshes.set(s.id, m); shipsGroup.add(m);
      }
      // Health bars
      if (RendererConfig.visual.enableHealthBars && !healthBarMeshes.has(s.id)) {
        const bar = createHealthBar(s);
        healthBarMeshes.set(s.id, bar); healthBarsGroup.add(bar);
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
        const bar = healthBarMeshes.get(id);
        if (bar) { healthBarsGroup.remove(bar); healthBarMeshes.delete(id); }
        // Also remove shield effect
        const shield = shieldEffectMeshes.get(id);
        if (shield) { shieldEffectsGroup.remove(shield); shieldEffectMeshes.delete(id); }
      }
    }
    // Remove health bars for ships that no longer exist
    for (const [id, bar] of healthBarMeshes) {
      if (!state.ships.find(s => s.id === id)) {
        healthBarsGroup.remove(bar); healthBarMeshes.delete(id);
      }
    }
    // Remove shield effects for ships that no longer exist or have no shield
    for (const [id, shield] of shieldEffectMeshes) {
      const ship = state.ships.find(s => s.id === id);
      if (!ship || ship.maxShield <= 0) {
        shieldEffectsGroup.remove(shield); shieldEffectMeshes.delete(id);
      }
    }

    // Bullets
    for (const b of state.bullets) {
      if (!bulletMeshes.has(b.id)) {
        const m = meshForBullet(b);
        bulletMeshes.set(b.id, m); bulletsGroup.add(m);
      }
    }
    for (const [id, m] of bulletMeshes) {
      if (!state.bullets.find(b => b.id === id)) { bulletsGroup.remove(m); bulletMeshes.delete(id); }
    }
  }

  function updateTransforms() {
    const currentTime = performance.now() / 1000; // Convert to seconds
    for (const s of state.ships) {
      const m = shipMeshes.get(s.id)!;
      if (!m) continue;
      m.position.set(s.pos.x, s.pos.y, s.pos.z);
      m.rotation.z = s.dir + Math.PI / 2;
      const scale = ShipVisualConfig.ships[s.class]?.scale ?? 1.0;
      m.scale.setScalar(scale);

      // Update health bar
      if (RendererConfig.visual.enableHealthBars) {
        const bar = healthBarMeshes.get(s.id);
        if (bar) {
          updateHealthBar(s, bar);
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
    for (const b of state.bullets) {
      const m = bulletMeshes.get(b.id)!; if (!m) continue;
      m.position.set(b.pos.x, b.pos.y, b.pos.z);
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
    } catch (e) { /* ignore if canvas isn't writable in test env */ }

    // If available, also set the CSS size so the element visually matches the
    // layout; some browsers scale canvas using CSS which can affect the
    // projection if CSS size doesn't match the drawing buffer.
    if ((canvas as any).style) {
      (canvas as any).style.width = `${w}px`;
      (canvas as any).style.height = `${h}px`;
    }

    renderer.setPixelRatio(dpr);
    // Pass `false` for updateStyle because we already set canvas.style above.
    renderer.setSize(w, h, false);

    // Camera projection must use the CSS aspect (width/height) so it matches
    // the visible canvas size regardless of devicePixelRatio.
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Update camera position using spherical coordinates
    updateCameraPosition();

    try { effectsManager?.resize(w, h); } catch (e) { /* ignore */ }
  }

  // Create effects manager (postprocessing) lazily
  let effectsManager: import('./effects.js').EffectsManager | null = null;
  try { effectsManager = createEffectsManager(renderer as any, scene as any, camera as any); } catch (e) { effectsManager = null; }

  function render(_dt: number) {
    // Update camera position based on current rotation, distance, and target
    updateCameraPosition();
    syncEntities();
    updateTransforms();

    // Update animated skybox
    updateSkyboxAnimation(_dt);

    // Prefer postprocessing composer when available
    if (effectsManager && effectsManager.initDone) {
      try { effectsManager.render(_dt); return; } catch (e) { /* fallback */ }
    }
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    initDone: true,
    resize,
    render,
    dispose: () => {
      window.removeEventListener('resize', resize);
      try { effectsManager?.dispose(); } catch (e) { /* ignore */ }
      renderer.dispose();
      shipMeshes.clear();
      bulletMeshes.clear();
      healthBarMeshes.clear();
      shieldEffectMeshes.clear();
    },
    cameraRotation,
    // Expose camera distance as getter/setter so external callers can adjust it.
    get cameraDistance() { return _cameraDistance; },
    set cameraDistance(v: number) { _cameraDistance = v; updateCameraPosition(); },
    cameraTarget,
  };
}
