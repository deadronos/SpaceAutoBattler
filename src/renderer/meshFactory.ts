import * as THREE from 'three';
import type { GameState, Ship, Bullet, ShipClass } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { ShipVisualConfig } from '../config/shipVisualConfig.js';
import { loadSVGAsset } from '../core/svgLoader.js';
import { defaultSVGConfig, getShipSVGUrl } from '../config/svgConfig.js';
import * as logger from '../utils/logger.js';
import { shipInstancer } from './shipInstancer.js';

/**
 * Mesh factory and pooling for ships, bullets, and UI elements
 * Extracted from threeRenderer.ts for SRP compliance
 */

export interface MeshFactoryState {
  billboardMaterials: Set<THREE.ShaderMaterial>;
  billboardMaterialPool: Map<string, THREE.ShaderMaterial>;
  GPU_BILLBOARD: boolean;
}

export interface MeshFactory {
  createShipMesh(ship: Ship, state: GameState, shipsGroup: THREE.Group, shipMeshes: Map<number, THREE.Object3D>): THREE.Object3D;
  createBulletMesh(bullet: Bullet): THREE.Object3D;
  createHealthBarMesh(ship: Ship, factoryState: MeshFactoryState): THREE.Object3D;
  updateHealthBarMesh(ship: Ship, barGroup: THREE.Object3D): void;
  getPooledBillboardMaterial(color: THREE.Color, alpha: number, factoryState: MeshFactoryState): THREE.ShaderMaterial;
  disposeMeshFactory(factoryState: MeshFactoryState): void;
}

/**
 * Creates the mesh factory state
 */
export function createMeshFactoryState(): MeshFactoryState {
  return {
    billboardMaterials: new Set<THREE.ShaderMaterial>(),
    billboardMaterialPool: new Map<string, THREE.ShaderMaterial>(),
    GPU_BILLBOARD: true // set to true to use shader-based billboarding for health bars
  };
}

/**
 * Creates a mesh for a ship with async SVG loading
 */
