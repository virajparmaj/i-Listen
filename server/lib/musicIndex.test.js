import { describe, expect, it } from "vitest";
import { buildIndex, chunk, classifyJob, identityPatch, normalizeTagKey, resolvePresence, tagVersion } from "./musicIndex.js";

const job = (patch = {}) => ({
  id: "j1",
  title: "Starboy",
  artist: "The Weeknd",
  album: "Starboy",
  albumArtist: "The Weeknd",
  year: "2016",
  track: "1",
  disc: "1",
  outputPath: "/exports/Music Library/The Weeknd/Starboy/01 - Starboy.m4a",
  coverPath: "",
  customCoverPath: "",
  musicDatabaseId: "",
  musicLocationPath: "",
  musicTagVersion: "",
  ...patch,
});

const entry = (patch = {}) => ({
  databaseId: "4242",
  persistentId: "AB12",
  path: "/exports/Music Library/The Weeknd/Starboy/01 - Starboy.m4a",
  title: "Starboy",
  artist: "The Weeknd",
  album: "Starboy",
  ...patch,
});

describe("chunk", () => {
  it("splits a list into fixed-size groups without dropping items", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 25)).toEqual([]);
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("tagVersion", () => {
  it("changes when any mirrored tag changes", () => {
    const base = tagVersion(job());
    expect(tagVersion(job())).toBe(base);
    expect(tagVersion(job({ title: "Starboy (Remix)" }))).not.toBe(base);
    expect(tagVersion(job({ album: "Starboy Deluxe" }))).not.toBe(base);
    expect(tagVersion(job({ track: "2" }))).not.toBe(base);
    expect(tagVersion(job({ outputPath: "/exports/elsewhere.m4a" }))).not.toBe(base);
  });

  it("ignores fields Music does not mirror", () => {
    expect(tagVersion(job({ id: "different", sourcePath: "/staging/x.webm" }))).toBe(tagVersion(job()));
  });
});

describe("resolvePresence", () => {
  it("matches by database ID even when Music moved the file into its Media folder", () => {
    // This is the live failure: Music copies on add, so the stored location is a
    // Media path and the export path can never match again.
    const index = buildIndex([entry({ path: "/Users/me/Music/Music/Media.localized/Music/The Weeknd/Starboy/01 Starboy.m4a" })]);
    expect(resolvePresence(job({ musicDatabaseId: "4242" }), index)).toBeTruthy();
  });

  it("matches by the recorded Music location when the database ID is not known yet", () => {
    const mediaPath = "/Users/me/Music/Music/Media.localized/Music/The Weeknd/Starboy/01 Starboy.m4a";
    const index = buildIndex([entry({ databaseId: "", path: mediaPath })]);
    expect(resolvePresence(job({ musicLocationPath: mediaPath }), index)).toBeTruthy();
  });

  it("falls back to the normalized tag key after organize moved the export", () => {
    const index = buildIndex([entry({ databaseId: "", path: "/somewhere/else.m4a" })]);
    expect(resolvePresence(job({ outputPath: "/exports/new/path.m4a" }), index)).toBeTruthy();
  });

  it("returns null when Music genuinely does not have the track", () => {
    const index = buildIndex([entry({ databaseId: "9", path: "/other.m4a", title: "Other", artist: "Nobody", album: "None" })]);
    expect(resolvePresence(job(), index)).toBeNull();
  });
});

describe("normalizeTagKey", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeTagKey({ artist: "  The   Weeknd ", title: "STARBOY", album: "Starboy" }))
      .toBe(normalizeTagKey({ artist: "the weeknd", title: "starboy", album: "starboy" }));
  });
});

describe("classifyJob", () => {
  it("adds a track Music does not have", () => {
    expect(classifyJob(job(), buildIndex([])).action).toBe("add");
  });

  it("refreshes a present track whose tags moved on", () => {
    const index = buildIndex([entry()]);
    const stale = job({ musicDatabaseId: "4242", musicTagVersion: "0000000000000000" });
    expect(classifyJob(stale, index).action).toBe("refresh");
  });

  it("refreshes a present track that has never recorded a tag version", () => {
    const index = buildIndex([entry()]);
    expect(classifyJob(job({ musicDatabaseId: "4242" }), index).action).toBe("refresh");
  });

  it("leaves an up-to-date track alone", () => {
    const index = buildIndex([entry()]);
    const current = job({ musicDatabaseId: "4242" });
    current.musicTagVersion = tagVersion(current);
    expect(classifyJob(current, index).action).toBe("current");
  });

  it("does not re-add after a reconvert, which is what duplicated the live playlist", () => {
    // 2026-06-21: all 145 tracks were reconverted, every row reset to pending, and
    // the path-keyed handoff added the whole library a second time.
    const index = buildIndex([entry({ path: "/Users/me/Music/Music/Media.localized/Music/The Weeknd/Starboy/01 Starboy.m4a" })]);
    const reconverted = job({ musicDatabaseId: "4242", musicTagVersion: "" });
    expect(classifyJob(reconverted, index).action).toBe("refresh");
  });
});

describe("identityPatch", () => {
  it("never lets an empty id overwrite a stored one", () => {
    // A SKIPPED/duplicate result used to blank music_persistent_id.
    expect(identityPatch({ databaseId: "", persistentId: "", locationPath: "", tagVersion: "" })).toEqual({});
  });

  it("writes each identity field that is present", () => {
    expect(identityPatch({ databaseId: "4242", persistentId: "AB12", locationPath: "/media/a.m4a", tagVersion: "abc" }))
      .toEqual({
        musicDatabaseId: "4242",
        musicPersistentId: "AB12",
        musicLocationPath: "/media/a.m4a",
        musicTagVersion: "abc",
      });
  });
});
