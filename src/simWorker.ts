// Sim worker: handle Rapier physics in a worker and accept messages from main thread
// Ensure dynamic chunk loads inside this worker resolve to the project's dist root
// so that webpack's generated chunk path like `workers/rapier.*.js` resolves to
// `/dist/workers/rapier.*.js` instead of `/dist/workers/workers/...` (double path).
// We set the public path to the parent directory of this worker script at runtime.

// Minimal typed view of the global `self` for early bootstrap checks
type SelfLikeForBootstrap = { location?: { href?: string } } & typeof self;
const S =
  typeof self !== 'undefined'
    ? (self as unknown as SelfLikeForBootstrap)
    : ({} as SelfLikeForBootstrap);

// @ts-ignore - webpack global variable
if (typeof __webpack_public_path__ !== 'undefined') {
  try {
    // Use the worker's own location.href to compute the public path. This avoids
    // referencing `import.meta` (which can confuse some parsers) and is reliable
    // in dedicated worker contexts where `self.location.href` points at the
    // worker script URL (e.g. /dist/workers/917.x.js).
    if (typeof self !== 'undefined' && S.location && typeof S.location.href === 'string') {
      const metaUrl = (S.location.href as string).replace(/\\/g, '/');
      const workersIndex = metaUrl.lastIndexOf('/workers/');
      const parent =
        workersIndex !== -1
          ? metaUrl.slice(0, workersIndex + 1)
          : metaUrl.slice(0, metaUrl.lastIndexOf('/') + 1) || './';
      // @ts-expect-error set runtime public path
      __webpack_public_path__ = parent;
    }
  } catch (_e) {
    void _e;
  }
}

import * as logger from './utils/logger.js';

// Small local types to avoid broad `any` while keeping runtime semantics
type Vec3 = { x: number; y: number; z: number };
type ShipLike = { id: number; pos: Vec3; vel: Vec3 } & Record<string, unknown>;
type BulletLike = { 
  id: number; 
  pos: Vec3; 
  vel: Vec3; 
  ttl: number; 
  damage: number; 
  ownerShipId: number; 
  ownerTeam: 'red' | 'blue';
} & Record<string, unknown>;
type RigidBodyLike = {
  setTranslation: (t: Vec3, wake?: boolean) => void;
  setLinvel: (v: Vec3, wake?: boolean) => void;
  translation?: () => Vec3;
  linvel?: () => Vec3;
};
type WorldLike = {
  createRigidBody: (desc: unknown) => RigidBodyLike;
  createCollider: (desc: unknown, body?: RigidBodyLike) => void;
  removeRigidBody: (body: RigidBodyLike) => void;
  step?: () => void;
  timestep?: number;
  free?: () => void;
};
type RapierModuleLike = {
  RigidBodyDesc?: unknown;
  ColliderDesc?: unknown;
  World?: unknown;
} & Record<string, unknown>;

let world: WorldLike | null = null;
let Rapier: RapierModuleLike | null = null;
const bodies = new Map<number, RigidBodyLike | null>(); // shipId -> rigidBody
const bulletBodies = new Map<number, RigidBodyLike | null>(); // bulletId -> rigidBody
const bullets = new Map<number, BulletLike>(); // bulletId -> bullet
// Optional entity index (miniplex + UniformGrid) replicated inside worker for
// worker-local spatial queries or bookkeeping when desired. This is best-effort
// and never required for the worker to function; initialization is explicit
// via a message from the main thread.
// Type-only import to avoid pulling runtime entityIndex code into the worker's
// top-level module scope. We'll import the runtime module dynamically when
// requested, but keep the compile-time type to make TypeScript happy.
import type { EntityIndexAPI } from './core/entityIndex.js';

let entityIndex: EntityIndexAPI | null = null;
const entityIndexKnownIds = new Set<number>();

// AI system imports and state - initialized dynamically
import type { AIController } from './core/ai/controller.js';
import type { AggressiveSpatialOptimizer } from './core/ai/aggressiveSpatialOptimizer.js';
import type { SpatialGrid } from './utils/spatialGrid.js';
import type { GameState } from './types/index.js';