export function createShipMesh(
  ship: Ship, 
  state: GameState, 
  shipsGroup: THREE.Group, 
  shipMeshes: Map<number, THREE.Object3D>
): THREE.Object3D {
  const pool = state.assetPool as Map<string, { imageBitmap?: ImageBitmap }> | undefined;
  const svgUrl = getShipSVGUrl(ship.class, defaultSVGConfig);

  const createTextured3DShip = (imageBitmap: ImageBitmap) => {
    const texture = new THREE.Texture(imageBitmap);
    texture.needsUpdate = true;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Create materials - textured for main surfaces, team color for others
    const teamColor = ship.team === 'red' ? 0xff4444 : 0x4444ff;
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

    const size = ShipVisualConfig.ships[ship.class]?.collisionRadius ?? RendererConfig.defaultCollisionRadius;

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
    shipGroup.position.set(ship.pos.x, ship.pos.y, ship.pos.z);
    return shipGroup;
  };

  // If we already have an asset in pool, build textured ship from it
  try {
    if (pool && pool.has(svgUrl)) {
      const svgAsset = pool.get(svgUrl);
      if (svgAsset?.imageBitmap) return createTextured3DShip(svgAsset.imageBitmap);
    }
  } catch (_e) { void _e;/* ignore */ }

  // Fallback placeholder, and kick off async load to replace visual when ready
  const geom = new THREE.ConeGeometry(8, 24, 8);
  const mat = new THREE.MeshPhongMaterial({ 
    color: colorForTeam(ship.team), 
    emissive: 0x111122 
  });
  const placeholder = new THREE.Mesh(geom, mat);
  placeholder.rotation.z = 0; // Will be set correctly in updateTransforms
  placeholder.position.set(ship.pos.x, ship.pos.y, ship.pos.z);

  // Lazy-load SVG and swap geometry/material once available
  (async () => {
    try {
      const teamColor = ship.team === 'red' ? defaultSVGConfig.teamColors.red : defaultSVGConfig.teamColors.blue;
      const asset = await loadSVGAsset(svgUrl, {
        width: defaultSVGConfig.defaultRasterSize.width,
        height: defaultSVGConfig.defaultRasterSize.height,
        teamColor: teamColor
      });
      if (pool) pool.set(svgUrl, asset);
      if (asset?.imageBitmap && placeholder.parent) {
        // Build a representative list of geometries and materials matching the textured ship parts.
        try {
          const teamColor = ship.team === 'red' ? 0xff4444 : 0x4444ff;
          const texturedMaterial = new THREE.MeshBasicMaterial({ map: new THREE.Texture(asset.imageBitmap), transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
          texturedMaterial.map!.needsUpdate = true;
          const teamMaterial = new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.8, side: THREE.DoubleSide });

          const size = ShipVisualConfig.ships[ship.class]?.collisionRadius ?? RendererConfig.defaultCollisionRadius;
          const bodyGeometry = new THREE.CylinderGeometry(size * 0.3, size * 0.4, size * 0.8, 8);
          const noseGeometry = new THREE.ConeGeometry(size * 0.3, size * 0.5, 8);
          const wingGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.4);
          const sidePanelGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.3);
          const rearPanelGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.6);
          const rearFinGeometry = new THREE.PlaneGeometry(size * 0.3, size * 0.2);

          const geoms = [bodyGeometry, noseGeometry, wingGeometry, wingGeometry, sidePanelGeometry, sidePanelGeometry, rearPanelGeometry, rearFinGeometry, rearFinGeometry];
          const mats = [texturedMaterial, teamMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial];

          // Register prototype for the instancer so future ships of this class can use instancing.
          shipInstancer.registerPrototype(ship.class, geoms, mats);

          // If instancing is enabled and we can allocate for this existing ship, migrate the placeholder
          // to an instanced slot instead of adding a non-instanced textured mesh.
          if (RendererConfig.instancing.enableShips) {
            try {
              const allocated = shipInstancer.allocate(ship.id, ship.class, ship.team, state);
              if (allocated) {
                // Immediately set transform so the instance appears in the correct place
                const q = new THREE.Quaternion();
                q.setFromEuler(new THREE.Euler(ship.orientation.pitch, ship.orientation.yaw - Math.PI/2, ship.orientation.roll));
                const scale = ShipVisualConfig.ships[ship.class]?.scale ?? RendererConfig.defaultScale;
                shipInstancer.updateTransform(ship.id, ship.pos, q, scale);
                // Remove placeholder from scene and track a lightweight object in the mesh map
                try { if (placeholder.parent) placeholder.parent.remove(placeholder); } catch (_e) { void _e;/* ignore */ }
                shipMeshes.set(ship.id, new THREE.Object3D());
                // Don't add the textured non-instanced mesh
                return;
              }
            } catch (e) { void e; logger.warn('shipInstancer.allocate during migration failed', e as unknown);
            }
          }

          // Fallback: create full textured mesh and replace placeholder
          const ship3D = createTextured3DShip(asset.imageBitmap);
          ship3D.position.copy(placeholder.position);
          shipsGroup.add(ship3D);
          shipsGroup.remove(placeholder);
          shipMeshes.set(ship.id, ship3D);
            } catch (e) { void e; logger.warn('shipInstancer.allocate during migration failed', e as unknown);
          logger.warn('shipInstancer.registerPrototype or migration failed', e as unknown);
          const ship3D = createTextured3DShip(asset.imageBitmap);
          ship3D.position.copy(placeholder.position);
          shipsGroup.add(ship3D);
          shipsGroup.remove(placeholder);
          shipMeshes.set(ship.id, ship3D);
        }
      }
    } catch (e) { void e;// Loading/parsing of SVG failed — log and keep placeholder
      logger.error('Failed to load SVG asset for ship', e as unknown);
    }
  })();

  // Return placeholder while async asset loads
  return placeholder;
}

/**
 * Register instancer prototypes from preloaded assets in the state's asset pool.
 * This builds the same geometries/materials used by `createShipMesh` and calls
 * `shipInstancer.registerPrototype` so instanced allocations will have correct visuals.
 */
