import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { try { console.log('[page]', msg.type(), msg.text()); } catch (e) {} });
  const url = 'http://127.0.0.1:8080/dist/spaceautobattler_standalone.html';
  console.log('navigating to', url);
  await page.goto(url, { waitUntil: 'load', timeout: 15000 }).catch(e => { console.error('goto failed', e); process.exit(2); });
  // wait for UI
  await page.waitForTimeout(500);
  // Click Start if present
  try { await page.click('#startPause'); } catch (e) {}
  // Ensure ship type select has 'carrier'
  try { await page.selectOption('#shipTypeSelect', 'carrier'); } catch (e) {}
  // Spawn red and blue carriers
  try { await page.click('#addRed'); } catch (e) { console.log('addRed click failed', String(e)); }
  try { await page.click('#addBlue'); } catch (e) { console.log('addBlue click failed', String(e)); }
  // let things settle
  await page.waitForTimeout(500);
  const outDir = '.playwright-mcp';
  try { if (!fs.existsSync(outDir)) fs.mkdirSync(outDir); } catch (e) {}
  const outPath = `${outDir}/capture_carriers.png`;
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('screenshot saved to', outPath);
  await browser.close();
}
run().catch(e => { console.error('capture failed', e); process.exit(1); });
