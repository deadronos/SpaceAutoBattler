import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as lockUtils from "../../src/agent/lockUtils";

const repoRoot = process.cwd();
const lockPath = path.join(repoRoot, ".ai-lock.json");
const historyDir = path.join(repoRoot, ".ai-history");

beforeEach(() => {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {}
  try {
    if (fs.existsSync(historyDir))
      fs.rmSync(historyDir, { recursive: true, force: true });
  } catch {}
});

afterEach(() => {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {}
  try {
    if (fs.existsSync(historyDir))
      fs.rmSync(historyDir, { recursive: true, force: true });
  } catch {}
});

describe("lockUtils", () => {
  it("reads null when no lock exists", () => {
    const l = lockUtils.readLock();
    expect(l).toBeNull();
  });

  it("can acquire and read lock", () => {
    const lock = {
      owner: "test-agent",
      session: "s1",
      timestamp: new Date().toISOString(),
      ttl_seconds: 1,
      files: ["src/foo.ts"],
      intent: "test",
    } as any;
    const ok = lockUtils.acquireLock(lock);
    expect(ok).toBe(true);
    const read = lockUtils.readLock();
    expect(read).not.toBeNull();
    expect(read!.owner).toBe("test-agent");
  });

  it("prevents acquiring when lock exists", () => {
    const lock = {
      owner: "a",
      session: "1",
      timestamp: new Date().toISOString(),
      ttl_seconds: 60,
      files: [],
    } as any;
    expect(lockUtils.acquireLock(lock)).toBe(true);
    const lock2 = {
      owner: "b",
      session: "2",
      timestamp: new Date().toISOString(),
      ttl_seconds: 60,
      files: [],
    } as any;
    expect(lockUtils.acquireLock(lock2)).toBe(false);
  });

  it("detects stale lock", async () => {
    const lock = {
      owner: "a",
      session: "1",
      timestamp: new Date(Date.now() - 5000).toISOString(),
      ttl_seconds: 1,
      files: [],
    } as any;
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), "utf8");
    const read = lockUtils.readLock();
    expect(read).not.toBeNull();
    expect(lockUtils.isLockStale(read!)).toBe(true);
  });

  it("releases lock and appends audit", () => {
    const lock = {
      owner: "a",
      session: "1",
      timestamp: new Date().toISOString(),
      ttl_seconds: 60,
      files: [],
    } as any;
    expect(lockUtils.acquireLock(lock)).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(true);
    const released = lockUtils.releaseLock();
    expect(released).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(false);

    lockUtils.appendAudit({ owner: "a", action: "test" });
    const files = fs.readdirSync(historyDir);
    expect(files.length).toBeGreaterThan(0);
  });
});
