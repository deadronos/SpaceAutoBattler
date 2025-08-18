import { srand, srangeInt } from '../src/rng.js';
const seed = 12345;
srand(seed);
const types = ['corvette','frigate','destroyer','carrier','fighter'];
const seq = [];
for (let i=0;i<8;i++) seq.push(types[srangeInt(0, types.length-1)]);
console.log(JSON.stringify(seq));
