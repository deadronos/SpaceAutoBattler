import { test, expect } from '@playwright/test';

test.describe('Worker simulation E2E', () => {
  test('worker snapshots advance over time', async ({ page }) => {
    test.setTimeout(60_000);

    // WebKit headless in CI can heavily throttle timers, making this flaky.
    if ((test as any).info().project.name === 'webkit') {
      test.skip(true, 'WebKit headless can throttle timers');
    }

    await page.goto('/spaceautobattler.html?e2e=1&sim_worker=1');

    await expect(page.locator('canvas')).toHaveCount(1);

    await page.waitForFunction(
      () => {
        const api = (window as any).__SAB;
        return Boolean(api?.getWorkerStatus && api?.sampleWorkerShipMotion);
      },
      undefined,
      { timeout: 30_000 },
    );

    await page.waitForFunction(
      () => {
        const api = (window as any).__SAB;
        const status = api?.getWorkerStatus?.();
        if (status?.error) return true;
        const snap = api?.sampleWorkerShipMotion?.(1);
        return Boolean(
          snap && snap.ships && snap.ships.length >= 1 && typeof snap.tick === 'number',
        );
      },
      undefined,
      { timeout: 45_000 },
    );

    const status = await page.evaluate(() => {
      const api = (window as any).__SAB;
      return api.getWorkerStatus();
    });

    expect(status.error).toBeNull();

    const initial = await page.evaluate(() => {
      const api = (window as any).__SAB;
      const snap = api.sampleWorkerShipMotion(1);
      const ship = snap.ships[0];
      return {
        tick: snap.tick,
        shipId: ship.id,
        position: ship.position,
      };
    });

    await page.waitForFunction(
      ({ tick, shipId }: { tick: number; shipId: number }) => {
        const api = (window as any).__SAB;
        const snap = api?.sampleWorkerShipMotion?.(8);
        if (!snap || typeof snap.tick !== 'number') return false;
        if (snap.tick <= tick + 2) return false;
        const ship = snap.ships.find((s: any) => s.id === shipId) ?? snap.ships[0];
        if (!ship) return false;
        const p = ship.position;
        return [p.x, p.y, p.z].every((v: any) => typeof v === 'number' && Number.isFinite(v));
      },
      initial,
      { timeout: 30000 },
    );

    const later = await page.evaluate(({ shipId }: { shipId: number }) => {
      const api = (window as any).__SAB;
      const snap = api.sampleWorkerShipMotion(8);
      const ship = snap.ships.find((s: any) => s.id === shipId) ?? snap.ships[0];
      return {
        tick: snap.tick,
        position: ship?.position ?? { x: 0, y: 0, z: 0 },
      };
    }, initial);

    const distance = (a: any, b: any) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    expect(later.tick).toBeGreaterThan(initial.tick);
    expect(distance(later.position, initial.position)).toBeGreaterThan(0.001);
  });
});
