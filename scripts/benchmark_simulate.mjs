#!/usr/bin/env node
// Launcher that bundles the TypeScript benchmark runner with esbuild and runs it with node
import { buildSync } from 'esbuild';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
const outDir = '.tmp';
if (!existsSync(outDir)) mkdirSync(outDir);
const outFile = `${outDir}/benchmark_simulate_runner.js`;
console.log('Bundling benchmark runner with esbuild...');
buildSync({
	entryPoints: ['./scripts/benchmark_simulate_runner.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: outFile,
	sourcemap: false,
	external: [],
});
console.log('Running bundled benchmark...');
const res = spawnSync('node', [outFile], { stdio: 'inherit' });
process.exit(res.status ?? 0);
