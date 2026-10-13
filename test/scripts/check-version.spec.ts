import { describe, expect, it } from 'vite-plus/test';
import { checkVersion } from '../../scripts/check-version.mjs';

describe('checkVersion', () => {
  it('passes when package.json version matches the release tag', () => {
    const result = checkVersion({ pkgVersion: '2.2.0', refType: 'tag', refName: 'v2.2.0' });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.message).toContain('matches tag v2.2.0');
  });

  it('fails when package.json version does not match a release tag', () => {
    const result = checkVersion({ pkgVersion: '2.1.15', refType: 'tag', refName: 'v2.2.0' });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.message).toContain('does not match tag v2.2.0');
    expect(result.message).toContain('bump "version" before tagging');
  });

  it('skips on a branch ref (workflow_dispatch / PR)', () => {
    const result = checkVersion({ pkgVersion: '2.1.15', refType: 'branch', refName: 'main' });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain('ref_type=branch');
  });

  it('skips non-v* tags that are not release tags', () => {
    const result = checkVersion({
      pkgVersion: '2.2.0',
      refType: 'tag',
      refName: 'release-2.2.0',
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });
});
