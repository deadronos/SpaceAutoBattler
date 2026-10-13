#!/usr/bin/env node
/**
 * Version-sync guard.
 *
 * Ensures `package.json` "version" matches the release tag (vX.Y.Z) that triggered a
 * deploy. Non-tag refs (branches, workflow_dispatch) are a no-op so the guard never
 * blocks ordinary CI.
 *
 * Usage:
 *   node scripts/check-version.mjs [refName]
 *
 * `refName` defaults to `GITHUB_REF_NAME`; the ref type defaults to `GITHUB_REF_TYPE`
 * (or `tag` when an explicit argument is supplied, otherwise `branch`).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pure comparator shared by the CLI and unit tests.
 *
 * @param {{ pkgVersion: string, refType: string, refName: string }} ref
 * @returns {{ ok: boolean, skipped: boolean, message: string }}
 */
export function checkVersion({ pkgVersion, refType, refName }) {
  if (refType !== 'tag') {
    return {
      ok: true,
      skipped: true,
      message: `version check skipped (ref_type=${refType})`,
    };
  }

  if (!refName || !refName.startsWith('v')) {
    return {
      ok: true,
      skipped: true,
      message: `version check skipped (ref "${refName}" is not a v* release tag)`,
    };
  }

  const expectedTag = `v${pkgVersion}`;
  if (refName !== expectedTag) {
    return {
      ok: false,
      skipped: false,
      message: `package.json version ${pkgVersion} does not match tag ${refName}; bump "version" before tagging`,
    };
  }

  return {
    ok: true,
    skipped: false,
    message: `package.json version ${pkgVersion} matches tag ${refName}`,
  };
}

function readPackageVersion() {
  const pkgPath = resolve(__dirname, '..', 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
}

function resolveRef() {
  const argRef = process.argv[2];
  if (argRef) {
    return { refName: argRef, refType: process.env.GITHUB_REF_TYPE || 'tag' };
  }

  return {
    refName: process.env.GITHUB_REF_NAME || '',
    refType: process.env.GITHUB_REF_TYPE || 'branch',
  };
}

function main() {
  const { refName, refType } = resolveRef();
  const result = checkVersion({
    pkgVersion: readPackageVersion(),
    refType,
    refName,
  });

  if (result.ok) {
    console.log(result.message);
    return;
  }

  console.error(`version:check failed: ${result.message}`);
  process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main();
}
