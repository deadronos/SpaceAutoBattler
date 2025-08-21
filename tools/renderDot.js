#!/usr/bin/env node
// Simple DOT -> SVG renderer using viz.js (no native Graphviz required)
// Usage:
// 1) npm install viz.js
// 2) node tools/renderDot.js docs/flowchart.dot docs/flowchart.svg

const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node tools/renderDot.js input.dot output.svg');
    process.exit(2);
  }
  const [inPath, outPath] = args;
  if (!fs.existsSync(inPath)) {
    console.error('Input file not found:', inPath);
    process.exit(2);
  }

  let Viz, renderModule;
  try {
    // viz.js exposes an ESM API; try to require the CommonJS build
    Viz = require('viz.js');
    renderModule = require('viz.js/full.render.js');
  } catch (err) {
    console.error('\nError: viz.js not installed.');
    console.error('Install with: npm install --save-dev viz.js');
    console.error('Then rerun: node tools/renderDot.js', inPath, outPath);
    process.exit(3);
  }

  const { Module, render } = renderModule;
  const viz = new Viz({ Module, render });

  const dot = fs.readFileSync(inPath, 'utf8');

  try {
    const svg = await viz.renderString(dot);
    fs.writeFileSync(outPath, svg, 'utf8');
    console.log('Wrote', outPath);
  } catch (err) {
    console.error('Render failed:', err.message || err);
    process.exit(4);
  }
}

main();
