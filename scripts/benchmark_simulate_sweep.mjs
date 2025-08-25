// Simple sweep runner for simulate benchmark across cell sizes
import { spawnSync } from 'child_process';
import path from 'path';
const sizes = [16, 32, 64, 128];
const runsPerSize = 1;
for (const s of sizes) {
  console.log(`\n== Running benchmark with gridCellSize=${s} ==`);
  for (let i = 0; i < runsPerSize; i++) {
    // Run the existing launcher which bundles and executes the TS runner.
    const launcher = path.resolve(process.cwd(), 'scripts', 'benchmark_simulate.mjs');
    const res = spawnSync(process.execPath, [launcher], {
      stdio: 'inherit',
      env: { ...process.env, SIM_GRID_CELL_SIZE: String(s) },
    });
    if (res.error) {
      console.error('Failed to run benchmark:', res.error);
      process.exit(1);
    }
  }
}
