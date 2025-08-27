import * as THREE from 'three';
import type { GameState, RendererHandles, Ship, Bullet } from '../types/index.js';
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

  scene.add(camera);

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(0.4, 0.8, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x667799, 0.5));

  // World boundaries visualization (3D box)
  const boxGeom = new THREE.BoxGeometry(state.simConfig.simBounds.width, state.simConfig.simBounds.height, state.simConfig.simBounds.depth);
  const boxMat = new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.1, wireframe: true });
  const box = new THREE.Mesh(boxGeom, boxMat);
  box.position.set(state.simConfig.simBounds.width/2, state.simConfig.simBounds.height/2, state.simConfig.simBounds.depth/2);
  scene.add(box);

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
    // Simple triangular ship facing +X
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
  }

  function render(_dt: number) {
    // Update camera position based on current rotation, distance, and target
    updateCameraPosition();
    syncEntities();
    updateTransforms();
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
