import { expect, test } from 'vitest';
import { createInitialState } from '../../src/core/gameState.js';
import { bindUI } from '../../src/ui/bindUI.js';
import { wireControls } from '../../src/ui/wireControls.js';
import { simulateStep } from '../../src/core/gameState.js';
import { RendererConfig } from '../../src/config/rendererConfig.js';

// Minimal DOM elements required by bindUI() / wireControls()
function createMinimalDOM() {
  const ids = [
    'world',
    'startPause',
    'reset',
    'addRed',
    'addBlue',
    'toggleTrails',
    'speed',
    'redScore',
    'blueScore',
    'stats',
    'continuousCheckbox',
    'seedBtn',
    'formationBtn',
  ];
  for (const id of ids) {
    if (!document.getElementById(id)) {
      const el = id === 'world' ? document.createElement('canvas') : document.createElement('button');
      el.id = id;
      if (id === 'continuousCheckbox') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        document.body.appendChild(input);
      } else {
        document.body.appendChild(el);
      }
    }
  }
}

test('clicking Start when worker-ready sends step-ai message', () => {
  createMinimalDOM();
  const state = createInitialState();
  const ui = bindUI();

  // Recording worker - captures posted messages
  const recorded: any[] = [];
  const recordingWorker = {
    postMessage(msg: any, _transfer?: any) {
      recorded.push(msg);
    },
  } as unknown as Worker;

  // Install a simple physicsStepper that delegates AI steps to our recording worker
  // The stepAI implementation mirrors main.ts packing but keeps it minimal for the assertion
  (state as any).physicsStepper = {
    step: () => {},
    stepAI(dt: number) {
      // Simulate packing buffers (empty arrays ok)
      const shipsBuffer = new Float32Array(0);
      const bulletsBuffer = new Float32Array(0);
      recordingWorker.postMessage({
        type: 'step-ai',
        payload: { dt, shipsBuffer: shipsBuffer.buffer, bulletsBuffer: bulletsBuffer.buffer },
      });
    },
  } as any;

  // Ensure RendererConfig allows AI worker mode
  (RendererConfig as any).useSimWorker = true;
  (RendererConfig as any).useAIWorker = true;

  // Wire UI handlers (start button onclick)
  wireControls(state as any, ui as any);

  // Initially not running
  expect(state.running).toBe(false);

  // Simulate clicking Start
  ui.startPause.click();
  expect(state.running).toBe(true);

  // Call a single simulateStep which should call stepAI and thus post to worker
  const dt = 1 / (state.simConfig.tickRate ?? 60);
  // Sanity check: ensure simulateStep will choose AI worker path
  const useSimWorker = (RendererConfig as any).useSimWorker ?? true;
  const useAIWorker = (RendererConfig as any).useAIWorker ?? true;
  const shouldUseAIWorker = useSimWorker && useAIWorker && !!(state as any).physicsStepper?.stepAI;
  if (!shouldUseAIWorker) {
    // Provide helpful failure context instead of silent false negative
    throw new Error(
      `Test setup invalid: shouldUseAIWorker=false (useSimWorker=${String(useSimWorker)}, useAIWorker=${String(useAIWorker)}, hasStepAI=${String(!!(state as any).physicsStepper?.stepAI)})`,
    );
  }

  simulateStep(state as any, dt);

  // Assert we recorded at least one 'step-ai' message
  const hasStepAi = recorded.some((m) => m && m.type === 'step-ai');
  expect(hasStepAi).toBe(true);
});

