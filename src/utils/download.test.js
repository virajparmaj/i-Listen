import { describe, expect, it } from "vitest";
import { buildBackendManifest, buildLibraryManifest, filenameFor, libraryEntries, sanitizePathSegment } from "./download.js";

const completeTrack = (patch = {}) => ({
  id: patch.id || "t1",
  status: "complete",
  track: patch.track || "1",
  artist: patch.artist || "Artist",
  album: patch.album || "Album",
  title: patch.title || "Song",
  year: patch.year || "2026",
  ext: patch.ext || "mp3",
  ...patch,
});

describe("safe library filenames", () => {
  it("sanitizes Windows and Mac unsafe path segments", () => {
    expect(sanitizePathSegment('AUX')).toBe("Untitled");
    expect(sanitizePathSegment('My:Song/Name?.')).toBe("My-Song-Name");
    expect(filenameFor(completeTrack({ title: 'Bad:Name/Take?', track: "7" }), "track-song")).toBe("07 - Bad-Name-Take.mp3");
  });

  it("adds suffixes when organized paths would overwrite each other", () => {
    const tracks = [
      completeTrack({ id: "a", title: "Single", track: "1" }),
      completeTrack({ id: "b", title: "Single", track: "1" }),
    ];

    const entries = libraryEntries(tracks, "track-song", { avoidOverwrite: true });

    expect(entries[0].path).toBe("Music Library/Artist/Album/01 - Single.mp3");
    expect(entries[1].path).toBe("Music Library/Artist/Album/01 - Single (2).mp3");
  });

  it("builds a manifest from completed tracks only", () => {
    const manifest = buildLibraryManifest([
      completeTrack({ id: "a", title: "Ready" }),
      completeTrack({ id: "b", title: "Failed", status: "failed" }),
    ]);

    expect(manifest).toContain("01 - Ready.mp3");
    expect(manifest).not.toContain("Failed");
  });

  it("builds an honest conversion plan from queued imports", () => {
    const manifest = buildBackendManifest([
      completeTrack({
        id: "queued-1",
        status: "queued",
        title: "Imported link 1",
        url: "https://youtube.com/watch?v=real-source",
        duration: "Pending",
        size: "Backend pending",
      }),
    ]);

    expect(manifest).toContain("iListen Conversion Plan");
    expect(manifest).toContain("best available from YouTube");
    expect(manifest).toContain("https://youtube.com/watch?v=real-source");
    expect(manifest).toContain("Status: queued");
  });
});
