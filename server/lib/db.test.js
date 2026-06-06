import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createJobs, listJobs, openDatabase, updateJob } from "./db.js";

let tempDir = null;

function tempDb() {
  tempDir = mkdtempSync(join(tmpdir(), "ilisten-db-"));
  return openDatabase(join(tempDir, "ilisten.sqlite"));
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("SQLite job persistence", () => {
  it("stores queued YouTube jobs and preserves updates", () => {
    const db = tempDb();
    const result = createJobs(db, ["https://youtube.com/watch?v=abc123"]);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].status).toBe("queued");
    expect(result.created[0].playlists).toEqual(["iPod - YouTube Converts"]);

    const updated = updateJob(db, result.created[0].id, {
      status: "complete",
      outputPath: "/tmp/Music Library/Unknown Artist/YouTube imports/01 - Song.m4a",
      selectedOutput: "ALAC from YouTube",
      playlists: ["iPod - Chill", "iPod - Artist"],
    });

    expect(updated.status).toBe("complete");
    expect(listJobs(db)[0].selectedOutput).toBe("ALAC from YouTube");
    expect(listJobs(db)[0].playlists).toEqual(["iPod - Chill", "iPod - Artist"]);
  });
});
