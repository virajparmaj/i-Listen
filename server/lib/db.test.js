import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addLog, createJobs, getState, listJobs, listLogs, openDatabase, setState, updateJob } from "./db.js";

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
    expect(result.created[0].playlists).toEqual([]);
    expect(result.created[0].metadataReviewStatus).toBe("pending");

    const updated = updateJob(db, result.created[0].id, {
      status: "complete",
      outputPath: "/tmp/Music Library/Unknown Artist/Unknown Album/01 - Song.m4a",
      selectedOutput: "ALAC from YouTube",
      playlists: ["Chill", "iPod - Artist", "Hindi Mix"],
    });

    expect(updated.status).toBe("complete");
    expect(listJobs(db)[0].selectedOutput).toBe("ALAC from YouTube");
    expect(listJobs(db)[0].playlists).toEqual(["Chill", "Hindi Mix"]);
  });
});

describe("pipeline status + migration", () => {
  it("round-trips disc + pipeline status, preserving integer 0", () => {
    const db = tempDb();
    const job = createJobs(db, ["https://youtube.com/watch?v=mig123"]).created[0];

    const updated = updateJob(db, job.id, {
      disc: "1",
      exportStatus: "validated",
      readyForFinderSync: 1,
      appleMusicImportStatus: "imported",
      appleMusicPlaylistStatus: "added",
      artworkStatus: "embedded",
      metadataReviewStatus: "approved",
    });
    expect(updated.disc).toBe("1");
    expect(updated.exportStatus).toBe("validated");
    expect(updated.readyForFinderSync).toBe(1);
    expect(updated.appleMusicPlaylistStatus).toBe("added");
    expect(updated.metadataReviewStatus).toBe("approved");

    const reset = updateJob(db, job.id, { readyForFinderSync: 0 });
    expect(reset.readyForFinderSync).toBe(0);
  });

  it("reopening an existing database runs migrations idempotently", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ilisten-db-"));
    const path = join(tempDir, "ilisten.sqlite");
    const first = openDatabase(path);
    createJobs(first, ["https://youtube.com/watch?v=reopen"]);
    first.close();

    const second = openDatabase(path);
    expect(listJobs(second)).toHaveLength(1);
    second.close();
  });

  it("persists app_state key/value pairs with upsert", () => {
    const db = tempDb();
    expect(getState(db, "ipod_volume_path", "")).toBe("");
    setState(db, "ipod_volume_path", "/Volumes/iPod");
    expect(getState(db, "ipod_volume_path")).toBe("/Volumes/iPod");
    setState(db, "ipod_volume_path", "/Volumes/iPod 2");
    expect(getState(db, "ipod_volume_path")).toBe("/Volumes/iPod 2");
  });

  it("stores a log category", () => {
    const db = tempDb();
    addLog(db, "handoff line", "ok", "Sync:", "applemusic");
    const logs = listLogs(db);
    expect(logs[logs.length - 1].category).toBe("applemusic");
  });
});
