import { describe, expect, it } from "vitest";
import { planCloudRowSwap, planReconcile, summarizePreflight, validateReconcilePlan } from "./reconcile.js";

const row = (databaseId, patch = {}) => ({
  databaseId,
  persistentId: `P${databaseId}`,
  path: `/exports/${databaseId}.m4a`,
  title: `Song ${databaseId}`,
  artist: "Artist",
  album: "Album",
  ...patch,
});

describe("planReconcile", () => {
  it("keeps the first occurrence of a duplicated track and removes the rest", () => {
    const entries = [row("1"), row("2"), row("1"), row("2")];
    const plan = planReconcile(entries, ["1", "2"]);

    expect(plan.removeIndices).toEqual([3, 4]);
    expect(plan.duplicates).toHaveLength(2);
    expect(plan.keptCount).toBe(2);
  });

  it("removes entries whose track is not in the approved set", () => {
    const plan = planReconcile([row("1"), row("99"), row("2")], ["1", "2"]);

    expect(plan.removeIndices).toEqual([2]);
    expect(plan.orphans).toHaveLength(1);
    expect(plan.orphans[0].databaseId).toBe("99");
  });

  it("reproduces the live 291-row playlist: every track present exactly twice", () => {
    // Live state on 2026-07-27: 291 rows, 146 unique database IDs, each track
    // referenced twice after the reconvert re-added the whole library.
    const ids = Array.from({ length: 146 }, (_, i) => String(i + 1));
    const entries = [...ids.map((id) => row(id)), ...ids.map((id) => row(id)), row("1")];
    const plan = planReconcile(entries, ids);

    expect(plan.total).toBe(293);
    expect(plan.keptCount).toBe(146);
    expect(plan.removeIndices).toHaveLength(147);
    expect(plan.orphans).toHaveLength(0);
    // Indices must be usable descending without shifting past the end.
    expect(Math.max(...plan.removeIndices)).toBeLessThanOrEqual(plan.total);
  });

  it("separates cloud rows (no location, has an id) from dangling rows", () => {
    const plan = planReconcile([
      row("1"),
      row("2", { path: "" }),
      row("", { path: "" }),
    ], ["1", "2"]);

    expect(plan.cloudRows.map((r) => r.databaseId)).toEqual(["2"]);
    expect(plan.danglingRows).toHaveLength(1);
  });

  it("reports 1-based indices, matching AppleScript", () => {
    const plan = planReconcile([row("99")], []);
    expect(plan.removeIndices).toEqual([1]);
  });

  it("plans nothing for an already-correct playlist", () => {
    const plan = planReconcile([row("1"), row("2")], ["1", "2"]);
    expect(plan.removeIndices).toEqual([]);
    expect(plan.keptCount).toBe(2);
  });
});

describe("validateReconcilePlan", () => {
  it("refuses a plan that would empty the playlist", () => {
    const plan = planReconcile([row("1"), row("2")], []);
    expect(validateReconcilePlan(plan)).toMatchObject({ ok: false });
    expect(validateReconcilePlan(plan).reason).toMatch(/leave 0 tracks/);
  });

  it("refuses a no-op instead of spawning osascript for nothing", () => {
    const plan = planReconcile([row("1")], ["1"]);
    expect(validateReconcilePlan(plan)).toMatchObject({ ok: false });
    expect(validateReconcilePlan(plan).reason).toMatch(/already matches/);
  });

  it("allows a plan that removes duplicates but keeps real tracks", () => {
    const plan = planReconcile([row("1"), row("1")], ["1"]);
    expect(validateReconcilePlan(plan)).toEqual({ ok: true });
  });
});

describe("planCloudRowSwap", () => {
  const job = (title, artist, album) => ({
    id: `${title}-${artist}`,
    title,
    artist,
    album,
    outputPath: `/exports/${title}.m4a`,
  });

  it("matches a dead cloud row to an owned local file by normalized tags", () => {
    const rows = [{ title: "Starboy", artist: "The Weeknd", album: "Starboy" }];
    const result = planCloudRowSwap(rows, [job("starboy", "the weeknd", "starboy")]);

    expect(result.swappable).toHaveLength(1);
    expect(result.missing).toHaveLength(0);
  });

  it("reports cloud rows iListen cannot replace, so they can be queued for conversion", () => {
    const rows = [{ title: "Unowned", artist: "Someone", album: "Nothing" }];
    const result = planCloudRowSwap(rows, [job("Starboy", "The Weeknd", "Starboy")]);

    expect(result.swappable).toHaveLength(0);
    expect(result.missing[0].title).toBe("Unowned");
  });

  it("ignores jobs with no exported file", () => {
    const rows = [{ title: "Starboy", artist: "The Weeknd", album: "Starboy" }];
    const result = planCloudRowSwap(rows, [{ title: "Starboy", artist: "The Weeknd", album: "Starboy", outputPath: "" }]);
    expect(result.swappable).toHaveLength(0);
  });
});

describe("summarizePreflight", () => {
  const playlists = [
    { name: "iPod Sync", parent: "iListen", smart: false, trackCount: 291, nonFileCount: 0 },
    { name: "Road Trip", parent: "", smart: false, trackCount: 104, nonFileCount: 99 },
    { name: "Top 25 Most Played", parent: "", smart: true, trackCount: 25, nonFileCount: 15 },
  ];

  it("flags a mismatch between the playlist and what iListen expects", () => {
    const summary = summarizePreflight(playlists, { syncPlaylist: "iPod Sync", expectedCount: 145 });
    expect(summary.matches).toBe(false);
    expect(summary.playlist.trackCount).toBe(291);
  });

  it("lists other playlists Finder could also be syncing, excluding smart ones", () => {
    const summary = summarizePreflight(playlists, { syncPlaylist: "iPod Sync", expectedCount: 291 });
    expect(summary.matches).toBe(true);
    expect(summary.otherPlaylists.map((p) => p.name)).toEqual(["Road Trip"]);
    expect(summary.otherTrackTotal).toBe(104);
  });

  it("totals dead subscription ROWS, which is not a unique song count", () => {
    // A song in five playlists contributes five rows; the UI must not call this
    // a song count.
    const summary = summarizePreflight(playlists, { syncPlaylist: "iPod Sync", expectedCount: 291 });
    expect(summary.deadPlaylistRows).toBe(114);
  });
});
