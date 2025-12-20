import type {
  AiOverrideSlice,
  CreatedEntity,
  MainToWorkerMessage,
  TransformSoALayout,
  WorkerToMainMessage,
} from './protocol.js';
import { createGameState, spawnInitialFleets } from '../game/state.js';
import { updateGame } from '../game/systems.js';
import { SeededRng } from '../utils/rng.js';
import { SlotAllocator } from './slotAllocator.js';
import { createTransformSoAViews } from './transformsLayout.js';
import type { GameEntity, GameState, ShipHull, Team } from '../types/index.js';

type WorkerScope = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
  close: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

const workerScope = globalThis as unknown as WorkerScope;

let aiOverrides: AiOverrideSlice = {
  aiVerticalEnabled: null,
  aiEngagementBoostEnabled: null,
  aiTickRateExperimentEnabled: null,
  aiRangePolicy: null,
  aiSmoothingEnabled: null,
  aiHysteresisEnabled: null,
  aiVerticalDampingEnabled: null,
};

let debugEnabled = false;
let loopId: ReturnType<typeof setInterval> | null = null;
let rapierLoaded = false;

let state: GameState | null = null;
let paused = false;
let layout: TransformSoALayout | null = null;
let usingShared = false;
let sharedBuffer: SharedArrayBuffer | null = null;
let liveBuffer: ArrayBuffer | null = null;
let transferBuffers: ArrayBuffer[] = [];
let transferIndex = 0;
let views: ReturnType<typeof createTransformSoAViews> | null = null;

let slots: SlotAllocator | null = null;
const slotByEntityId = new Map<number, number>();
let lastShipIds = new Set<number>();

function post(message: WorkerToMainMessage): void {
  workerScope.postMessage(message);
}

function postWithTransfer(message: WorkerToMainMessage, transfer: Transferable[]): void {
  workerScope.postMessage(message, transfer);
}

function log(...args: unknown[]): void {
  if (!debugEnabled) return;
  try {
    console.log('[sim-worker]', ...args);
  } catch {
    // ignore
  }
}

function installUiStoreShim(): void {
  try {
    (globalThis as unknown as { __spaceAutobattlerUiStore?: unknown }).__spaceAutobattlerUiStore = {
      getState: () => aiOverrides,
    };
  } catch {
    // ignore
  }
}

function startLoop(): void {
  if (loopId !== null) return;

  if (!state || !layout || !views || !slots) {
    throw new Error('Worker loop started before init completed');
  }

  const dt = state.simulation.step;
  const stepMs = Math.max(1, Math.round(dt * 1000));
  loopId = workerScope.setInterval(() => {
    if (!state || !layout || !views || !slots) return;
    if (paused) return;

    updateGame(state, dt);
    writeShipTransforms(state);
    emitSnapshot(state);
  }, stepMs);
}

function stopLoop(): void {
  if (loopId === null) return;
  workerScope.clearInterval(loopId);
  loopId = null;
}

function getOrAllocateSlot(entityId: number): number | null {
  const existing = slotByEntityId.get(entityId);
  if (existing !== undefined) return existing;
  if (!slots) return null;
  const slot = slots.allocate();
  if (slot === null) return null;
  slotByEntityId.set(entityId, slot);
  return slot;
}

function freeSlot(entityId: number): void {
  const slot = slotByEntityId.get(entityId);
  if (slot === undefined) return;
  slotByEntityId.delete(entityId);
  slots?.free(slot);
}

function coerceTeam(value: unknown): Team {
  return value === 'red' ? 'red' : 'blue';
}

function coerceHull(value: unknown): ShipHull {
  switch (value) {
    case 'fighter':
    case 'corvette':
    case 'frigate':
    case 'destroyer':
    case 'carrier':
      return value;
    default:
      return 'fighter';
  }
}

function writeShipTransforms(game: GameState): void {
  if (!views) return;

  const ships = game.queries.ships.entities as GameEntity[];

  for (const entity of ships) {
    const id = entity.id;
    const slot = getOrAllocateSlot(id);
    if (slot === null) continue;

    const transform = entity.transform;
    if (!transform) continue;

    const p = transform.position;
    const r = transform.rotation;

    const pBase = slot * 3;
    views.positions[pBase + 0] = p.x;
    views.positions[pBase + 1] = p.y;
    views.positions[pBase + 2] = p.z;

    const rBase = slot * 4;
    views.rotations[rBase + 0] = r.x;
    views.rotations[rBase + 1] = r.y;
    views.rotations[rBase + 2] = r.z;
    views.rotations[rBase + 3] = r.w;

    views.scales[slot] = transform.scale;

    const ship = entity.ship;
    views.shipHp[slot] = ship?.hp ?? 0;
    views.shipShield[slot] = ship?.shield ?? 0;
    views.shipThrust[slot] = entity.ai?.command?.thrust ?? 0;
  }
}

