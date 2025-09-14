// Sim worker: handle Rapier physics in a worker and accept messages from main thread
// Ensure dynamic chunk loads inside this worker resolve to the project's dist root
// so that webpack's generated chunk path like `workers/rapier.*.js` resolves to
// `/dist/workers/rapier.*.js` instead of `/dist/workers/workers/...` (double path).
// We set the public path to the parent directory of this worker script at runtime.

// Minimal typed view of the global `self` for early bootstrap checks
type SelfLikeForBootstrap = { location?: { href?: string } } & typeof self;
const S = (typeof self !== 'undefined' ? (self as unknown as SelfLikeForBootstrap) : ({} as SelfLikeForBootstrap));

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

// Worker global typed view for message/postMessage usage
type WorkerGlobalLike = { postMessage(m: unknown): void; location?: { href?: string } } & typeof self;
const WG = (self as unknown) as WorkerGlobalLike;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

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
    Rapier = null;
    world = null;
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

self.addEventListener('message', async (e: MessageEvent) => {
  // Guard and narrow incoming message shape to avoid `any`
  const raw = e.data as unknown;
  if (typeof raw !== 'object' || raw === null) {
    WG.postMessage({ type: 'unknown', payload: raw });
    return;
  }
  const { type, payload } = raw as { type?: string; payload?: unknown };

  if (type === 'init-physics') {
    await initRapier();
    WG.postMessage({ type: 'init-physics-done', ok: !!world });
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

    WG.postMessage({
      type: 'update-ships-done',
    });
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

        // Collect transforms after physics step
        const t1 = isDebugPerfEnabled() ? performance.now() : 0;
        const transforms = collectTransforms();
        const collectMs = isDebugPerfEnabled() ? performance.now() - t1 : 0;

        const t2 = isDebugPerfEnabled() ? performance.now() : 0;
        WG.postMessage({
          type: 'step-physics-done',
          dt,
          transforms,
        });
        const postMs = isDebugPerfEnabled() ? performance.now() - t2 : 0;
        if (isDebugPerfEnabled()) {
          postPerf('physics.step', stepMs);
          postPerf('physics.collect', collectMs);
          postPerf('physics.postMessage', postMs);
          // Rough payload size measurement
          try {
            const approxBytes = JSON.stringify(transforms).length;
            postPerf('physics.payload.approxBytes', approxBytes / 1000);
          } catch (_e) { void _e; }
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
    } catch {
      /* ignore */
    }
    world = null;
    Rapier = null;
    WG.postMessage({ type: 'dispose-physics-done' });
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
