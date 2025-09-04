// Sim worker: handle Rapier physics in a worker and accept messages from main thread
// Ensure dynamic chunk loads inside this worker resolve to the project's dist root
// so that webpack's generated chunk path like `workers/rapier.*.js` resolves to
// `/dist/workers/rapier.*.js` instead of `/dist/workers/workers/...` (double path).
// We set the public path to the parent directory of this worker script at runtime.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - webpack global variable
if (typeof __webpack_public_path__ !== 'undefined') {
  try {
    // Use the worker's own location.href to compute the public path. This avoids
    // referencing `import.meta` (which can confuse some parsers) and is reliable
    // in dedicated worker contexts where `self.location.href` points at the
    // worker script URL (e.g. /dist/workers/917.x.js).
    if (typeof self !== 'undefined' && (self as any).location && typeof (self as any).location.href === 'string') {
      const metaUrl = ((self as any).location.href as string).replace(/\\/g, '/');
      const workersIndex = metaUrl.lastIndexOf('/workers/');
      const parent = workersIndex !== -1 ? metaUrl.slice(0, workersIndex + 1) : (metaUrl.slice(0, metaUrl.lastIndexOf('/') + 1) || './');
      // @ts-expect-error set runtime public path
      __webpack_public_path__ = parent;
    }
  } catch (_e) { /* ignore */ }
}

import * as logger from './utils/logger.js';

// Small local types to avoid broad `any` while keeping runtime semantics
type Vec3 = { x: number; y: number; z: number };
type ShipLike = { id: number; pos: Vec3; vel: Vec3; } & Record<string, unknown>;
type RigidBodyLike = { setTranslation: (t: Vec3, wake?: boolean) => void; setLinvel: (v: Vec3, wake?: boolean) => void; translation?: () => Vec3; linvel?: () => Vec3 };
type WorldLike = { createRigidBody: (desc: unknown) => RigidBodyLike; createCollider: (desc: unknown, body?: RigidBodyLike) => void; removeRigidBody: (body: RigidBodyLike) => void; step?: () => void; timestep?: number; free?: () => void };
type RapierModuleLike = { RigidBodyDesc?: unknown; ColliderDesc?: unknown; World?: unknown } & Record<string, unknown>;

let world: WorldLike | null = null;
let Rapier: RapierModuleLike | null = null;
const bodies = new Map<number, RigidBodyLike | null>(); // shipId -> rigidBody

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
  try {
    // If W is a constructor
    world = new (W as unknown as WorldConstructor)({ x: 0, y: 0, z: 0 });
  } catch {
    try {
      // If W is a factory function
      world = (W as unknown as (opts?: unknown) => WorldLike)({ x: 0, y: 0, z: 0 });
    } catch {
      world = null;
    }
  }
  } catch {
    Rapier = null; world = null;
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
    const rigidBodyDesc = (typeof dynamicFn === 'function') ? dynamicFn() : {};
    const rbdObj = rigidBodyDesc as { setTranslation?: (x: number, y: number, z: number) => void; setLinvel?: (x: number, y: number, z: number) => void };
    if (typeof rbdObj.setTranslation === 'function') {
      rbdObj.setTranslation(ship.pos.x, ship.pos.y, ship.pos.z);
    }
    if (typeof rbdObj.setLinvel === 'function') {
      rbdObj.setLinvel(ship.vel.x, ship.vel.y, ship.vel.z);
    }

    const rigidBody = world.createRigidBody(rigidBodyDesc as unknown);

    // Add a collider (simple box for now) if API present
    const cuboidFn = (CDesc as CDescType | undefined)?.cuboid;
    const colliderDesc = (typeof cuboidFn === 'function') ? cuboidFn(5, 2, 5) : null;
    if (colliderDesc && world) world.createCollider(colliderDesc, rigidBody as RigidBodyLike);

    return rigidBody as RigidBodyLike;
  } catch {
    // Log the caught error
    // Note: name the caught error so TypeScript can reference it
    const _e = undefined as unknown; // fallback to satisfy formatting if needed
    try { throw new Error('createBodyForShip failure'); } catch (e) { void e;logger.error('Failed to create physics body for ship:', e); }
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
    try { throw new Error('updateBodyFromShip failure'); } catch (e) { void e;logger.error('Failed to update physics body:', e); }
  }
}

function collectTransforms() {
  const transforms: Array<{ shipId: number; pos: Vec3; vel: Vec3 }> = [];
  
  for (const [shipId, body] of bodies) {
    if (!body) continue;
    
    try {
      const translation = typeof body.translation === 'function' ? body.translation() : { x: 0, y: 0, z: 0 };
      const linvel = typeof body.linvel === 'function' ? body.linvel() : { x: 0, y: 0, z: 0 };

      transforms.push({
        shipId,
        pos: { x: translation.x, y: translation.y, z: translation.z },
        vel: { x: linvel.x, y: linvel.y, z: linvel.z }
      });
    } catch (e) { void e;logger.error('Failed to collect transform for ship', shipId, e);
    }
  }
  
  return transforms;
}

self.addEventListener('message', async (e) => {
  const { type, payload } = e.data || {};
  
  if (type === 'init-physics') {
    await initRapier();
    const workerPost = (self as unknown as { postMessage: (m: unknown) => void }).postMessage;
    workerPost({ type: 'init-physics-done', ok: !!world });
    return;
  }
  
  if (type === 'update-ships') {
    // Update/create bodies for ships
  const ships = payload?.ships || [];
    
  for (const ship of ships as unknown as ShipLike[]) {
      let body = bodies.get(ship.id);
      
      if (!body) {
        // Create new body
        body = createBodyForShip(ship);
        if (body) {
          bodies.set(ship.id, body);
        }
      } else {
        // Update existing body
        updateBodyFromShip(body, ship);
      }
    }
    
    // Remove bodies for ships that no longer exist
    const currentShipIds = new Set((ships as unknown as Array<{ id: number }>).map((s) => s.id));
    for (const [shipId, body] of bodies) {
      if (!currentShipIds.has(shipId)) {
        try {
          if (world && body) world.removeRigidBody(body);
          bodies.delete(shipId);
        } catch (e) { void e;logger.error('Failed to remove physics body:', e);
        }
      }
    }
    
    (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ type: 'update-ships-done' });
    return;
  }
  
  if (type === 'step-physics') {
    const dt = payload?.dt ?? 0.016;
    try {
        if (world) {
        world.timestep = dt;
        if (typeof world.step === 'function') world.step();
        
        // Collect transforms after physics step
        const transforms = collectTransforms();
        
        (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ 
          type: 'step-physics-done', 
          dt,
          transforms 
        });
      } else {
        (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ type: 'step-physics-done', dt });
      }
    } catch (_err) { void _err;logger.error('Sim worker step error:', _err);
      (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ type: 'step-physics-error', error: String(_err) });
    }
    return;
  }
  
  if (type === 'dispose-physics') {
    try { 
      world?.free?.(); 
      bodies.clear();
    } catch { /* ignore */ }
    world = null; Rapier = null;
    (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ type: 'dispose-physics-done' });
    return;
  }
  
  // echo for unknown messages
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ type: 'unknown', payload });
});

export {};


