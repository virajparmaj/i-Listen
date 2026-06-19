import { describe, expect, it } from "vitest";
import { sortForConversionQueue, sortForSyncTracks } from "./trackOrdering.js";

function track(id, patch = {}) {
  return {
    id,
    status: "complete",
    metadataReviewStatus: "approved",
    outputPath: `/exports/${id}.m4a`,
    exportStatus: "validated",
    appleMusicPlaylistStatus: "added",
    readyForFinderSync: 0,
    syncState: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...patch,
  };
}

describe("track ordering", () => {
  it("keeps active and newly added conversion work above old completed rows", () => {
    const ordered = sortForConversionQueue([
      track("old-approved", { createdAt: "2026-06-01T00:00:00.000Z" }),
      track("new-approved", { createdAt: "2026-06-04T00:00:00.000Z" }),
      track("new-needs-review", { metadataReviewStatus: "needs_review", createdAt: "2026-06-05T00:00:00.000Z" }),
      track("old-converting", { status: "converting", metadataReviewStatus: "pending", createdAt: "2026-06-02T00:00:00.000Z" }),
      track("new-queued", { status: "queued", metadataReviewStatus: "pending", createdAt: "2026-06-06T00:00:00.000Z" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "old-converting",
      "new-queued",
      "new-needs-review",
      "new-approved",
      "old-approved",
    ]);
  });

  it("uses newest original position when batch timestamps match", () => {
    const ordered = sortForConversionQueue([
      track("first", { status: "queued", createdAt: "2026-06-01T00:00:00.000Z" }),
      track("second", { status: "queued", createdAt: "2026-06-01T00:00:00.000Z" }),
      track("third", { status: "queued", createdAt: "2026-06-01T00:00:00.000Z" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["third", "second", "first"]);
  });

  it("shows sync work needing attention before the finished back catalog", () => {
    const ordered = sortForSyncTracks([
      track("old-ready-finder", { readyForFinderSync: 1, createdAt: "2026-06-01T00:00:00.000Z" }),
      track("new-ready-finder", { readyForFinderSync: 1, createdAt: "2026-06-08T00:00:00.000Z" }),
      track("new-pending-handoff", { appleMusicPlaylistStatus: "pending", createdAt: "2026-06-07T00:00:00.000Z" }),
      track("new-needs-review", { metadataReviewStatus: "needs_review", appleMusicPlaylistStatus: "pending", createdAt: "2026-06-06T00:00:00.000Z" }),
      track("ai-running", { metadataReviewStatus: "needs_review", aiMetadataStatus: "running", createdAt: "2026-06-02T00:00:00.000Z" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual([
      "ai-running",
      "new-needs-review",
      "new-pending-handoff",
      "new-ready-finder",
      "old-ready-finder",
    ]);
  });
});