let aiController: AIController | null = null;
let spatialGrid: SpatialGrid | null = null;
let aggressiveSpatialOptimizer: AggressiveSpatialOptimizer | null = null;

// Worker global typed view for message/postMessage usage
type WorkerGlobalLike = {
  postMessage(m: unknown): void;
  location?: { href?: string };
} & typeof self;
const WG = self as unknown as WorkerGlobalLike;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function initAI(gameStateData: unknown) {
  if (aiController) return; // Already initialized
  
  try {
    // Dynamically import AI modules
    const [aiModule, spatialModule, optimizerModule] = await Promise.all([
      import('./core/ai/controller.js'),
      import('./utils/spatialGrid.js'),
      import('./core/ai/aggressiveSpatialOptimizer.js')
    ]);
    
    // Create a minimal GameState object for AI initialization
    const gameState = gameStateData as GameState;
    
    // Initialize spatial systems
    spatialGrid = new spatialModule.SpatialGrid(
      gameState.simConfig.spatialGrid.cellSize,
      gameState.simConfig.simBounds
    );
    
    aggressiveSpatialOptimizer = new optimizerModule.AggressiveSpatialOptimizer(
      spatialGrid,
      gameState.simConfig.spatialGrid.cellSize
    );
    
    // Initialize AI controller
    aiController = new aiModule.AIController(gameState, aggressiveSpatialOptimizer);
    
    logger.debug('[simWorker] AI systems initialized successfully');
  } catch (e) {
    logger.error('[simWorker] Failed to initialize AI systems:', e);
    throw e;
  }
}

async function initRapier() {
  if (Rapier) return;
  try {
    // Dynamically import Rapier in the worker so the heavy WASM package is loaded only when needed
    // Use `import()` and guard for default export shape.
    const rapierMod = await import('@dimforge/rapier3d-compat');
    // Some builds export as default, some as named exports; normalize to Rapier module object
    const normalizeRapierModule = (m: unknown): RapierModuleLike => {
      if (!m) return {} as RapierModuleLike;
      const candidate = (m as { default?: unknown }).default ?? m;
      return candidate as RapierModuleLike;
    };

    Rapier = normalizeRapierModule(rapierMod);
    // Rapier.World may be a constructor or factory depending on the build; guard accordingly
    const W = (Rapier as Record<string, unknown>).World ?? Rapier;
    // Attempt to construct or call the World factory; allow different shapes across builds
    type WorldConstructor = new (opts?: unknown) => WorldLike;
    let constructorError: unknown = null;
    let factoryError: unknown = null;
    try {
      // If W is a constructor
      world = new (W as unknown as WorldConstructor)({ x: 0, y: 0, z: 0 });
    } catch (e) {
      constructorError = e;
      try {
        // If W is a factory function
        world = (W as unknown as (opts?: unknown) => WorldLike)({ x: 0, y: 0, z: 0 });
      } catch (ee) {
        factoryError = ee;
        world = null;
      }
    }
    // If world is still null but Rapier loaded, surface captured inner errors
    if (!world) {
      try {
        const rapierKeys: string[] = [];
        try {
          const k = Object.keys(Rapier as Record<string, unknown>);
          for (const kk of k) rapierKeys.push(String(kk));
        } catch {
          // ignore
        }
        WG.postMessage({
          type: 'init-rapier-diagnostics',
          rapierLoaded: !!Rapier,
          rapierKeys: rapierKeys.slice(0, 50),
          constructorError: constructorError ? String(constructorError) : undefined,
          constructorStack: constructorError && (constructorError as Error).stack ? (constructorError as Error).stack : undefined,
          factoryError: factoryError ? String(factoryError) : undefined,
          factoryStack: factoryError && (factoryError as Error).stack ? (factoryError as Error).stack : undefined,
        });
      } catch {
        /* best-effort diag */
      }
    }
  } catch (err) {
    Rapier = null;
    world = null;
    // Diagnostic: post init error details so tests and bootstrap logs can show
    // why Rapier/world failed to initialize inside the worker VM.
    try {
      WG.postMessage({
        type: 'init-physics-error',
        error: String(err),
        // include stack when available for easier debugging
        stack: (err && (err as Error).stack) || undefined,
      });
    } catch {
      /* ignore - best-effort diagnostic */
    }
  }
}

