import { expect, test } from '@playwright/test';

interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

function distance(a: Vector3Like, b: Vector3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function quaternionAngle(a: QuaternionLike, b: QuaternionLike): number {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  const clamped = Math.min(1, Math.max(-1, dot));
  return 2 * Math.acos(clamped);
}

const SIM_STEP = 1 / 20;

test.describe('Ship motion heuristics', () => {
  test('ships move smoothly without teleporting between ticks', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    if ((test as any).info().project.name === 'webkit') {
      test.skip(true, 'WebKit headless aggressively throttles timers in CI');
    }

    await page.goto('/spaceautobattler.html?e2e=1');

    await expect(page.getByRole('button', { name: /start/i })).toBeVisible();

    await page.waitForFunction(() => {
      const api = (window as any).__SAB;
      return Boolean(api?.getCounts && api?.tick);
    });

    await page.waitForFunction(() => {
      const api = (window as any).__SAB;
      if (!api?.getCounts) return false;
      const counts = api.getCounts();
      return counts && counts.ships >= 6;
    });

    const snapshots = await page.evaluate((step) => {
      const api = (window as any).__SAB;
      if (!api?.sampleShipMotion) throw new Error('sampleShipMotion helper missing');

      api.tick?.(15, step);
      const initial = api.sampleShipMotion();
      const firstBlue = initial.ships.find((ship: any) => ship.team === 'blue');
      if (!firstBlue) throw new Error('Unable to locate a blue ship');
      const targetId = firstBlue.id;
      const frames: Array<{ position: Vector3Like; rotation: QuaternionLike }> = [
        { position: firstBlue.position, rotation: firstBlue.rotation }
      ];

      for (let i = 0; i < 32; i += 1) {
        api.tick?.(1, step);
        const snapshot = api.sampleShipMotion();
        const entry = snapshot.ships.find((ship: any) => ship.id === targetId);
        if (!entry) throw new Error('Tracked ship disappeared during sampling');
        frames.push({ position: entry.position, rotation: entry.rotation });
      }

      return frames;
    }, SIM_STEP);

    await page.evaluate(() => {
      const api = (window as any).__SAB;
      api?.stopAutoTick?.();
    });

    expect(errors.join('\n')).toEqual('');

    const displacements = snapshots
      .slice(1)
      .map((frame, index) => distance(frame.position, snapshots[index].position));

    expect(displacements.length).toBeGreaterThan(0);
    expect(displacements.some((d) => d > 0.05)).toBeTruthy();
    expect(Math.max(...displacements)).toBeLessThan(12);

    const rotationSteps = snapshots
      .slice(1)
      .map((frame, index) => quaternionAngle(frame.rotation, snapshots[index].rotation));

    expect(rotationSteps.some((angle) => angle > 0.001)).toBeTruthy();
    expect(Math.max(...rotationSteps)).toBeLessThan(1.2);
  });
});
