import { srand, srange, srangeInt, unseed } from '../src/rng.js';
import { randomShipType, createShipFromUI, testHelpers } from '../src/renderer.js';
import { Team } from '../src/entities.js';

// Run a small reproduction: seed RNG and call randomShipType N times, then reset and
// call createShipFromUI sequentially and inspect ship types to see if constructor
// RNG consumption affects visible randomness.

function runOnce(seed, iterations=10) {
  console.log('\n--- seed', seed, '---');
  srand(seed);
  const typesDirect = [];
  for (let i=0;i<iterations;i++) typesDirect.push(randomShipType());
  console.log('randomShipType sequence:', typesDirect.join(', '));

  // Now reset and call createShipFromUI (which also constructs Ship objects that
  // may consume RNG in the constructor). We'll clear testHelpers.ships first.
  srand(seed);
  testHelpers.ships.length = 0;
  const typesFromUI = [];
  for (let i=0;i<iterations;i++) {
    createShipFromUI(Team.RED);
    const s = testHelpers.ships[testHelpers.ships.length - 1];
    typesFromUI.push(s ? s.type : '(none)');
  }
  console.log('createShipFromUI sequence:', typesFromUI.join(', '));
}

runOnce(12345, 10);
runOnce(1, 10);
runOnce(42, 10);

// Alternating RED/BLUE additions to see interleaved RNG consumption
function runAlternate(seed, pairs=10) {
  console.log('\n--- alternate seed', seed, '---');
  srand(seed);
  testHelpers.ships.length = 0;
  const seq = [];
  for (let i=0;i<pairs;i++) {
    createShipFromUI(Team.RED);
    const r = testHelpers.ships[testHelpers.ships.length - 1];
    createShipFromUI(Team.BLUE);
    const b = testHelpers.ships[testHelpers.ships.length - 1];
    seq.push([r ? r.type : '(none)', b ? b.type : '(none)']);
  }
  console.log('RED vs BLUE interleaved types:');
  for (const [r,b] of seq) console.log(`RED=${r}  |  BLUE=${b}`);
}

runAlternate(12345, 8);
runAlternate(1, 8);
