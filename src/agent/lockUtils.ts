export type Lock = {
  owner: string;
  session: string;
  timestamp: string; // ISO
  ttl_seconds: number;
  files: string[];
  intent?: string;
};

import * as fs from "fs";
import * as path from "path";

const repoRoot = process.cwd();
const lockPath = path.join(repoRoot, ".ai-lock.json");

function nowISO() {
  return new Date().toISOString();
}

export function readLock(): Lock | null {
  try {
    const raw = fs.readFileSync(lockPath, "utf8");
    return JSON.parse(raw) as Lock;
  } catch (e) {
    return null;
  }
}

export function isLockStale(lock: Lock): boolean {
  const ts = new Date(lock.timestamp).getTime();
  const expires = ts + lock.ttl_seconds * 1000;
  return Date.now() > expires;
}

export function acquireLock(lock: Lock): boolean {
  // simple atomic write by writing to temp and renaming
  const tmp = lockPath + "." + Math.random().toString(36).slice(2);
  try {
    if (fs.existsSync(lockPath)) return false;
    fs.writeFileSync(tmp, JSON.stringify(lock, null, 2), "utf8");
    fs.renameSync(tmp, lockPath);
    return true;
  } catch (e) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (e2) {}
    return false;
  }
}

export function releaseLock(): boolean {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    return true;
  } catch (e) {
    return false;
  }
}

export function appendAudit(entry: any) {
  const dir = path.join(repoRoot, ".ai-history");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const fname = path.join(
    dir,
    Date.now() + "-" + (entry.owner || "unknown") + ".json",
  );
  fs.writeFileSync(fname, JSON.stringify(entry, null, 2), "utf8");
}
