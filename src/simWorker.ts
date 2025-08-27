// Sim worker: handle Rapier physics in a worker and accept messages from main thread
let world: any = null;
let Rapier: any = null;

async function initRapier() {
  if (Rapier) return;
  try {
    // Use dynamic import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Rapier = require('@dimforge/rapier3d-compat');
    world = new Rapier.World({ x: 0, y: 0, z: 0 });
  } catch (e) {
    Rapier = null; world = null;
  }
}

self.addEventListener('message', async (e) => {
  const { type, payload } = e.data || {};
  if (type === 'init-physics') {
    await initRapier();
    (self as any).postMessage({ type: 'init-physics-done', ok: !!world });
    return;
  }
  if (type === 'step-physics') {
    const dt = payload?.dt ?? 0.016;
    try {
      if (world) {
        world.timestep = dt;
        world.step();
      }
      // Optionally post back minimal debug info (e.g., timestamp)
      (self as any).postMessage({ type: 'step-physics-done', dt });
    } catch (err) {
      (self as any).postMessage({ type: 'step-physics-error', error: String(err) });
    }
    return;
  }
  if (type === 'dispose-physics') {
    try { world?.free?.(); } catch (e) { /* ignore */ }
    world = null; Rapier = null;
    (self as any).postMessage({ type: 'dispose-physics-done' });
    return;
  }
  // echo for unknown messages
  (self as any).postMessage({ type: 'unknown', payload });
});

export {};
