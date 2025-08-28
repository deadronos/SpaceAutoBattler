import * as THREE from 'three';
import type { GameState, RendererHandles, Ship, Bullet } from '../types/index.js';
import { createEffectsManager } from './effects.js';
import { loadGLTF } from '../core/assetLoader.js';
import { RendererConfig } from '../config/rendererConfig.js';

export function createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(RendererConfig.camera.fov, 1, RendererConfig.camera.near, RendererConfig.camera.far);

  // Initialize camera controls
  const cameraRotation = { x: -Math.PI/6, y: 0, z: 0 }; // pitch, yaw, roll
  const cameraDistance = RendererConfig.camera.cameraZ;
  const cameraTarget = {
    x: state.simConfig.simBounds.width / 2,
    y: state.simConfig.simBounds.height / 2,
    z: state.simConfig.simBounds.depth / 2
  };

  // Set initial camera position using spherical coordinates
  updateCameraPosition();

  function updateCameraPosition() {
    const x = cameraTarget.x + cameraDistance * Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x);
    const y = cameraTarget.y + cameraDistance * Math.sin(cameraRotation.x);
    const z = cameraTarget.z + cameraDistance * Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x);

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
    const starCount = face === 'top' || face === 'bottom' ? 800 : 1200;
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
      for (let i = 0; i < 3; i++) {
        const nebulaX = random() * width;
        const nebulaY = random() * height;
        const nebulaRadius = 50 + random() * 100;

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
    if (Math.floor(skyboxAnimationTime * 10) % 3 === 0) {
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
            const twinkle = Math.sin(skyboxAnimationTime * 2 + i * 0.001) * 0.3 + 0.7;
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
    const skyboxGeometry = new THREE.SphereGeometry(5000, 32, 32); // Large sphere
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
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1000, 1000, 1000);
  scene.add(directionalLight);

  // World boundaries visualization (wireframe-only box)
  const boxGeom = new THREE.BoxGeometry(state.simConfig.simBounds.width, state.simConfig.simBounds.height, state.simConfig.simBounds.depth);
  // Use edges geometry to display only the boundary lines (no filled interior)
  const edges = new THREE.EdgesGeometry(boxGeom);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4a90e2, transparent: true, opacity: 0.6 });
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

  function colorForTeam(team: 'red' | 'blue'): number { return team === 'red' ? 0xff5050 : 0x50a0ff; }

  function meshForShip(s: Ship): THREE.Object3D {
    // Try to get a GLTF model from assetPool first (config-driven path)
    try {
      const pool = (state as any).assetPool as Map<string, any> | undefined;
      const key = `ship-${s.class}-${s.team}`;
      if (pool) {
        const cached = pool.get(key);
        if (cached && cached.scene) {
          const clone = (cached.scene.clone ? cached.scene.clone() : cached.scene) as THREE.Object3D;
          clone.position.set(s.pos.x, s.pos.y, s.pos.z);
          return clone;
        }
      }
    } catch (e) {
      // fall back to procedural mesh
    }

    // Fallback: Simple triangular ship facing +X
    const geom = new THREE.ConeGeometry(8, 24, 8);
    const mat = new THREE.MeshPhongMaterial({ color: colorForTeam(s.team), emissive: 0x111122 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.z = Math.PI / 2; // orient nose along +X
    mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
    return mesh;
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
      ship.pos.z + 10 // Above the ship
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

    // Main shield ellipse
    const ellipseGeom = new THREE.RingGeometry(12, 18, 32);
    const color = ship.team === 'red' ? config.colors.red : config.colors.blue;
    const shieldMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: config.opacity.base,
      side: THREE.DoubleSide
    });
    const shieldMesh = new THREE.Mesh(ellipseGeom, shieldMat);
    shieldGroup.add(shieldMesh);

    // Inner ripple effect
    const rippleGeom = new THREE.RingGeometry(10, 14, 24);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const rippleMesh = new THREE.Mesh(rippleGeom, rippleMat);
    shieldGroup.add(rippleMesh);

    // Store references for updating
    (shieldGroup as any).shieldMesh = shieldMesh;
    (shieldGroup as any).rippleMesh = rippleMesh;
    (shieldGroup as any).pulsePhase = Math.random() * Math.PI * 2; // Random phase for variation

    return shieldGroup;
  }

  function updateShieldEffect(ship: Ship, shieldGroup: THREE.Object3D, currentTime: number) {
    const config = RendererConfig.shield;
    const shieldMesh = (shieldGroup as any).shieldMesh as THREE.Mesh;
    const rippleMesh = (shieldGroup as any).rippleMesh as THREE.Mesh;
    const shieldMat = shieldMesh.material as THREE.MeshBasicMaterial;
    const rippleMat = rippleMesh.material as THREE.MeshBasicMaterial;

    // Position the shield around the ship (3D)
    shieldGroup.position.set(ship.pos.x, ship.pos.y, ship.pos.z + 0.1);

    // Scale based on ship class
    const scale = ship.class === 'fighter' ? 0.8 : ship.class === 'corvette' ? 1.0 : ship.class === 'frigate' ? 1.2 : ship.class === 'destroyer' ? 1.4 : 1.6;
    shieldGroup.scale.setScalar(scale * config.animation.scaleMultiplier);

    // Update opacity based on shield strength
    if (ship.maxShield > 0) {
      const shieldPercent = ship.shield / ship.maxShield;
      const opacity = config.opacity.base * shieldPercent + config.opacity.min * (1 - shieldPercent);
      shieldMat.opacity = opacity;
      rippleMat.opacity = opacity * 0.5;
    }

    // Pulse animation
    const pulsePhase = (shieldGroup as any).pulsePhase;
    const pulse = Math.sin(currentTime * config.animation.pulseSpeed + pulsePhase) * 0.1 + 0.9;
    shieldMesh.scale.setScalar(pulse);

    // Ripple animation
    const ripplePhase = Math.sin(currentTime * config.animation.rippleSpeed + pulsePhase * 0.7);
    rippleMesh.scale.setScalar(0.8 + ripplePhase * 0.2);

    // Hit effect - rapid pulse when shield is hit
    const lastHitTime = ship.lastShieldHitTime || 0;
    if (currentTime - lastHitTime < 0.5) {
      const hitIntensity = 1 - (currentTime - lastHitTime) / 0.5;
      const hitPulse = 1 + Math.sin(currentTime * 20) * hitIntensity * 0.3;
      shieldMesh.scale.setScalar(hitPulse);
      shieldMat.opacity = Math.min(1, shieldMat.opacity + hitIntensity * 0.5);
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
      const scale = s.class === 'fighter' ? 0.7 : s.class === 'corvette' ? 0.9 : s.class === 'frigate' ? 1.1 : s.class === 'destroyer' ? 1.35 : 1.6;
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
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
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
    cameraDistance,
    cameraTarget,
  };
}
