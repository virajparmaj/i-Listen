import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mapJob } from "./useConverter.js";

const localStorageMock = {
  getItem(key) {
    return this.store[key] || "";
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
  store: {},
};

describe("job mapping", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    localStorageMock.clear();
    localStorageMock.setItem("ilisten.helperToken", "helper-token");
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("builds helper-backed cover and audio asset URLs from persisted paths", () => {
    const track = mapJob({
      id: "job-1",
      url: "https://youtube.com/watch?v=demo",
      outputOption: "best-youtube",
      title: "Song",
      artist: "Artist",
      album: "Album",
      albumArtist: "Artist",
      year: "2026",
      genre: "",
      track: "1",
      composer: "",
      comment: "",
      playlists: [],
      durationSec: 123,
      sizeBytes: 6_291_456,
      progress: 100,
      status: "complete",
      warning: "",
      error: "",
      selectedOutput: "ALAC from YouTube",
      outputPath: "/tmp/exports/Music Library/Artist/Album/01 - Song.m4a",
      coverPath: "/tmp/artwork/job-1.jpg",
      sourcePath: "",
      sourceCodec: "aac",
      updatedAt: "2026-06-06T12:00:00.000Z",
      createdAt: "2026-06-06T11:00:00.000Z",
    });

    expect(track.coverArt).toContain("/jobs/job-1/cover");
    expect(track.audioUrl).toContain("/jobs/job-1/audio");
    expect(track.coverArt).toContain("token=helper-token");
    expect(track.audioUrl).toContain("v=2026-06-06T12%3A00%3A00.000Z");
  });

  it("keeps placeholder artwork and no preview URL when helper assets do not exist", () => {
    const track = mapJob({
      id: "job-2",
      url: "https://youtube.com/watch?v=demo-2",
      outputOption: "best-youtube",
      title: "Song Two",
      artist: "Artist",
      album: "Album",
      albumArtist: "Artist",
      year: "",
      genre: "",
      track: "2",
      composer: "",
      comment: "",
      playlists: [],
      durationSec: null,
      sizeBytes: null,
      progress: 0,
      status: "queued",
      warning: "",
      error: "",
      selectedOutput: "",
      outputPath: "",
      coverPath: "",
      sourcePath: "",
      sourceCodec: "",
      updatedAt: "",
      createdAt: "",
    });

    expect(track.coverArt).toBeNull();
    expect(track.audioUrl).toBeNull();
    expect(track.size).toBe("After conversion");
  });
});
