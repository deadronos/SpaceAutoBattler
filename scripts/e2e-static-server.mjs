#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const projectRoot = process.cwd();
const distRoot = path.resolve(projectRoot, 'dist');
const repoRoot = projectRoot;

const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : 8080;

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function safeDecodeUriComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePathname(pathname) {
  const decoded = safeDecodeUriComponent(pathname);
  // Prevent path traversal.
  const withoutNulls = decoded.replace(/\0/g, '');
  const normalized = path.posix.normalize(withoutNulls);
  if (normalized.startsWith('..')) return '/';
  return normalized;
}

function resolveFile(baseDir, pathname) {
  const rel = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const abs = path.resolve(baseDir, rel);
  if (!abs.startsWith(baseDir)) return null;
  return abs;
}

function fileExists(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function maybeDirectoryIndex(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }

  const indexHtml = path.join(filePath, 'index.html');
  if (fileExists(indexHtml)) return indexHtml;
  return null;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeByExt[ext] || 'application/octet-stream';

  // Match prior e2e behavior: no caching.
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    res.statusCode = 500;
    res.end(String(err));
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '/');
  const pathname = normalizePathname(parsed.pathname || '/');

  // Prefer built output from dist/.
  const distCandidate = resolveFile(distRoot, pathname);
  if (distCandidate) {
    const indexCandidate = maybeDirectoryIndex(distCandidate);
    if (indexCandidate) {
      sendFile(res, indexCandidate);
      return;
    }
    if (fileExists(distCandidate)) {
      sendFile(res, distCandidate);
      return;
    }
  }

  // Fall back to serving files from repo root (needed for Playwright pages under /test/playwright/pages).
  const repoCandidate = resolveFile(repoRoot, pathname);
  if (repoCandidate) {
    const indexCandidate = maybeDirectoryIndex(repoCandidate);
    if (indexCandidate) {
      sendFile(res, indexCandidate);
      return;
    }
    if (fileExists(repoCandidate)) {
      sendFile(res, repoCandidate);
      return;
    }
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`Not found: ${pathname}`);
});

server.listen(port, () => {
  console.log(`[e2e-static-server] serving dist/ + repo root on http://localhost:${port}`);
});
