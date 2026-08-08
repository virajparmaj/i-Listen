import { describe, expect, it } from "vitest";
import { classifyOsascriptError, ILISTEN_FOLDER, MASTER_PLAYLIST, parsePlaylistLines, parseResultLines } from "./appleMusic.js";
import { FIELD_SEP, RECONCILE_PLAYLIST_SCRIPT, REFRESH_TRACK_SCRIPT } from "./appleMusicScripts.js";

const line = (...fields) => fields.join(FIELD_SEP);

describe("appleMusic handoff helpers", () => {
  it("uses the iListen folder and master playlist names", () => {
    expect(ILISTEN_FOLDER).toBe("iListen");
    expect(MASTER_PLAYLIST).toBe("iPod Sync");
  });

  it("classifies a macOS Automation (TCC) denial", () => {
    const classified = classifyOsascriptError({
      stderr: "execution error: Not authorized to send Apple events to Music. (-1743)",
    });
    expect(classified.kind).toBe("tcc-denied");
    expect(classified.userMessage).toMatch(/Automation/);
  });

  it("classifies Music not running", () => {
    const classified = classifyOsascriptError({
      stderr: "Music got an error: Application isn't running. (-600)",
    });
    expect(classified.kind).toBe("music-not-running");
  });

  it("falls back to unknown for unexpected errors", () => {
    const classified = classifyOsascriptError({ message: "some weird failure" });
    expect(classified.kind).toBe("unknown");
    expect(classified.userMessage).toContain("weird");
  });

  it("avoids Music's reserved removed term in the reconcile script", () => {
    expect(RECONCILE_PLAYLIST_SCRIPT).toContain("set removedCount to 0");
    expect(RECONCILE_PLAYLIST_SCRIPT).not.toMatch(/set removed to/);
  });

  it("falls back to a per-track identity scan when Music bulk lookup fails", () => {
    expect(REFRESH_TRACK_SCRIPT).toContain("set knownPath to item 13 of argv");
    expect(REFRESH_TRACK_SCRIPT).toContain("repeat with candidateTrack in allTracks");
    expect(REFRESH_TRACK_SCRIPT).toContain("database ID of candidateTrack");
  });
});

describe("parseResultLines", () => {
  it("parses the six-field add result, including the path Music actually used", () => {
    const stdout = [
      line("ADDED", "/exports/a.m4a", "4242", "AB12", "/Users/me/Music/Music/Media/a.m4a", ""),
      line("FAILED", "/exports/c.m4a", "", "", "", "boom [-43]"),
    ].join("\n");

    const map = parseResultLines(stdout);

    expect(map.get("/exports/a.m4a")).toEqual({
      status: "added",
      databaseId: "4242",
      persistentId: "AB12",
      // Music copied the file into its own Media folder; recording where it
      // really landed is what makes the next handoff recognise this track.
      locationPath: "/Users/me/Music/Music/Media/a.m4a",
      reason: "",
    });
    expect(map.get("/exports/c.m4a").status).toBe("failed");
    expect(map.get("/exports/c.m4a").reason).toBe("boom [-43]");
  });

  it("returns an identity for a skipped duplicate so a good stored id is never blanked", () => {
    const map = parseResultLines(line("SKIPPED", "/exports/b.m4a", "4243", "CD34", "/exports/b.m4a", "duplicate"));
    expect(map.get("/exports/b.m4a").databaseId).toBe("4243");
    expect(map.get("/exports/b.m4a").persistentId).toBe("CD34");
  });

  it("uses the unit separator, not tab, so tabs in a reason cannot split a field", () => {
    const map = parseResultLines(line("ADDED", "/exports/a.m4a", "1", "P", "/exports/a.m4a", "note\twith\ttabs"));
    expect(map.get("/exports/a.m4a").reason).toBe("note\twith\ttabs");
  });

  it("ignores blank lines and lines without a path", () => {
    expect(parseResultLines("\n\n").size).toBe(0);
    expect(parseResultLines(line("ADDED", "", "1", "P", "", "")).size).toBe(0);
  });
});

describe("parsePlaylistLines", () => {
  it("parses a playlist snapshot into index entries", () => {
    const stdout = [
      line("4242", "AB12", "/exports/a.m4a", "Starboy", "The Weeknd", "Starboy"),
      line("4243", "CD34", "", "Cloud Song", "Someone", "An Album"),
    ].join("\n");

    expect(parsePlaylistLines(stdout)).toEqual([
      { databaseId: "4242", persistentId: "AB12", path: "/exports/a.m4a", title: "Starboy", artist: "The Weeknd", album: "Starboy" },
      { databaseId: "4243", persistentId: "CD34", path: "", title: "Cloud Song", artist: "Someone", album: "An Album" },
    ]);
  });

  it("treats a missing playlist as empty rather than throwing", () => {
    expect(parsePlaylistLines("NO_PLAYLIST")).toEqual([]);
    expect(parsePlaylistLines("")).toEqual([]);
  });

  it("keeps a row whose location is missing", () => {
    // Rows with no location are the lapsed-subscription cloud casualties; the
    // snapshot must surface them rather than dropping them.
    const rows = parsePlaylistLines(line("9", "ZZ", "", "Dead Song", "Artist", "Album"));
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe("");
  });
});
