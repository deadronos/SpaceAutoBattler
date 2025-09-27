import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT, 'src/assets/textures/star');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function fract(value) {
  return value - Math.floor(value);
}

function hash(x, y, seed) {
  const dot = x * 374761393 + y * 668265263 + seed * 69069;
  const s = Math.sin(dot);
  return fract(s * 43758.5453123);
}

function pseudoRandom(x, y, seed) {
  return hash(x, y, seed);
}

function fbm(x, y, seed, octaves = 5, lacunarity = 2.0, gain = 0.5) {
  let amplitude = 1.0;
  let frequency = 1.0;
  let sum = 0.0;
  let amplitudeSum = 0.0;

  for (let i = 0; i < octaves; i += 1) {
    const noiseValue = pseudoRandom(Math.floor(x * frequency), Math.floor(y * frequency), seed + i * 101);
    const centered = noiseValue * 2.0 - 1.0;
    sum += centered * amplitude;
    amplitudeSum += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return sum / amplitudeSum;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sampleGradient(t, stops) {
  const value = clamp(t, 0, 1);
  for (let i = 0; i < stops.length - 1; i += 1) {
    const current = stops[i];
    const next = stops[i + 1];
    if (value >= current.pos && value <= next.pos) {
      const range = next.pos - current.pos;
      const localT = range === 0 ? 0 : (value - current.pos) / range;
      return [
        Math.round(lerp(current.color[0], next.color[0], localT)),
        Math.round(lerp(current.color[1], next.color[1], localT)),
        Math.round(lerp(current.color[2], next.color[2], localT)),
      ];
    }
  }
  const last = stops[stops.length - 1];
  return last.color.slice();
}

function generateOrganicTexture({ width, height, seed = 1337 }) {
  const png = new PNG({ width, height });
  const gradient = [
    { pos: 0.0, color: [28, 12, 6] },
    { pos: 0.35, color: [112, 54, 24] },
    { pos: 0.65, color: [180, 104, 44] },
    { pos: 0.85, color: [230, 150, 70] },
    { pos: 1.0, color: [250, 210, 140] },
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const ny = y / height;

      const base = fbm(nx * 4.0, ny * 4.0, seed, 5, 2.2, 0.55);
      const detail = fbm(nx * 16.0, ny * 16.0, seed + 999, 4, 2.1, 0.5);
      const swirl = fbm(nx * 2.0 + ny * 2.0, ny * 2.0 - nx * 2.0, seed + 333, 3, 2.0, 0.6);

      const combined = clamp(0.5 + base * 0.35 + detail * 0.25 + swirl * 0.15, -1, 1);
      const normalized = (combined + 1) / 2;
      const contrast = Math.pow(normalized, 0.9);
      const color = sampleGradient(contrast, gradient);

      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = 255;
    }
  }

  return png;
}

function generateNoiseTexture({ width, height, seed = 4242 }) {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) << 2;
      png.data[idx] = Math.floor(pseudoRandom(x, y, seed) * 255);
      png.data[idx + 1] = Math.floor(pseudoRandom(x, y, seed + 101) * 255);
      png.data[idx + 2] = Math.floor(pseudoRandom(x, y, seed + 202) * 255);
      png.data[idx + 3] = Math.floor(pseudoRandom(x, y, seed + 303) * 255);
    }
  }

  return png;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function writePng(png, filename) {
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path.join(OUTPUT_DIR, filename));
    stream.on('finish', resolve);
    stream.on('error', reject);
    png.pack().pipe(stream);
  });
}

async function main() {
  ensureOutputDir();

  console.log('[textures] Generating Organic texture...');
  const organic = generateOrganicTexture({ width: 1024, height: 1024 });
  await writePng(organic, 'star-organic.png');

  console.log('[textures] Generating RGBA noise texture...');
  const noise = generateNoiseTexture({ width: 64, height: 64 });
  await writePng(noise, 'star-noise-rgba.png');

  console.log('[textures] Done.');
}

main().catch((error) => {
  console.error('[textures] Generation failed:', error);
  process.exitCode = 1;
});
