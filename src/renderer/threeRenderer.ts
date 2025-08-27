import * as THREE from 'three';
import type { GameState, RendererHandles, Ship, Bullet } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';

export function createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(RendererConfig.fov, 1, RendererConfig.near, RendererConfig.far);
  camera.position.set(0, 0, RendererConfig.cameraZ);
  scene.add(camera);

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(0.4, 0.8, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x667799, 0.5));

  // World plane (subtle gradient)
  const planeGeom = new THREE.PlaneGeometry(state.config.simBounds.width, state.config.simBounds.height, 1, 1);
  const planeMat = new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.2 });
  const plane = new THREE.Mesh(planeGeom, planeMat);
  plane.position.set(state.config.simBounds.width/2, state.config.simBounds.height/2, -5);
  scene.add(plane);

  // Containers for ships and bullets
  const shipsGroup = new THREE.Group();
  const bulletsGroup = new THREE.Group();
  scene.add(shipsGroup);
  scene.add(bulletsGroup);

  const shipMeshes = new Map<number, THREE.Object3D>();
  const bulletMeshes = new Map<number, THREE.Object3D>();

  function colorForTeam(team: 'red' | 'blue'): number { return team === 'red' ? 0xff5050 : 0x50a0ff; }

  function meshForShip(s: Ship): THREE.Object3D {
    // Simple triangular ship facing +X
    const geom = new THREE.ConeGeometry(8, 24, 8);
    const mat = new THREE.MeshPhongMaterial({ color: colorForTeam(s.team), emissive: 0x111122 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.z = Math.PI / 2; // orient nose along +X
    mesh.position.set(s.pos.x, s.pos.y, 0);
    return mesh;
  }

  function meshForBullet(b: Bullet): THREE.Object3D {
    const geom = new THREE.SphereGeometry(2.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(b.pos.x, b.pos.y, 0.5);
    return mesh;
  }

  function syncEntities() {
    // Ships
    for (const s of state.ships) {
      if (!shipMeshes.has(s.id)) {
        const m = meshForShip(s);
        shipMeshes.set(s.id, m); shipsGroup.add(m);
      }
    }
    for (const [id, m] of shipMeshes) {
      if (!state.ships.find(s => s.id === id)) {
        shipsGroup.remove(m); shipMeshes.delete(id);
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
    for (const s of state.ships) {
      const m = shipMeshes.get(s.id)!;
      if (!m) continue;
      m.position.set(s.pos.x, s.pos.y, 0);
      m.rotation.z = s.dir + Math.PI / 2;
      const scale = s.class === 'fighter' ? 0.7 : s.class === 'corvette' ? 0.9 : s.class === 'frigate' ? 1.1 : s.class === 'destroyer' ? 1.35 : 1.6;
      m.scale.setScalar(scale);
    }
    for (const b of state.bullets) {
      const m = bulletMeshes.get(b.id)!; if (!m) continue;
      m.position.set(b.pos.x, b.pos.y, 0.5);
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
    // Center camera on world plane
    camera.position.set(state.config.simBounds.width / 2, state.config.simBounds.height / 2, RendererConfig.cameraZ);
    camera.lookAt(state.config.simBounds.width / 2, state.config.simBounds.height / 2, 0);
  }

  function render(_dt: number) {
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
    },
  };
}
