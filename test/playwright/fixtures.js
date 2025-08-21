import base, { expect } from '@playwright/test';
import { spawn } from 'child_process';
import net from 'net';

// Helper: find a free port by binding to 0
function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const port = s.address().port;
      s.close((err) => {
        if (err) return reject(err);
        resolve(port);
      });
    });
    s.on('error', reject);
  });
}

// Helper: wait until TCP port is accepting connections
function waitForPort(port, host = '127.0.0.1', timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function tryConnect() {
      const sock = new net.Socket();
      sock.setTimeout(1000);
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeout) return reject(new Error('timeout waiting for port ' + port));
        setTimeout(tryConnect, 100);
      });
      sock.once('timeout', () => {
        sock.destroy();
        if (Date.now() - start > timeout) return reject(new Error('timeout waiting for port ' + port));
        setTimeout(tryConnect, 100);
      });
      sock.connect(port, host, () => {
        sock.end();
        resolve();
      });
    })();
  });
}

// This test fixture supports starting a local http-server to serve the
// standalone HTML. Tests opt-in to running by setting RUN_STANDALONE=1.
const runStandalone = process.env.RUN_STANDALONE === '1';

const test = base.extend({
  standaloneBase: async ({}, use) => {
    if (!runStandalone) {
      await use(null);
      return;
    }
    if (process.env.STANDALONE_BASE_URL) {
      await use(process.env.STANDALONE_BASE_URL);
      return;
    }

    const port = await getFreePort();
    const args = ['http-server', '.', '-p', String(port), '-c-1'];
    const proc = spawn('npx', args, { stdio: 'ignore', shell: true, cwd: process.cwd() });

    try {
      await waitForPort(port, '127.0.0.1', 5000);
      await use(`http://localhost:${port}`);
    } finally {
      try { proc.kill(); } catch (e) { /* ignore */ }
    }
  }
});

// keep default skip behavior for convenience (tests won't run unless opt-in)
test.skip(!runStandalone, 'Standalone tests are skipped by default; set RUN_STANDALONE=1 to run them.');

export { test, expect };
