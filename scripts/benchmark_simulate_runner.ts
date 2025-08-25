import simulateMod from '../src/simulate.ts';
import { makeInitialState } from '../src/entities.ts';
import { SIM } from '../src/config/simConfig';

// Allow overriding gridCellSize via environment variable for benchmarking
if (process.env.SIM_GRID_CELL_SIZE) {
  const v = Number(process.env.SIM_GRID_CELL_SIZE);
  if (!Number.isNaN(v) && v > 0) {
    (SIM as any).gridCellSize = v;
    console.log('Overriding SIM.gridCellSize ->', v);
  }
}

// simulateMod may export default { simulateStep } or named; support both.
const simulateStep = (simulateMod as any).simulateStep || (simulateMod as any).default?.simulateStep || (simulateMod as any).default;

function makeState(shipsCount: number, bulletsCount: number, areaW = 2000, areaH = 2000) {
  const state: any = makeInitialState();
  state.ships = [];
  state.bullets = [];
  for (let i = 0; i < shipsCount; i++) {
    state.ships.push({ id: i, x: Math.random() * areaW, y: Math.random() * areaH, team: i % 2 === 0 ? 'red' : 'blue', hp: 10, maxHp: 10, radius: 8, shield: 0 });
  }
  for (let i = 0; i < bulletsCount; i++) {
    state.bullets.push({ id: i, x: Math.random() * areaW, y: Math.random() * areaH, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, team: i % 2 === 0 ? 'red' : 'blue', damage: 2, ttl: 1, radius: 1 });
  }
  state.t = 0;
  return state;
}

function benchScenario(ships: number, bullets: number, runs = 20) {
  const bounds = { W: 2000, H: 2000 };
  const dt = 1 / 60;
  const stateTemplate = makeState(ships, bullets, bounds.W, bounds.H);
  // debug
  console.log('assetPool.effects instanceof Map?', stateTemplate.assetPool?.effects instanceof Map);
  // run a few warm-ups
  for (let w = 0; w < 3; w++) {
    const s = makeState(ships, bullets, bounds.W, bounds.H);
    simulateStep(s, dt, bounds);
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) {
    const s = makeState(ships, bullets, bounds.W, bounds.H);
    simulateStep(s, dt, bounds);
  }
  const end = process.hrtime.bigint();
  const avgMs = Number((end - start) / BigInt(runs)) / 1e6;
  console.log(`simulateStep avg time for ships=${ships} bullets=${bullets}: ${avgMs.toFixed(3)} ms`);
}

async function main() {
  console.log('Running simulateStep benchmark (single-step)');
  benchScenario(50, 200, 50);
  benchScenario(200, 800, 30);
  benchScenario(500, 2000, 10);
}

main().catch((e) => { console.error(e); process.exit(1); });
