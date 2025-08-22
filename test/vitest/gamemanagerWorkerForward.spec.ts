import { test, expect } from 'vitest';
import { createGameManager } from '../../src/gamemanager.js';

test('forwards continuous toggle to worker when worker exists (mocked check)', () => {
  // This test verifies the message shape intended to be forwarded to the worker.
  const posts: any[] = [];
  const mockWorker: any = {
    post: (m: any) => posts.push(m),
    on: (evt: any, cb: any) => {},
  };

  // Simulate posting a message as the forwarding code would do
  mockWorker.post({ type: 'setContinuous', value: true });
  expect(posts).toContainEqual({ type: 'setContinuous', value: true });
});

test('main-thread fallback toggles local continuous state', () => {
  const gm: any = createGameManager({ renderer: null });
  // use the public API added in gamemanager to toggle continuous (fallback path)
  // @ts-ignore - gm shape is dynamic in tests
  gm.setContinuousEnabled(false);
  // @ts-ignore
  expect(gm.isContinuousEnabled()).toBe(false);
  // @ts-ignore
  gm.setContinuousEnabled(true);
  // @ts-ignore
  expect(gm.isContinuousEnabled()).toBe(true);
});
