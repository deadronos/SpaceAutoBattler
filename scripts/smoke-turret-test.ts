import { makeInitialState } from '../src/entities';
import { simulateStep } from '../src/simulate';

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function approxEqual(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

async function run() {
  // Test 1: turret advances toward targetAngle
  const state1 = makeInitialState();
  const attacker: any = { id: 1, x: 50, y: 50, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'red', turrets: [{ position: [1,0], angle: 0, targetAngle: Math.PI / 2, turnRate: Math.PI }] };
  const defender: any = { id: 2, x: 60, y: 60, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
  state1.ships = [attacker, defender];
  simulateStep(state1, 0.5, { W: 200, H: 200 });
  const t = (state1.ships[0] as any).turrets[0];
  assert(typeof t.angle === 'number', 'turret.angle must be numeric');
  if (!(t.angle > 0 && t.angle <= Math.PI / 2 + 1e-6)) throw new Error('turret.angle did not advance as expected: ' + String(t.angle));

  // Test 2: AI sets targetAngle toward nearest enemy
  const state2 = makeInitialState();
  const attacker2: any = { id: 1, x: 10, y: 10, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'red', turrets: [{ position: [1,0], angle: 0 }] };
  const enemy: any = { id: 2, x: 20, y: 10, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
  state2.ships = [attacker2, enemy];
  simulateStep(state2, 0.016, { W: 200, H: 200 });
  const t2 = (state2.ships[0] as any).turrets[0];
  assert(typeof t2.targetAngle === 'number', 'turret.targetAngle must be set by AI');
  if (!(Math.abs(t2.targetAngle) < 0.1)) throw new Error('turret.targetAngle not aiming at enemy: ' + String(t2.targetAngle));

  console.log('SMOKE-TURRET-TEST: PASS');
}

run().catch((e) => {
  console.error('SMOKE-TURRET-TEST: FAIL', e && e.stack ? e.stack : e);
  process.exit(2);
});
