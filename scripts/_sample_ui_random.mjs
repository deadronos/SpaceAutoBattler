import { srand, srange, srangeInt } from '../src/rng.js';
const seed = 12345;
srand(seed);
const types = ['corvette','frigate','destroyer','carrier','fighter'];
const seq = [];
for (let i=0;i<8;i++){
  const t = types[srangeInt(0, types.length-1)];
  // emulate the two position srange calls used by the UI when creating the ship
  srange(40, 300);
  srange(80, 500);
  seq.push(t);
}
console.log(JSON.stringify(seq));
