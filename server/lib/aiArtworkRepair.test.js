import { describe, expect, it } from "vitest";
import { findAiArtworkRepairCandidates, repairAiArtwork } from "./aiArtworkRepair.js";

describe("AI artwork repair", () => {
  it("finds approved AI rows that are missing trusted custom/catalog artwork", () => {
    const jobs = [
      { id: "needs-art", status: "complete", outputPath: "/tmp/1.m4a", metadataReviewStatus: "approved", aiMetadataStatus: "approved", customCoverPath: "" },
      { id: "manual-art", status: "complete", outputPath: "/tmp/2.m4a", metadataReviewStatus: "approved", aiMetadataStatus: "approved", customCoverPath: "/tmp/art.jpg" },
      { id: "manual-review", status: "complete", outputPath: "/tmp/3.m4a", metadataReviewStatus: "needs_review", aiMetadataStatus: "failed", customCoverPath: "" },
    ];

    expect(findAiArtworkRepairCandidates(jobs).map((job) => job.id)).toEqual(["needs-art"]);
    expect(findAiArtworkRepairCandidates(jobs, ["manual-art"])).toEqual([]);
  });

  it("dry-runs repair candidates without mutating", async () => {
    const result = await repairAiArtwork({
      jobs: [{
        id: "needs-art",
        status: "complete",
        outputPath: "/tmp/1.m4a",
        title: "Song",
        artist: "Artist",
        album: "Album",
        metadataReviewStatus: "approved",
        aiMetadataStatus: "approved",
        customCoverPath: "",
      }],
      apply: false,
      contextBuilder: async () => ({
        itunesCandidates: [{
          source: "itunes",
          score: 90,
          title: "Song",
          artist: "Artist",
          album: "Album",
          artworkUrl: "https://example.test/100x100bb.jpg",
        }],
      }),
    });

    expect(result.apply).toBe(false);
    expect(result.candidates).toBe(1);
    expect(result.results[0]).toMatchObject({
      id: "needs-art",
      ok: true,
      action: "dry-run",
      source: "itunes",
      artworkUrl: "https://example.test/1000x1000bb.jpg",
    });
  });
});
