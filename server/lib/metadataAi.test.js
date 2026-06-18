import { describe, expect, it } from "vitest";
import { proposeAiMetadata, sanitizeMetadataProposal } from "./metadataAi.js";

describe("AI metadata proposal cleanup", () => {
  it("removes YouTube wording, filters legacy playlists, and normalizes confidence", () => {
    const result = sanitizeMetadataProposal({
      title: "Clean Song (Official Video)",
      artist: "Clean Artist - Topic",
      album: "YouTube imports",
      albumArtist: "Clean Artist VEVO",
      year: "Released on 2020-01-02",
      track: "06",
      disc: "1",
      composer: "Composer YouTube",
      playlists: ["Chill", "iPod - Artist"],
      confidence: 88,
      sources: ["ollama", "musicbrainz", "ollama"],
    }, {
      title: "YouTube link 1",
      artist: "Unknown Artist",
      album: "Unknown Album",
      albumArtist: "Unknown Artist",
      track: "1",
      playlists: ["Existing"],
    });

    expect(result.metadata).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Unknown Album",
      albumArtist: "Clean Artist",
      year: "2020",
      track: "06",
      disc: "1",
      composer: "Composer",
      playlists: ["Chill"],
    });
    expect(result.confidence).toBe(0.88);
    expect(result.sources).toEqual(["ollama", "musicbrainz"]);
  });

  it("uses safe defaults when AI fields are empty or unusable", () => {
    const result = sanitizeMetadataProposal({}, {
      title: "YouTube link 9",
      artist: "Unknown Artist",
      album: "YouTube imports",
      albumArtist: "Unknown Artist",
      track: "not-a-track",
    });

    expect(result.metadata.title).toBe("Untitled");
    expect(result.metadata.artist).toBe("Unknown Artist");
    expect(result.metadata.album).toBe("Unknown Album");
    expect(result.metadata.albumArtist).toBe("Unknown Artist");
    expect(result.metadata.track).toBe("1");
  });

  it("falls back to ranked metadata candidates when Ollama returns invalid JSON", async () => {
    const proposal = await proposeAiMetadata({
      title: "Messy Song",
      artist: "Messy Artist",
      album: "Unknown Album",
      albumArtist: "Messy Artist",
      track: "1",
      playlists: [],
    }, {
      model: "llama3:latest",
      contextBuilder: async () => ({
        musicBrainzCandidates: [{
          source: "musicbrainz",
          score: 93,
          title: "Clean Song",
          artist: "Clean Artist",
          album: "Clean Album",
          albumArtist: "Clean Artist",
          year: "2022",
          track: "4",
          disc: "1",
        }],
        acoustidCandidates: [],
      }),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ message: { content: "not json" } }),
      }),
    });

    expect(proposal.usedFallback).toBe(true);
    expect(proposal.metadata).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      year: "2022",
      track: "4",
    });
    expect(proposal.confidence).toBe(0.93);
    expect(proposal.sources).toEqual(["musicbrainz"]);
  });
});
