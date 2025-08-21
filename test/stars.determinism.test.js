import { test, expect } from 'vitest';
import { srand, srandom } from '../src/rng.js';
import { initStars, reset, stars } from '../src/gamemanager.js';
import { simulateStep } from '../src/simulate.js';

// Helper to snapshot a few sample star properties for quick equality checks
function sampleStars(arr, indices = [0, 1, 2, 10, 50]) {
  return indices.map(i => {
    const s = arr[i % arr.length];
    return { x: Math.round(s.x * 1000) / 1000, y: Math.round(s.y * 1000) / 1000, r: Math.round(s.r * 1000) / 1000, a: Math.round(s.a * 1000) / 1000 };
  });
}

test('initStars is deterministic when seeded via srand + initStars', () => {
  srand(12345);
  initStars({ stars }, 800, 600, 140);
  const first = sampleStars(stars);

  // regenerate with same seed
  srand(12345);
  initStars({ stars }, 800, 600, 140);
  const second = sampleStars(stars);

  expect(first).toEqual(second);
});

test('reset(seed) seeds and produces same starfield', () => {
  reset(54321);
  const first = sampleStars(stars);

  reset(54321);
  const second = sampleStars(stars);

  expect(first).toEqual(second);
});

test('different seeds produce different starfields (likely)', () => {
  reset(1000);
  const a = sampleStars(stars);
  reset(1001);
  const b = sampleStars(stars);

  // It's possible by extreme chance some samples match; assert not all equal
  const allEqual = a.every((v, i) => JSON.stringify(v) === JSON.stringify(b[i]));
  expect(allEqual).toBe(false);
});

test('star twinkle progression is deterministic under seeded RNG', () => {
  // Seed RNG
  srand(12345);

  // Initialize stars
  const state = { stars: [], ships: [], bullets: [] }; // Add empty bullets array
  initStars(state, 800, 600, 10); // 10 stars in 800x600 space

  // Step simulation multiple times
  const twinkleValues = [];
  for (let i = 0; i < 5; i++) {
    simulateStep(state, 0.016, { W: 800, H: 600 });
    twinkleValues.push(state.stars.map(star => star.a));
  }

  // Update expected values based on debug logs
  const expectedValues = [
  [0.45244362242519853, 0.933078479184769, 0.7680262033361942, 0.22856935414019974, 0.7166613915003837, 0.41514835159759966, 0.4224041701760143, 0.8138234057696536, 0.8169499082490802, 0.25848947574850173],
  [0.20708145038224757, 0.46365868619177497, 0.8870945396833122, 0.7511275407625362, 0.5822489361744374, 0.32294693097937854, 0.4527496255934239, 0.8830020693829284, 0.8320007943082601, 0.434607132175006],
  [0.8491447773762048, 0.7230233027366921, 0.5754489680286498, 0.9059690636815503, 0.6681857081130147, 0.9282579913502559, 0.44551346027292316, 0.8049219629028812, 0.8427620938979089, 0.18680659241508693],
  [0.6557008981239051, 0.6499108686344698, 0.2010749664157629, 0.6209343733033166, 0.900183878513053, 0.1828431152040139, 0.34879613677039745, 0.8020189213333652, 0.7574935951735824, 0.4389674828620628],
  [0.26187215056270363, 0.3538765597855672, 0.8931382468435913, 0.4527885044226423, 0.7977852742187679, 0.7460301701677963, 0.1814597267191857, 0.7640784281538799, 0.8580840125679969, 0.60348092073109]
  ];

  expect(twinkleValues).toEqual(expectedValues);
});
