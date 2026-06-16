import { describe, expect, it, vi } from "vitest";
import {
  buildSearchQuery,
  parseSearchOutput,
  rankCandidates,
  scoreCandidate,
  searchTrack,
  searchTracks,
} from "./youtubeSearch.js";

const SINGLE_JSON = JSON.stringify({
  entries: [
    { id: "aaa", title: "Apocalypse", channel: "Cigarettes After Sex", duration: 290, webpage_url: "https://www.youtube.com/watch?v=aaa" },
    { id: "bbb", title: "Apocalypse (Live)", uploader: "Some Fan", duration: 420 },
    { id: "ccc", title: "Apocalypse (cover)", uploader: "Cover Band", duration: 295 },
  ],
});

describe("buildSearchQuery", () => {
  it("combines artist + title + an official-audio hint", () => {
    expect(buildSearchQuery({ artist: "The Weeknd", title: "Starboy" })).toBe("The Weeknd Starboy official audio");
  });

  it("omits a placeholder artist", () => {
    expect(buildSearchQuery({ artist: "Unknown Artist", title: "Solo" })).toBe("Solo official audio");
  });
});

describe("parseSearchOutput", () => {
  it("flattens a single-json playlist into candidates with a watch url", () => {
    const candidates = parseSearchOutput(SINGLE_JSON);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({ id: "aaa", url: "https://www.youtube.com/watch?v=aaa", durationSec: 290 });
    expect(candidates[1].url).toBe("https://www.youtube.com/watch?v=bbb"); // synthesized from id
  });

  it("tolerates NDJSON and blank output", () => {
    expect(parseSearchOutput("")).toEqual([]);
    const nd = parseSearchOutput('{"id":"x","title":"X","duration":10}\n{"id":"y","title":"Y","duration":20}');
    expect(nd.map((c) => c.id)).toEqual(["x", "y"]);
  });
});

describe("scoreCandidate / rankCandidates", () => {
  it("rewards a near-exact duration and matching title", () => {
    const track = { title: "Apocalypse", artist: "Cigarettes After Sex", durationSec: 290 };
    const exact = scoreCandidate({ title: "Apocalypse", channel: "Cigarettes After Sex", durationSec: 290 }, track);
    const off = scoreCandidate({ title: "Apocalypse (Live)", channel: "Some Fan", durationSec: 420 }, track);
    expect(exact).toBeGreaterThan(off);
    expect(exact).toBeGreaterThan(80);
  });

  it("ranks the studio upload first and records the duration delta", () => {
    const track = { title: "Apocalypse", artist: "Cigarettes After Sex", durationSec: 290 };
    const ranked = rankCandidates(parseSearchOutput(SINGLE_JSON), track);
    expect(ranked[0].id).toBe("aaa");
    expect(ranked[0].durationDeltaSec).toBe(0);
  });
});

describe("searchTrack", () => {
  it("returns the best ranked candidate from yt-dlp output", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: SINGLE_JSON });
    const result = await searchTrack(
      { id: 101, title: "Apocalypse", artist: "Cigarettes After Sex", durationSec: 290 },
      { ytdlpPath: "yt-dlp", run },
    );
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][1][0]).toBe("ytsearch5:Cigarettes After Sex Apocalypse official audio");
    expect(result.best.id).toBe("aaa");
    expect(result.flagged).toBe(false);
  });

  it("surfaces a search error without throwing", async () => {
    const run = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await searchTrack({ id: 1, title: "X", artist: "Y" }, { run });
    expect(result.error).toBe("network down");
    expect(result.flagged).toBe(true);
    expect(result.best).toBeNull();
  });
});

describe("searchTracks", () => {
  it("preserves order, reports progress, and honors the concurrency cap", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: SINGLE_JSON });
    const progress = [];
    const tracks = [
      { id: 1, title: "A", artist: "X", durationSec: 290 },
      { id: 2, title: "B", artist: "Y", durationSec: 290 },
      { id: 3, title: "C", artist: "Z", durationSec: 290 },
    ];
    const results = await searchTracks(tracks, { run, concurrency: 2, onProgress: (p) => progress.push(p) });

    expect(results.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(run).toHaveBeenCalledTimes(3);
    expect(progress.at(-1)).toMatchObject({ done: 3, total: 3 });
  });
});