test('step-ai payload contains expected ship/bullet buffer sizes when ships/bullets exist', () => {
  createMinimalDOM();
  const state = createInitialState();
  const ui = bindUI();

  // Add one ship and one bullet to state
  state.ships.push({
    id: 42,
    pos: { x: 10, y: 20, z: 30 },
    prevPos: { x: 10, y: 20, z: 30 },
    vel: { x: 1, y: 2, z: 3 },
    health: 100,
    targetId: null,
    team: 'red',
    class: 'fighter',
    orientation: { pitch: 0, yaw: 0, roll: 0 },
    prevOrientation: { pitch: 0, yaw: 0, roll: 0 },
    turrets: [],
  } as any);

  state.bullets.push({
    id: 7,
    ownerShipId: 42,
    ownerTeam: 'red',
    pos: { x: 0, y: 0, z: 0 },
    prevPos: { x: 0, y: 0, z: 0 },
    vel: { x: 100, y: 0, z: 0 },
    ttl: 3,
    damage: 5,
  } as any);

  const recorded: any[] = [];
  const recordingWorker = {
    postMessage(msg: any, _transfer?: any) {
      // clone message minimally to avoid transferring buffers away
      const copy = { ...msg };
      // If payload contains ArrayBuffer, copy references for assertions
      if (msg && msg.payload) copy.payload = { ...msg.payload };
      recorded.push(copy);
    },
  } as unknown as Worker;

  // Mirror main.ts packing logic for AI step
  (state as any).physicsStepper = {
    step: () => {},
    stepAI(dt: number) {
      const floatsPerShip = 11; // follows main.ts
      const shipsBuffer = new Float32Array(state.ships.length * floatsPerShip);
      for (let i = 0; i < state.ships.length; i++) {
        const s = state.ships[i] as any;
        const offset = i * floatsPerShip;
        shipsBuffer[offset + 0] = s.id;
        shipsBuffer[offset + 1] = s.pos.x;
        shipsBuffer[offset + 2] = s.pos.y;
        shipsBuffer[offset + 3] = s.pos.z;
        shipsBuffer[offset + 4] = s.vel.x;
        shipsBuffer[offset + 5] = s.vel.y;
        shipsBuffer[offset + 6] = s.vel.z;
        shipsBuffer[offset + 7] = s.health;
        shipsBuffer[offset + 8] = s.targetId ?? -1;
        shipsBuffer[offset + 9] = s.team === 'red' ? 0 : 1;
        shipsBuffer[offset + 10] = 0; // class placeholder
      }

      const floatsPerBullet = 11;
      const bulletsBuffer = new Float32Array(state.bullets.length * floatsPerBullet);
      for (let i = 0; i < state.bullets.length; i++) {
        const b = state.bullets[i] as any;
        const off = i * floatsPerBullet;
        bulletsBuffer[off + 0] = b.id;
        bulletsBuffer[off + 1] = b.pos.x;
        bulletsBuffer[off + 2] = b.pos.y;
        bulletsBuffer[off + 3] = b.pos.z;
        bulletsBuffer[off + 4] = b.vel.x;
        bulletsBuffer[off + 5] = b.vel.y;
        bulletsBuffer[off + 6] = b.vel.z;
        bulletsBuffer[off + 7] = b.ttl;
        bulletsBuffer[off + 8] = b.damage;
        bulletsBuffer[off + 9] = b.ownerShipId;
        bulletsBuffer[off + 10] = b.ownerTeam === 'red' ? 0 : 1;
      }

      recordingWorker.postMessage({
        type: 'step-ai',
        payload: { dt, shipsBuffer: shipsBuffer.buffer, bulletsBuffer: bulletsBuffer.buffer },
      });
    },
  } as any;

  (RendererConfig as any).useSimWorker = true;
  (RendererConfig as any).useAIWorker = true;

  wireControls(state as any, ui as any);

  // Click Start
  ui.startPause.click();
  expect(state.running).toBe(true);

  // Run simulateStep which should invoke our stepAI and record buffers
  const dt = 1 / (state.simConfig.tickRate ?? 60);
  // Snapshot expected counts here to avoid race/mutation issues later
  const expectedStateCounts = { ships: state.ships.length, bullets: state.bullets.length };
  simulateStep(state as any, dt);

  // Find last step-ai message (don't mutate recorded array)
  const msg = [...recorded].reverse().find((m) => m && m.type === 'step-ai');
  expect(msg).toBeDefined();
  expect(msg.payload).toBeDefined();
  const shipsBuf = msg.payload.shipsBuffer as ArrayBuffer;
  const bulletsBuf = msg.payload.bulletsBuffer as ArrayBuffer;
  const floatsPerShip = 11;
  const floatsPerBullet = 11;

  expect(shipsBuf).toBeInstanceOf(ArrayBuffer);
  expect(bulletsBuf).toBeInstanceOf(ArrayBuffer);
  // Snapshot expected counts before the simulateStep call to avoid timing/state mutation issues
  // (we added ships/bullets above, so these capture the intended counts)
  const expectedShips = expectedStateCounts.ships;
  const expectedBullets = expectedStateCounts.bullets;
  expect(shipsBuf.byteLength).toBe(expectedShips * floatsPerShip * 4);
  expect(bulletsBuf.byteLength).toBe(expectedBullets * floatsPerBullet * 4);
});