function computeShipDiffs(game: GameState): { created: CreatedEntity[]; destroyed: number[] } {
  const ships = game.queries.ships.entities as GameEntity[];
  const currentIds = new Set<number>();
  const created: CreatedEntity[] = [];
  const destroyed: number[] = [];

  for (const entity of ships) {
    currentIds.add(entity.id);
    if (lastShipIds.has(entity.id)) continue;

    const slot = getOrAllocateSlot(entity.id);
    if (slot === null) continue;

    const ship = entity.ship;
    created.push({
      id: entity.id,
      kind: 'ship',
      slot,
      team: coerceTeam(ship?.team),
      hull: coerceHull(ship?.hull),
    });
  }

  for (const id of lastShipIds) {
    if (currentIds.has(id)) continue;
    destroyed.push(id);
    freeSlot(id);
  }

  lastShipIds = currentIds;
  return { created, destroyed };
}

function emitSnapshot(game: GameState): void {
  if (!layout) return;
  const ships = game.queries.ships.entities as GameEntity[];
  const { created, destroyed } = computeShipDiffs(game);

  if (usingShared) {
    post({
      type: 'snapshot',
      tick: game.simulation.lastTickIndex,
      time: game.time,
      shipCount: ships.length,
      created,
      destroyed,
    });
    return;
  }

  const buffer = transferBuffers[transferIndex];
  if (!buffer) return;

  // Copy from the live buffer into a staging buffer, then transfer that staging buffer.
  const stagingViews = createTransformSoAViews(layout, buffer);
  if (views) {
    stagingViews.positions.set(views.positions);
    stagingViews.rotations.set(views.rotations);
    stagingViews.scales.set(views.scales);
    stagingViews.shipHp.set(views.shipHp);
    stagingViews.shipShield.set(views.shipShield);
    stagingViews.shipThrust.set(views.shipThrust);
  }

  transferIndex = (transferIndex + 1) % transferBuffers.length;

  postWithTransfer(
    {
      type: 'snapshot',
      tick: game.simulation.lastTickIndex,
      time: game.time,
      shipCount: ships.length,
      created,
      destroyed,
      buffer,
    },
    [buffer],
  );

  // Replace the detached buffer slot with a fresh staging buffer.
  const detachedIndex = (transferIndex + transferBuffers.length - 1) % transferBuffers.length;
  transferBuffers[detachedIndex] = new ArrayBuffer(layout.totalBytes);
}

workerScope.onmessage = (event: MessageEvent) => {
  void (async () => {
    const message = event.data as MainToWorkerMessage;

    try {
      switch (message.type) {
        case 'init': {
          debugEnabled = Boolean(message.debug);
          aiOverrides = message.aiOverrides;
          installUiStoreShim();

          const initLayout = message.transforms.layout;
          layout = initLayout;
          usingShared = Boolean(message.transforms.buffer);
          sharedBuffer = message.transforms.buffer ?? null;

          slots = new SlotAllocator(initLayout.capacity);

          state = await createGameState();
          rapierLoaded = true;
          state.rng = new SeededRng(message.seed);
          spawnInitialFleets(state);

          paused = Boolean(message.startPaused);

          if (sharedBuffer) {
            views = createTransformSoAViews(initLayout, sharedBuffer);
          } else {
            liveBuffer = new ArrayBuffer(initLayout.totalBytes);
            views = createTransformSoAViews(initLayout, liveBuffer);
            transferBuffers = [
              new ArrayBuffer(initLayout.totalBytes),
              new ArrayBuffer(initLayout.totalBytes),
            ];
            transferIndex = 0;
          }

          // Initialize the ship ID set before the first snapshot.
          lastShipIds = new Set<number>();

          startLoop();
          post({
            type: 'ready',
            sabSupported: typeof SharedArrayBuffer !== 'undefined',
            rapierLoaded,
            usingShared,
            layout,
          });
          log('ready');
          return;
        }

        case 'setAiOverrides': {
          aiOverrides = message.aiOverrides;
          installUiStoreShim();
          return;
        }

        case 'setPaused': {
          paused = message.paused;
          return;
        }

        case 'ping': {
          post({ type: 'pong', nonce: message.nonce, now: Date.now() });
          return;
        }

        case 'shutdown': {
          stopLoop();
          workerScope.close();
          return;
        }

        default: {
          const exhaustive: never = message;
          throw new Error(`Unhandled message: ${String(exhaustive)}`);
        }
      }
    } catch (error) {
      const err = error as Error;
      post({
        type: 'error',
        message: err.message || String(error),
        stack: err.stack,
      });
    }
  })();
};
