import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
  readBooleanParam,
  readNumberParam,
  readQueryParam,
  readStringParam,
} from '../../src/utils/queryParams.js';

function setSearch(search: string): void {
  window.history.pushState({}, '', `/${search}`);
}

afterEach(() => setSearch(''));

describe('query param helpers', () => {
  it('reads raw and typed parameters with defaults', () => {
    setSearch('?a=hello&b=1&c=42&d=off&e=true');

    expect(readQueryParam('a')).toBe('hello');
    expect(readQueryParam('missing')).toBeNull();

    expect(readStringParam('a', 'x')).toBe('hello');
    expect(readStringParam('missing', 'x')).toBe('x');

    expect(readBooleanParam('b')).toBe(true);
    expect(readBooleanParam('e')).toBe(true);
    expect(readBooleanParam('d')).toBe(false);
    expect(readBooleanParam('missing', true)).toBe(true);

    expect(readNumberParam('c', 0)).toBe(42);
    expect(readNumberParam('missing', 7)).toBe(7);
    expect(readNumberParam('a', 9)).toBe(9);
  });
});
