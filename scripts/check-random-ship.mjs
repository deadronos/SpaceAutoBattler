import { srand, unseed } from '../src/rng.js';
import { randomShipType } from '../src/renderer.js';

console.log('--- With srand(12345) ---');
srand(12345);
for (let i=0;i<10;i++){
  console.log(i, randomShipType());
}

console.log('\n--- With same seed again srand(12345) ---');
srand(12345);
for (let i=0;i<10;i++){
  console.log(i, randomShipType());
}

console.log('\n--- Unseeded (Math.random) ---');
unseed();
for (let i=0;i<10;i++){
  console.log(i, randomShipType());
}
