import { execSync } from 'node:child_process';

// Step 1: Build config files to dist/config (if not present)
try {
  execSync('tsc --outDir dist/config src/config/*.ts', { stdio: 'inherit' });
} catch (e) {
  console.error('TypeScript build failed:', e);
  process.exit(1);
}

// Step 2: Import built JS files from dist/config
const main = async () => {
  const v = await import('../dist/config/validateConfig.js');
  const a = await import('../dist/config/assets/assetsConfig.js');
  const t = await import('../dist/config/teamsConfig.js');
  const p = await import('../dist/config/progressionConfig.js');
  const r = await import('../dist/config/rendererConfig.js');
  const errs = [
    ...(v.validateAssetsConfig ? v.validateAssetsConfig(a.AssetsConfig) : []),
    ...(v.validateTeamsConfig ? v.validateTeamsConfig(t.TeamsConfig) : []),
    ...(v.validateProgressionConfig ? v.validateProgressionConfig(p.progression) : []),
    ...(v.validateRendererConfig ? v.validateRendererConfig(r.RendererConfig) : []),
  ];
  if (errs.length) {
    console.error('Config validation failed:\n', errs.join('\n'));
    process.exit(2);
  }
  console.log('Config validation passed');
};
main();