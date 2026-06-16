import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { looksLikeIpod, verifyIpodVolume } from "./ipod.js";

let tempDir = null;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("iPod detection helpers", () => {
  it("recognizes an iPod volume by its iPod_Control folder", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ipodvol-"));
    expect(looksLikeIpod(tempDir)).toBe(false);
    mkdirSync(join(tempDir, "iPod_Control"));
    expect(looksLikeIpod(tempDir)).toBe(true);
  });

  it("rejects a non-iPod path and accepts a verified iPod volume", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ipodvol-"));

    expect(verifyIpodVolume(join(tempDir, "missing")).ok).toBe(false);

    const notIpod = verifyIpodVolume(tempDir);
    expect(notIpod.ok).toBe(false);
    expect(notIpod.error).toMatch(/iPod/);

    mkdirSync(join(tempDir, "iPod_Control"));
    const good = verifyIpodVolume(tempDir);
    expect(good.ok).toBe(true);
    expect(good.diskUseEnabled).toBe(true);
    expect(typeof good.capacityBytes).toBe("number");
  });
});
