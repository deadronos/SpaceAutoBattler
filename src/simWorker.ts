// Sim worker: handle Rapier physics in a worker and accept messages from main thread
import * as logger from './utils/logger.js';

let world: any = null;
let Rapier: any = null;
const bodies = new Map<number, any>(); // shipId -> rigidBody

async function initRapier() {
  if (Rapier) return;
  try {
    // Use dynamic import
     
    Rapier = require('@dimforge/rapier3d-compat');
    world = new Rapier.World({ x: 0, y: 0, z: 0 });
  } catch {
    Rapier = null; world = null;
  }
}

function createBodyForShip(ship: any) {
  if (!world || !Rapier) return null;
  
  try {
    // Create a dynamic rigid body for the ship
    const rigidBodyDesc = Rapier.RigidBodyDesc.dynamic()
      .setTranslation(ship.pos.x, ship.pos.y, ship.pos.z)
      .setLinvel(ship.vel.x, ship.vel.y, ship.vel.z);
    
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Add a collider (simple box for now)
    const colliderDesc = Rapier.ColliderDesc.cuboid(5, 2, 5);
    world.createCollider(colliderDesc, rigidBody);
    
    return rigidBody;
  } catch {
    // Log the caught error
    // Note: name the caught error so TypeScript can reference it
    const _e = undefined as unknown; // fallback to satisfy formatting if needed
    try { throw new Error('createBodyForShip failure'); } catch (e) { void e;logger.error('Failed to create physics body for ship:', e); }
    return null;
  }
}

function updateBodyFromShip(body: any, ship: any) {
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
  const transforms: any[] = [];
  
  for (const [shipId, body] of bodies) {
    if (!body) continue;
    
    try {
      const translation = body.translation();
      const linvel = body.linvel();
      
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
    (self as any).postMessage({ type: 'init-physics-done', ok: !!world });
    return;
  }
  
  if (type === 'update-ships') {
    // Update/create bodies for ships
    const ships = payload?.ships || [];
    
    for (const ship of ships) {
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
    const currentShipIds = new Set(ships.map((s: any) => s.id));
    for (const [shipId, body] of bodies) {
      if (!currentShipIds.has(shipId)) {
        try {
          world.removeRigidBody(body);
          bodies.delete(shipId);
        } catch (e) { void e;logger.error('Failed to remove physics body:', e);
        }
      }
    }
    
    (self as any).postMessage({ type: 'update-ships-done' });
    return;
  }
  
  if (type === 'step-physics') {
    const dt = payload?.dt ?? 0.016;
    try {
      if (world) {
        world.timestep = dt;
        world.step();
        
        // Collect transforms after physics step
        const transforms = collectTransforms();
        
        (self as any).postMessage({ 
          type: 'step-physics-done', 
          dt,
          transforms 
        });
      } else {
        (self as any).postMessage({ type: 'step-physics-done', dt });
      }
    } catch (_err) { void _err;logger.error('Sim worker step error:', _err);
      (self as any).postMessage({ type: 'step-physics-error', error: String(_err) });
    }
    return;
  }
  
  if (type === 'dispose-physics') {
    try { 
      world?.free?.(); 
      bodies.clear();
    } catch { /* ignore */ }
    world = null; Rapier = null;
    (self as any).postMessage({ type: 'dispose-physics-done' });
    return;
  }
  
  // echo for unknown messages
  (self as any).postMessage({ type: 'unknown', payload });
});

export {};