function createBodyForShip(ship: ShipLike) {
  if (!world || !Rapier) return null;

  try {
    // Create a dynamic rigid body for the ship
    // Build descriptors defensively — Rapier's API may differ between builds
    const RDesc = (Rapier as Record<string, unknown>).RigidBodyDesc ?? undefined;
    const CDesc = (Rapier as Record<string, unknown>).ColliderDesc ?? undefined;
    type RDescType = { dynamic?: () => unknown };
    type CDescType = { cuboid?: (a: number, b: number, c: number) => unknown };
    const dynamicFn = (RDesc as RDescType | undefined)?.dynamic;
    const rigidBodyDesc = typeof dynamicFn === 'function' ? dynamicFn() : {};
    const rbdObj = rigidBodyDesc as {
      setTranslation?: (x: number, y: number, z: number) => void;
      setLinvel?: (x: number, y: number, z: number) => void;
    };
    if (typeof rbdObj.setTranslation === 'function') {
      rbdObj.setTranslation(ship.pos.x, ship.pos.y, ship.pos.z);
    }
    if (typeof rbdObj.setLinvel === 'function') {
      rbdObj.setLinvel(ship.vel.x, ship.vel.y, ship.vel.z);
    }

    const rigidBody = world.createRigidBody(rigidBodyDesc as unknown);

    // Add a collider (simple box for now) if API present
    const cuboidFn = (CDesc as CDescType | undefined)?.cuboid;
    const colliderDesc = typeof cuboidFn === 'function' ? cuboidFn(5, 2, 5) : null;
    if (colliderDesc && world) world.createCollider(colliderDesc, rigidBody as RigidBodyLike);

    return rigidBody as RigidBodyLike;
  } catch {
    // Log the caught error
    // Note: name the caught error so TypeScript can reference it
    const _e = undefined as unknown; // fallback to satisfy formatting if needed
    try {
      throw new Error('createBodyForShip failure');
    } catch (e) {
      void e;
      logger.error('Failed to create physics body for ship:', e);
    }
    return null;
  }
}

function updateBodyFromShip(body: RigidBodyLike | null, ship: ShipLike) {
  if (!body) return;

  try {
    // Update position and velocity
    body.setTranslation({ x: ship.pos.x, y: ship.pos.y, z: ship.pos.z }, true);
    body.setLinvel({ x: ship.vel.x, y: ship.vel.y, z: ship.vel.z }, true);
  } catch {
    try {
      throw new Error('updateBodyFromShip failure');
    } catch (e) {
      void e;
      logger.error('Failed to update physics body:', e);
    }
  }
}

function collectTransforms() {
  const transforms: Array<{ shipId: number; pos: Vec3; vel: Vec3 }> = [];

  for (const [shipId, body] of bodies) {
    if (!body) continue;

    try {
      const translation =
        typeof body.translation === 'function' ? body.translation() : { x: 0, y: 0, z: 0 };
      const linvel = typeof body.linvel === 'function' ? body.linvel() : { x: 0, y: 0, z: 0 };

      transforms.push({
        shipId,
        pos: { x: translation.x, y: translation.y, z: translation.z },
        vel: { x: linvel.x, y: linvel.y, z: linvel.z },
      });
    } catch (e) {
      void e;
      logger.error('Failed to collect transform for ship', shipId, e);
    }
  }

  return transforms;
}

