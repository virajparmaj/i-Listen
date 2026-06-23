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
      aiMetadataStatus: "approved",
      aiMetadataModel: "llama3:latest",
      aiMetadataConfidence: 0.91,
      aiMetadataSources: ["ollama", "musicbrainz"],
      aiMetadataError: "",
      aiMetadataUpdatedAt: "2026-06-06T12:01:00.000Z",
      audioIssueTags: ["left_channel_disturbance"],
      audioRepairPreset: "stereo-blend-safe",
      audioRepairStatus: "needs_repair",
      audioRepairNotes: "Left ear gets noisy.",
      audioAnalysis: { summary: ["left channel hotter/noisier"] },
      updatedAt: "2026-06-06T12:00:00.000Z",
      createdAt: "2026-06-06T11:00:00.000Z",
    });

    expect(track.coverArt).toContain("/jobs/job-1/cover");
    expect(track.audioUrl).toContain("/jobs/job-1/audio");
    expect(track.coverArt).toContain("token=helper-token");
    expect(track.audioUrl).toContain("v=2026-06-06T12%3A00%3A00.000Z");
    expect(track.aiMetadataStatus).toBe("approved");
    expect(track.aiMetadataModel).toBe("llama3:latest");
    expect(track.aiMetadataConfidence).toBe(0.91);
    expect(track.aiMetadataSources).toEqual(["ollama", "musicbrainz"]);
    expect(track.audioIssueTags).toEqual(["left_channel_disturbance"]);
    expect(track.audioRepairPreset).toBe("stereo-blend-safe");
    expect(track.audioRepairStatus).toBe("needs_repair");
    expect(track.audioRepairNotes).toBe("Left ear gets noisy.");
    expect(track.audioAnalysis.summary).toEqual(["left channel hotter/noisier"]);
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

  it("uses trusted custom/catalog art as a cover asset source", () => {
    const track = mapJob({
      id: "job-3",
      url: "https://youtube.com/watch?v=demo-3",
      outputOption: "best-youtube",
      title: "Song Three",
      artist: "Artist",
      album: "Album",
      albumArtist: "Artist",
      playlists: [],
      progress: 100,
      status: "complete",
      outputPath: "",
      coverPath: "",
      customCoverPath: "/tmp/artwork/job-3-catalog.jpg",
      updatedAt: "2026-06-06T12:00:00.000Z",
      createdAt: "2026-06-06T11:00:00.000Z",
    });

    expect(track.coverArt).toContain("/jobs/job-3/cover");
  });

  it("maps bass-safe reconverted jobs back to the Bass Safe preset", () => {
    const track = mapJob({
      id: "job-4",
      url: "https://youtube.com/watch?v=demo-4",
      outputOption: "ipod-safe-aac",
      title: "Bass Song",
      artist: "Artist",
      album: "Album",
      albumArtist: "Artist",
      playlists: [],
      durationSec: 120,
      sizeBytes: 4_000_000,
      progress: 100,
      status: "complete",
      outputPath: "/tmp/song.m4a",
      coverPath: "",
      customCoverPath: "",
      updatedAt: "",
      createdAt: "",
    });

    expect(track.preset).toBe("ipodSafe");
    expect(track.qualityLabel).toBe("Bass Safe AAC");
  });

  it("maps audio repaired jobs to repair output metadata", () => {
    const track = mapJob({
      id: "job-5",
      url: "https://youtube.com/watch?v=demo-5",
      outputOption: "bass-safe-plus",
      selectedOutput: "Bass Safe Plus AAC",
      title: "Repair Song",
      artist: "Artist",
      album: "Album",
      albumArtist: "Artist",
      playlists: [],
      durationSec: 120,
      sizeBytes: 4_000_000,
      progress: 100,
      status: "complete",
      outputPath: "/tmp/song.m4a",
      coverPath: "",
      customCoverPath: "",
      audioIssueTags: [],
      audioRepairPreset: "bass-safe-plus",
      audioRepairStatus: "repaired",
      updatedAt: "",
      createdAt: "",
    });

    expect(track.outputOption).toBe("bass-safe-plus");
    expect(track.format).toBe("aac");
    expect(track.qualityLabel).toBe("Bass Safe Plus AAC");
    expect(track.audioRepairStatus).toBe("repaired");
  });
});
