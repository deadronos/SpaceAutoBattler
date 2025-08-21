#!/usr/bin/env node
// Render an SVG file to PNG using Puppeteer (headless Chromium)
// Usage:
// 1) npm install --save-dev puppeteer
// 2) node tools/svgToPng.cjs docs/flowchart.svg docs/flowchart.png

const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node tools/svgToPng.cjs input.svg output.png');
    process.exit(2);
  }
  const [inPath, outPath] = args;
  if (!fs.existsSync(inPath)) {
    console.error('Input file not found:', inPath);
    process.exit(2);
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    console.error('\nError: puppeteer not installed.');
    console.error('Install with: npm install --save-dev puppeteer');
    process.exit(3);
  }

  const svg = fs.readFileSync(inPath, 'utf8');
  const html = `<!doctype html><html><body style="margin:0;padding:0;">${svg}</body></html>`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const svgHandle = await page.$('svg');
    if (!svgHandle) {
      throw new Error('SVG element not found in rendered content');
    }
    const clip = await svgHandle.boundingBox();
    if (!clip) {
      throw new Error('Unable to determine SVG bounding box');
    }
    await page.setViewport({ width: Math.ceil(clip.width), height: Math.ceil(clip.height) });
    await svgHandle.screenshot({ path: outPath });
    console.log('Wrote', outPath);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(4); });