function createBulletBody(bullet: BulletLike): RigidBodyLike | null {
  if (!world || !Rapier) return null;

  try {
    const RDesc = (Rapier as Record<string, unknown>).RigidBodyDesc ?? undefined;
    const CDesc = (Rapier as Record<string, unknown>).ColliderDesc ?? undefined;
    type RDescType = { dynamic?: () => unknown };
    type CDescType = { ball?: (radius: number) => unknown };
    
    const dynamicFn = (RDesc as RDescType | undefined)?.dynamic;
    const rigidBodyDesc = typeof dynamicFn === 'function' ? dynamicFn() : {};
    const rbdObj = rigidBodyDesc as {
      setTranslation?: (x: number, y: number, z: number) => void;
      setLinvel?: (x: number, y: number, z: number) => void;
    };
    
    if (typeof rbdObj.setTranslation === 'function') {
      rbdObj.setTranslation(bullet.pos.x, bullet.pos.y, bullet.pos.z);
    }
    if (typeof rbdObj.setLinvel === 'function') {
      rbdObj.setLinvel(bullet.vel.x, bullet.vel.y, bullet.vel.z);
    }

    const rigidBody = world.createRigidBody(rigidBodyDesc as unknown);

    // Add a small sphere collider for bullets
    const ballFn = (CDesc as CDescType | undefined)?.ball;
    const colliderDesc = typeof ballFn === 'function' ? ballFn(2) : null; // 2 unit radius
    if (colliderDesc && world) world.createCollider(colliderDesc, rigidBody as RigidBodyLike);

    return rigidBody as RigidBodyLike;
  } catch (e) {
    void e;
    logger.error('Failed to create physics body for bullet:', e);
    return null;
  }
}

function updateBulletFromPhysics(bulletId: number): void {
  const bullet = bullets.get(bulletId);
  const body = bulletBodies.get(bulletId);
  if (!bullet || !body) return;

  try {
    const translation = typeof body.translation === 'function' ? body.translation() : bullet.pos;
    const linvel = typeof body.linvel === 'function' ? body.linvel() : bullet.vel;

    bullet.pos.x = translation.x;
    bullet.pos.y = translation.y;
    bullet.pos.z = translation.z;
    bullet.vel.x = linvel.x;
    bullet.vel.y = linvel.y;
    bullet.vel.z = linvel.z;
  } catch (e) {
    void e;
    logger.error('Failed to update bullet from physics:', e);
  }
}

function collectBulletTransforms() {
  const bulletTransforms: Array<{ bulletId: number; pos: Vec3; vel: Vec3; ttl: number }> = [];

  for (const [bulletId, bullet] of bullets) {
    try {
      bulletTransforms.push({
        bulletId,
        pos: { x: bullet.pos.x, y: bullet.pos.y, z: bullet.pos.z },
        vel: { x: bullet.vel.x, y: bullet.vel.y, z: bullet.vel.z },
        ttl: bullet.ttl,
      });
    } catch (e) {
      void e;
      logger.error('Failed to collect transform for bullet', bulletId, e);
    }
  }

  return bulletTransforms;
}

function updateBulletTimers(dt: number): Array<{ type: 'bullet-expired'; bulletId: number }> {
  const events: Array<{ type: 'bullet-expired'; bulletId: number }> = [];
  const expiredBullets: number[] = [];

  for (const [bulletId, bullet] of bullets) {
    bullet.ttl -= dt;
    if (bullet.ttl <= 0) {
      expiredBullets.push(bulletId);
      events.push({ type: 'bullet-expired', bulletId });
    }
  }

  // Remove expired bullets
  for (const bulletId of expiredBullets) {
    const body = bulletBodies.get(bulletId);
    if (body && world) {
      try {
        world.removeRigidBody(body);
      } catch (e) {
        void e;
        logger.error('Failed to remove bullet body:', e);
      }
    }
    bullets.delete(bulletId);
    bulletBodies.delete(bulletId);
  }

  return events;
}