export function registerPrototypesFromPool(state: GameState) {
  try {
  const pool = state.assetPool as Map<string, { imageBitmap?: ImageBitmap }> | undefined;
  if (!pool) return;
  const classes: ShipClass[] = ['fighter','corvette','frigate','destroyer','carrier'];
    for (const cls of classes) {
      try {
        const svgUrl = getShipSVGUrl(cls, defaultSVGConfig);
        const asset = pool.get(svgUrl) as { imageBitmap?: ImageBitmap } | undefined;
        if (!asset?.imageBitmap) continue;

        const tex = new THREE.Texture(asset.imageBitmap);
        tex.needsUpdate = true;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;

        const texturedMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
        const teamMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, side: THREE.DoubleSide });

        const size = ShipVisualConfig.ships[cls]?.collisionRadius ?? RendererConfig.defaultCollisionRadius;
        const bodyGeometry = new THREE.CylinderGeometry(size * 0.3, size * 0.4, size * 0.8, 8);
        const noseGeometry = new THREE.ConeGeometry(size * 0.3, size * 0.5, 8);
        const wingGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.4);
        const sidePanelGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.3);
        const rearPanelGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.6);
        const rearFinGeometry = new THREE.PlaneGeometry(size * 0.3, size * 0.2);

        const geoms = [bodyGeometry, noseGeometry, wingGeometry, wingGeometry, sidePanelGeometry, sidePanelGeometry, rearPanelGeometry, rearFinGeometry, rearFinGeometry];
        const mats = [texturedMaterial, teamMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial, texturedMaterial];

        try {
          // Prefer updatePrototype to replace any existing group meshes immediately
    const up = (shipInstancer as unknown as { updatePrototype?: (name: string, geoms: THREE.BufferGeometry[], mats: THREE.Material[]) => void }).updatePrototype;
          if (typeof up === 'function') {
            try {
              up(cls, geoms, mats);
            } catch (err) {
              void err;
              shipInstancer.registerPrototype(cls, geoms, mats);
            }
          } else {
            shipInstancer.registerPrototype(cls, geoms, mats);
          }
          if (logger && typeof logger.info === 'function') logger.info(`meshFactory: registered instancer prototype for ${cls}`);
        } catch (_e) { void _e; }
      } catch (_e) { void _e; }
    }
  } catch (_e) { void _e; }
}

/**
 * Creates a mesh for a bullet
 */
