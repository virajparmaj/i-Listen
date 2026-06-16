import { describe, expect, it } from "vitest";
import {
  buildImportMatches,
  chosenUrl,
  chunk,
  playlistsForTrack,
  selectedTrackIds,
} from "./useXmlImport.js";

const library = {
  playlists: [
    { id: "p1", name: "Chill", trackIds: [1, 2, 3] },
    { id: "p2", name: "Focus", trackIds: [2, 4] },
  ],
  tracksById: {
    1: { id: 1, title: "A", artist: "X", album: "Al", albumArtist: "", year: "2020", genre: "Pop", trackNumber: 1, durationSec: 200 },
    2: { id: 2, title: "B", artist: "Y", trackNumber: 2 },
    3: { id: 3, title: "C", artist: "Z" },
    4: { id: 4, title: "D", artist: "W" },
  },
};

describe("chunk", () => {
  it("splits an array into fixed-size batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("selectedTrackIds", () => {
  it("unions selected playlists, de-duplicates, and drops excluded ids", () => {
    const ids = selectedTrackIds(library, new Set(["p1", "p2"]), new Set([3]));
    expect(ids).toEqual([1, 2, 4]);
  });
});

describe("playlistsForTrack", () => {
  it("returns every selected playlist that contains the track", () => {
    expect(playlistsForTrack(library, new Set(["p1", "p2"]), 2)).toEqual(["Chill", "Focus"]);
    expect(playlistsForTrack(library, new Set(["p1", "p2"]), 1)).toEqual(["Chill"]);
  });
});

describe("chosenUrl", () => {
  it("prefers a manual paste, then the chosen candidate, then the best", () => {
    expect(chosenUrl({ manualUrl: " m ", candidates: [{ url: "c" }], chosenIndex: 0 })).toBe("m");
    expect(chosenUrl({ candidates: [{ url: "c0" }, { url: "c1" }], chosenIndex: 1 })).toBe("c1");
    expect(chosenUrl({ candidates: [], best: { url: "b" } })).toBe("b");
    expect(chosenUrl({ candidates: [] })).toBe("");
  });
});

describe("buildImportMatches", () => {
  it("builds the import payload with seeded metadata and playlist assignments", () => {
    const matches = {
      1: { trackId: 1, candidates: [{ url: "u1" }], chosenIndex: 0 },
      2: { trackId: 2, manualUrl: "manual2", candidates: [{ url: "u2" }], chosenIndex: 0 },
      4: { trackId: 4, candidates: [], best: null, chosenIndex: 0 },
    };
    const result = buildImportMatches({ library, selectedPlaylistIds: new Set(["p1", "p2"]), matches });

    expect(result).toHaveLength(2); // track 4 has no URL and is dropped
    expect(result[0]).toMatchObject({
      youtubeUrl: "u1",
      metadata: { title: "A", artist: "X", album: "Al", albumArtist: "X", year: "2020", genre: "Pop", track: "1" },
      playlists: ["Chill"],
    });
    expect(result[1]).toMatchObject({ youtubeUrl: "manual2", playlists: ["Chill", "Focus"] });
  });
});
