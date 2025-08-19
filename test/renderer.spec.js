import { test, expect } from 'vitest';
import * as renderer from '../src/renderer.js';

test('renderer module exports render function', () => {
	expect(typeof renderer.render).toBe('function');
});