self.addEventListener('message', async (e: MessageEvent) => {
  // Guard and narrow incoming message shape to avoid `any`
  const raw = e.data as unknown;
  if (typeof raw !== 'object' || raw === null) {
    WG.postMessage({ type: 'unknown', payload: raw });
    return;
  }
  const { type, payload } = raw as { type?: string; payload?: unknown };

  if (type === 'init-physics') {
    // payload may include { bucketSize?: number } to control the entity index
    const bs =
      isObject(payload) && 'bucketSize' in payload ? Number(payload['bucketSize']) : undefined;
    await initRapier();

    // If Rapier imported but world wasn't constructed (no exception thrown),
    // surface a diagnostic so test harness can see why initialization reported ok:false.
    if (!world) {
      try {
        WG.postMessage({
          type: 'init-physics-error',
          error: 'Rapier world not constructed',
          rapierLoaded: !!Rapier,
        });
      } catch {
        /* best-effort */
      }
    }

    // Best-effort: if entityIndex module is available, initialize a worker-local index
    try {
      let postedEntityInit = false;
      try {
        const mod = await import('./core/entityIndex.js');
        const maybeInit = (mod as { initEntityIndex?: unknown })['initEntityIndex'];
        if (typeof maybeInit === 'function') {
          try {
            entityIndex = (maybeInit as (bs?: number) => EntityIndexAPI)(bs ?? 50);
            entityIndexKnownIds.clear();
            WG.postMessage({ type: 'init-entity-index-done', ok: true });
            postedEntityInit = true;
          } catch (e) {
            void e;
            entityIndex = null;
            WG.postMessage({ type: 'init-entity-index-done', ok: false });
            postedEntityInit = true;
          }
        }
      } catch {
        // ignore dynamic import errors — entity index initialization is optional
      }
      if (!postedEntityInit) {
        // Notify caller the worker attempted (or skipped) auto-init but did not
        // produce a positive init. Keeps the API deterministic for tests.
        WG.postMessage({ type: 'init-entity-index-done', ok: false });
      }
    } catch {
      /* ignore */
    }

    WG.postMessage({ type: 'init-physics-done', ok: !!world });
    return;
  }

  if (type === 'init-entity-index') {
    // payload: { bucketSize?: number }
    try {
      const bs =
        isObject(payload) && 'bucketSize' in payload ? Number(payload['bucketSize']) : undefined;
      // Dynamic import to avoid bundling issues in worker build
      const mod = await import('./core/entityIndex.js');
      const maybeInit = (mod as { initEntityIndex?: unknown })['initEntityIndex'];
      if (typeof maybeInit === 'function') {
        try {
          // runtime call; TypeScript type is EntityIndexAPI
          entityIndex = (maybeInit as (bs?: number) => EntityIndexAPI)(bs ?? 50);
          entityIndexKnownIds.clear();
          WG.postMessage({ type: 'init-entity-index-done', ok: true });
        } catch (e) {
          void e;
          entityIndex = null;
          WG.postMessage({ type: 'init-entity-index-done', ok: false });
        }
      } else {
        WG.postMessage({ type: 'init-entity-index-done', ok: false });
      }
    } catch (e) {
      void e;
      entityIndex = null;
      WG.postMessage({ type: 'init-entity-index-done', ok: false });
    }
    return;
  }

  if (type === 'dispose-entity-index') {
    try {
      if (entityIndex) {
        try {
          // Attempt to clear world.entities if available
          const worldObj = (entityIndex as EntityIndexAPI).world as unknown;
          if (isObject(worldObj) && Array.isArray((worldObj as { entities?: unknown }).entities)) {
            (worldObj as { entities?: unknown[] }).entities!.length = 0;
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    entityIndex = null;
    entityIndexKnownIds.clear();
    WG.postMessage({ type: 'dispose-entity-index-done' });
    return;
  }

  if (type === 'debug-entity-index-count') {
    try {
      if (entityIndex) {
        const worldObj = (entityIndex as EntityIndexAPI).world as unknown;
        let count = 0;
        if (isObject(worldObj) && Array.isArray((worldObj as { entities?: unknown }).entities)) {
          count = ((worldObj as { entities?: unknown[] }).entities || []).length;
        }
        WG.postMessage({ type: 'debug-entity-index-count-done', ok: true, count });
      } else {
        WG.postMessage({ type: 'debug-entity-index-count-done', ok: false, count: 0 });
      }
    } catch {
      WG.postMessage({ type: 'debug-entity-index-count-done', ok: false, count: 0 });
    }
    return;
  }

  if (type === 'update-ships') {
    // Update/create bodies for ships
    if (!isObject(payload) || !('ships' in payload)) {
      WG.postMessage({ type: 'update-ships-done' });
      return;
    }
    const shipDataArray = payload['ships'] as unknown as Float32Array;
    const currentShipIds = new Set<number>();

    for (let i = 0; i < shipDataArray.length; i += 7) {
      const id = shipDataArray[i];
      const pos = { x: shipDataArray[i + 1], y: shipDataArray[i + 2], z: shipDataArray[i + 3] };
      const vel = { x: shipDataArray[i + 4], y: shipDataArray[i + 5], z: shipDataArray[i + 6] };
      const ship = { id, pos, vel }; // Reconstruct ship-like object

      currentShipIds.add(id);

      let body = bodies.get(id);

      if (!body) {
        // Create new body
        body = createBodyForShip(ship);
        if (body) {
          bodies.set(id, body);
        }
      } else {
        // Update existing body
        updateBodyFromShip(body, ship);
      }
      // Also update/add entityIndex registration if present (best-effort)
      if (entityIndex) {
        try {
          if (entityIndexKnownIds.has(id)) {
            try {
              entityIndex.update({ id, x: pos.x, y: pos.y, z: pos.z });
            } catch {
              try {
                // Fallback to add if update fails
                entityIndex.add({ id, x: pos.x, y: pos.y, z: pos.z });
                entityIndexKnownIds.add(id);
              } catch {
                /* ignore */
              }
            }
          } else {
            try {
              entityIndex.add({ id, x: pos.x, y: pos.y, z: pos.z });
              entityIndexKnownIds.add(id);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* best-effort */
        }
      }
    }

    // Remove bodies for ships that no longer exist
    for (const [shipId, body] of bodies) {
      if (!currentShipIds.has(shipId)) {
        try {
          if (world && body) world.removeRigidBody(body);
          bodies.delete(shipId);
        } catch (e) {
          void e;
          logger.error('Failed to remove physics body:', e);
        }
      }
    }

    // Also remove any entityIndex entries for ids no longer present
    try {
      if (entityIndex) {
        for (const knownId of Array.from(entityIndexKnownIds)) {
          if (!currentShipIds.has(knownId)) {
            try {
              entityIndex!.remove(knownId);
            } catch {
              /* ignore */
            }
            entityIndexKnownIds.delete(knownId);
          }
        }
      }
    } catch {
      /* best-effort */
    }

    WG.postMessage({
      type: 'update-ships-done',
    });
    return;
  }

  if (type === 'fire-bullet') {
    // payload: { id, ownerShipId, ownerTeam, pos, vel, ttl, damage }
    if (!isObject(payload)) {
      WG.postMessage({ type: 'fire-bullet-done', success: false });
      return;
    }

    const bulletData = payload as {
      id: number;
      ownerShipId: number;
      ownerTeam: 'red' | 'blue';
      pos: Vec3;
      vel: Vec3;
      ttl: number;
      damage: number;
    };

    const bullet: BulletLike = {
      id: bulletData.id,
      ownerShipId: bulletData.ownerShipId,
      ownerTeam: bulletData.ownerTeam,
      pos: { ...bulletData.pos },
      vel: { ...bulletData.vel },
      ttl: bulletData.ttl,
      damage: bulletData.damage,
    };

    bullets.set(bullet.id, bullet);
    const body = createBulletBody(bullet);
    if (body) {
      bulletBodies.set(bullet.id, body);
    }

    WG.postMessage({ type: 'fire-bullet-done', success: true, bulletId: bullet.id });
    return;
  }

  if (type === 'remove-bullet') {
    // payload: { bulletId }
    if (!isObject(payload) || !('bulletId' in payload)) {
      WG.postMessage({ type: 'remove-bullet-done', success: false });
      return;
    }

    const bulletId = Number(payload['bulletId']);
    const body = bulletBodies.get(bulletId);
    if (body && world) {
      try {
        world.removeRigidBody(body);
      } catch (e) {
        void e;
        logger.error('Failed to remove bullet body:', e);
      }
    }

    bullets.delete(bulletId);
    bulletBodies.delete(bulletId);
    WG.postMessage({ type: 'remove-bullet-done', success: true, bulletId });
    return;
  }

  if (type === 'step-physics') {
    const dt = isObject(payload) && 'dt' in payload ? Number(payload['dt']) || 0.016 : 0.016;
    try {
      if (world) {
        world.timestep = dt;
        const t0 = isDebugPerfEnabled() ? performance.now() : 0;
        if (typeof world.step === 'function') world.step();
        const stepMs = isDebugPerfEnabled() ? performance.now() - t0 : 0;

        // Update bullet physics and handle expiration
        const t1 = isDebugPerfEnabled() ? performance.now() : 0;
        const bulletEvents = updateBulletTimers(dt);
        for (const bulletId of bullets.keys()) {
          updateBulletFromPhysics(bulletId);
        }
        const bulletUpdateMs = isDebugPerfEnabled() ? performance.now() - t1 : 0;

        // Collect transforms after physics step
        const t2 = isDebugPerfEnabled() ? performance.now() : 0;
        const transforms = collectTransforms();
        const bulletTransforms = collectBulletTransforms();
        const collectMs = isDebugPerfEnabled() ? performance.now() - t2 : 0;

        // Pack transforms into a single transferable buffer per frame
        // Layout: [ship count, ship data..., bullet count, bullet data...]
        // Ship data: [id, px, py, pz, vx, vy, vz] (7 floats per ship)
        // Bullet data: [id, px, py, pz, vx, vy, vz, ttl] (8 floats per bullet)
        let postMs = 0;
        try {
          const t3 = isDebugPerfEnabled() ? performance.now() : 0;
          if (transforms.length || bulletTransforms.length) {
            const shipDataSize = transforms.length * 7;
            const bulletDataSize = bulletTransforms.length * 8;
            const out = new Float32Array(2 + shipDataSize + bulletDataSize); // +2 for counts
            let o = 0;
            
            // Write ship count and ship data
            out[o++] = transforms.length;
            for (let i = 0; i < transforms.length; ++i) {
              const tr = transforms[i];
              out[o++] = Number(tr.shipId) || 0;
              out[o++] = Number(tr.pos.x) || 0;
              out[o++] = Number(tr.pos.y) || 0;
              out[o++] = Number(tr.pos.z) || 0;
              out[o++] = Number(tr.vel.x) || 0;
              out[o++] = Number(tr.vel.y) || 0;
              out[o++] = Number(tr.vel.z) || 0;
            }

            // Write bullet count and bullet data
            out[o++] = bulletTransforms.length;
            for (let i = 0; i < bulletTransforms.length; ++i) {
              const bt = bulletTransforms[i];
              out[o++] = Number(bt.bulletId) || 0;
              out[o++] = Number(bt.pos.x) || 0;
              out[o++] = Number(bt.pos.y) || 0;
              out[o++] = Number(bt.pos.z) || 0;
              out[o++] = Number(bt.vel.x) || 0;
              out[o++] = Number(bt.vel.y) || 0;
              out[o++] = Number(bt.vel.z) || 0;
              out[o++] = Number(bt.ttl) || 0;
            }

            // Transfer the underlying buffer to avoid structured-clone
            postMessageTransferable({ 
              type: 'step-physics-done', 
              dt, 
              transformsBuffer: out.buffer,
              bulletEvents 
            }, [out.buffer]);
            postMs = isDebugPerfEnabled() ? performance.now() - t3 : 0;

            if (isDebugPerfEnabled()) {
              postPerf('physics.step', stepMs);
              postPerf('physics.bulletUpdate', bulletUpdateMs);
              postPerf('physics.collect', collectMs);
              postPerf('physics.postMessage', postMs);
              try {
                postPerf('physics.payload.approxKB', out.byteLength / 1000);
                postPerf('physics.bullets.count', bulletTransforms.length);
              } catch (_e) {
                void _e;
              }
            }
          } else {
            // No transforms to send: keep legacy message shape
            WG.postMessage({ type: 'step-physics-done', dt, bulletEvents });
            postMs = isDebugPerfEnabled() ? performance.now() - t3 : 0;
            if (isDebugPerfEnabled()) {
              postPerf('physics.step', stepMs);
              postPerf('physics.bulletUpdate', bulletUpdateMs);
              postPerf('physics.collect', collectMs);
              postPerf('physics.postMessage', postMs);
            }
          }
        } catch {
          // Fallback to legacy object-based message if packing/posting fails
          try {
            WG.postMessage({ type: 'step-physics-done', dt, transforms, bulletTransforms, bulletEvents });
          } catch (_ee) {
            void _ee;
            WG.postMessage({ type: 'step-physics-done', dt, bulletEvents });
          }
          if (isDebugPerfEnabled()) {
            postPerf('physics.step', stepMs);
            postPerf('physics.bulletUpdate', bulletUpdateMs);
            postPerf('physics.collect', collectMs);
          }
        }
      } else {
        WG.postMessage({ type: 'step-physics-done', dt });
      }
    } catch (_err) {
      void _err;
      logger.error('Sim worker step error:', _err);
      WG.postMessage({ type: 'step-physics-error', error: String(_err) });
    }
    return;
  }

  if (type === 'dispose-physics') {
    try {
      world?.free?.();
      bodies.clear();
      bulletBodies.clear();
      bullets.clear();
    } catch {
      /* ignore */
    }
    world = null;
    Rapier = null;
    WG.postMessage({ type: 'dispose-physics-done' });
    return;
  }

  // AI Message Handlers
  if (type === 'init-ai') {
    try {
      await initAI(payload);
      WG.postMessage({ type: 'init-ai-done', ok: !!aiController });
    } catch (e) {
      WG.postMessage({ type: 'init-ai-done', ok: false, error: String(e) });
    }
    return;
  }

  if (type === 'step-ai') {
    if (!aiController) {
      WG.postMessage({ type: 'step-ai-done', error: 'AI not initialized' });
      return;
    }
    
    try {
      const aiPayload = payload as { dt: number; gameState: unknown };
      const dt = aiPayload.dt || 0.016;
      const gameState = aiPayload.gameState as GameState;
      
      // Update AI controller with new game state data
      // This is a simplified approach - in practice we'd need more sophisticated state synchronization
      (aiController as any).state = gameState;
      
      // Run AI update
      aiController.updateAllShips(dt);
      
      // Collect AI results (target assignments, ship AI states, etc.)
      const aiResults = {
        ships: gameState.ships.map(ship => ({
          id: ship.id,
          targetId: ship.targetId,
          aiState: ship.aiState
        }))
      };
      
      WG.postMessage({ type: 'step-ai-done', aiResults });
    } catch (e) {
      WG.postMessage({ type: 'step-ai-error', error: String(e) });
    }
    return;
  }

  if (type === 'dispose-ai') {
    aiController = null;
    spatialGrid = null;
    aggressiveSpatialOptimizer = null;
    WG.postMessage({ type: 'dispose-ai-done' });
    return;
  }

  // echo for unknown messages
  WG.postMessage({ type: 'unknown', payload });
});

export {};

// Perf toggle via URL param on worker script (debugPerf=1)
function isDebugPerfEnabled(): boolean {
  try {
    const href = S.location?.href as string | undefined;
    if (!href) return false;
    return href.includes('debugPerf=1');
  } catch {
    return false;
  }
}

function _stepWorldOnce() {
  if (!world || typeof world.step !== 'function') return;
  const t0 = isDebugPerfEnabled() ? performance.now() : 0;
  world.step?.();
  if (isDebugPerfEnabled()) postPerf('physics.step', performance.now() - t0);
}

function postPerf(name: string, valueMs: number) {
  if (!isDebugPerfEnabled()) return;
  try {
    WG.postMessage({
      type: 'perf',
      name,
      ms: valueMs,
    });
  } catch {
    /* ignore */
  }
}

// Helper to post a message with transferable buffers from the worker. This
// wraps the global Worker.postMessage shape and narrows the transfer list
// typing so TypeScript is satisfied without using `any` in call sites.
function postMessageTransferable(message: unknown, transfer?: Transferable[]) {
  try {
  // WorkerGlobalLike.postMessage overloads are environment-dependent; call
  // at runtime and pass transfer list. Use a ts-ignore to silence strict
  // environment typing since this runs in a worker context.
  // @ts-ignore runtime call - acceptable in worker context
  WG.postMessage(message, transfer);
  } catch (_err) {
    // swallow errors - best-effort messaging
    void _err;
  }
}