export function createBulletMesh(bullet: Bullet): THREE.Object3D {
  const geom = new THREE.SphereGeometry(2.2, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(bullet.pos.x, bullet.pos.y, bullet.pos.z);
  return mesh;
}

/**
 * Creates a health bar mesh with background, health, and shield components
 */
export function createHealthBarMesh(ship: Ship, factoryState: MeshFactoryState): THREE.Object3D {
  // Defensive guard: avoid creating health bar visuals for unknown/invalid ship entries
  const hasKnownClass = !!ShipVisualConfig.ships[ship.class as keyof typeof ShipVisualConfig.ships];
  const posValid = Number.isFinite(ship.pos?.x) && Number.isFinite(ship.pos?.y) && Number.isFinite(ship.pos?.z);
  if (!hasKnownClass || !posValid) {
    // Return an empty group as a no-op to callers expecting an Object3D
    return new THREE.Group();
  }

  // DEV LOG: record creation of a non-instanced health bar via meshFactory
  try {
    // eslint-disable-next-line no-console
  console.info(`[HB_TRACE][meshFactory] createHealthBarMesh for ship=${ship.id} class=${ship.class} pos=(${ship.pos.x},${ship.pos.y},${ship.pos.z})`);
  try { console.info(new Error('HB_STACK createHealthBarMesh').stack); } catch (_e) { void _e; }
  } catch (_e) { void _e; }

  const config = RendererConfig.healthBars;
  const barGroup = new THREE.Group();

  // Background bar
  const bgGeom = new THREE.PlaneGeometry(config.width, config.position.height);
  let bgMat: THREE.Material;
  if (factoryState.GPU_BILLBOARD) {
    const mat = getPooledBillboardMaterial(new THREE.Color(config.colors.background), 1.0, factoryState);
    bgMat = mat;
  } else {
    bgMat = new THREE.MeshBasicMaterial({ color: config.colors.background });
  }
  const bgMesh = new THREE.Mesh(bgGeom, bgMat);
  barGroup.add(bgMesh);

  // Health bar
  const healthGeom = new THREE.PlaneGeometry(config.width - 2, config.position.height - 2);
  let healthMat: THREE.Material;
  if (factoryState.GPU_BILLBOARD) {
    const mat = getPooledBillboardMaterial(new THREE.Color(config.colors.health.full), 1.0, factoryState);
    healthMat = mat;
  } else {
    healthMat = new THREE.MeshBasicMaterial({ color: config.colors.health.full });
  }
  const healthMesh = new THREE.Mesh(healthGeom, healthMat);
  barGroup.add(healthMesh);

  // Shield bar (if ship has shield)
  let shieldMesh: THREE.Mesh | null = null;
  if (ship.maxShield > 0) {
    const shieldGeom = new THREE.PlaneGeometry(config.width - 2, config.position.height - 2);
    let shieldMat: THREE.Material;
    if (factoryState.GPU_BILLBOARD) {
      const mat = getPooledBillboardMaterial(new THREE.Color(config.colors.shield.full), 0.8, factoryState);
      shieldMat = mat;
    } else {
      shieldMat = new THREE.MeshBasicMaterial({ color: config.colors.shield.full, transparent: true, opacity: 0.8 });
    }
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
  const barRef = barGroup as unknown as { healthMesh?: THREE.Mesh; shieldMesh?: THREE.Mesh | null; bgMesh?: THREE.Mesh };
  barRef.healthMesh = healthMesh;
  barRef.shieldMesh = shieldMesh;
  barRef.bgMesh = bgMesh;

  return barGroup;
}

/**
 * Updates the health bar mesh based on ship status
 */
export function updateHealthBarMesh(ship: Ship, barGroup: THREE.Object3D): void {
  const config = RendererConfig.healthBars;
  const barRef = barGroup as unknown as { healthMesh?: THREE.Mesh; shieldMesh?: THREE.Mesh | null };
  const healthMesh = barRef.healthMesh as THREE.Mesh;
  const shieldMesh = barRef.shieldMesh as THREE.Mesh | null;

  // Position the bar above the ship (3D)
  barGroup.position.set(
    ship.pos.x + config.position.offsetX,
    ship.pos.y + config.position.offsetY,
    ship.pos.z + ShipVisualConfig.healthBar.offset.z // Above the ship
  );

  // Update health bar
  const healthPercent = ship.health / ship.maxHealth;
  healthMesh.scale.x = Math.max(0, healthPercent);

  // Update health color based on percentage
  const healthColor = healthPercent > 0.5 ? config.colors.health.full : config.colors.health.damaged;
  if (healthMesh.material) {
  const mat = healthMesh.material as THREE.ShaderMaterial;
    if (mat.uniforms && mat.uniforms.uColor) {
      (mat.uniforms.uColor.value as THREE.Color).set(healthColor);
    } else if ((healthMesh.material as THREE.MeshBasicMaterial).color) {
      (healthMesh.material as THREE.MeshBasicMaterial).color.set(healthColor);
    }
  }

  // Update shield bar
  if (shieldMesh && ship.maxShield > 0) {
    const shieldPercent = ship.shield / ship.maxShield;
    shieldMesh.scale.x = Math.max(0, shieldPercent);

    const shieldColor = shieldPercent > 0.5 ? config.colors.shield.full : config.colors.shield.damaged;
    if (shieldMesh.material) {
  const mat = shieldMesh.material as THREE.ShaderMaterial;
      if (mat.uniforms && mat.uniforms.uColor) {
        (mat.uniforms.uColor.value as THREE.Color).set(shieldColor);
      } else if ((shieldMesh.material as THREE.MeshBasicMaterial).color) {
        (shieldMesh.material as THREE.MeshBasicMaterial).color.set(shieldColor);
      }
    }
  }
}

/**
 * Get or create a pooled ShaderMaterial for the given color/alpha
 */
export function getPooledBillboardMaterial(
  color: THREE.Color = new THREE.Color(0xffffff), 
  alpha: number = 1.0,
  factoryState: MeshFactoryState
): THREE.ShaderMaterial {
  const key = billboardPoolKey(color, alpha);
  const existing = factoryState.billboardMaterialPool.get(key);
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
  // Avoid depth-test issues for overlapping transparent billboards
  (mat as THREE.ShaderMaterial & { depthTest?: boolean }).depthTest = false;
  factoryState.billboardMaterialPool.set(key, mat);
  factoryState.billboardMaterials.add(mat);
  return mat;
}

/**
 * Helper: compute a key for the material pool based on color and alpha
 */
function billboardPoolKey(color: THREE.Color, alpha: number): string {
  // Use CSS hex + alpha to key materials
  return `${color.getHexString()}|${alpha}`;
}

/**
 * Billboard shader: place quad in world space using camera right/up vectors so it always faces the camera.
 */
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

/**
 * Helper function to get team color
 */
function colorForTeam(team: 'red' | 'blue'): number {
  return team === 'red' ? 0xff5050 : 0x50a0ff;
}

/**
 * Disposes mesh factory resources
 */
export function disposeMeshFactory(factoryState: MeshFactoryState): void {
  // Dispose pooled billboard materials
  for (const mat of factoryState.billboardMaterialPool.values()) {
    try { 
      mat.dispose(); 
    } catch (_e) { void _e;/* ignore */ 
    }
  }
  factoryState.billboardMaterialPool.clear();
  factoryState.billboardMaterials.clear();
}

/**
 * Default mesh factory implementation
 */
export const meshFactory: MeshFactory = {
  createShipMesh,
  createBulletMesh,
  createHealthBarMesh,
  updateHealthBarMesh,
  getPooledBillboardMaterial,
  disposeMeshFactory
};

