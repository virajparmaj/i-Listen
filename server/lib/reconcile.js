import { normalizeTagKey } from "./musicIndex.js";

/**
 * Pure planning for playlist reconciliation.
 *
 * All decisions are made here rather than in AppleScript so they can be tested
 * without touching Music. The script only executes a precomputed list of 1-based
 * indices to delete.
 */

/**
 * Work out what to remove from a playlist so it matches the approved set.
 *
 * Two kinds of removal:
 *  - duplicates: the same library track referenced more than once. The FIRST
 *    occurrence is kept so playlist order is preserved.
 *  - orphans: entries whose track is not in the approved set at all (stale rows
 *    left behind by earlier rebuilds, or cloud rows from a lapsed subscription).
 *
 * @param {Array<{databaseId?: string, path?: string, title?: string, artist?: string, album?: string}>} entries
 *        playlist entries in playlist order
 * @param {Set<string>|Array<string>} keepDatabaseIds database IDs that should stay
 * @returns {{ removeIndices: number[], duplicates: object[], orphans: object[],
 *             cloudRows: object[], danglingRows: object[], keptCount: number, total: number }}
 */
export function planReconcile(entries = [], keepDatabaseIds = []) {
  const keep = keepDatabaseIds instanceof Set ? keepDatabaseIds : new Set(keepDatabaseIds);
  const seen = new Set();
  const removeIndices = [];
  const duplicates = [];
  const orphans = [];
  const cloudRows = [];
  const danglingRows = [];
  let keptCount = 0;

  entries.forEach((entry, i) => {
    const index = i + 1; // AppleScript is 1-based
    const dbid = String(entry?.databaseId || "");
    const row = { index, ...entry };

    // A row with no location is either a cloud/subscription track or a file Music
    // can no longer find. Both are reported; neither is auto-removed here.
    if (!entry?.path) (dbid ? cloudRows : danglingRows).push(row);

    if (!dbid || !keep.has(dbid)) {
      orphans.push(row);
      removeIndices.push(index);
      return;
    }
    if (seen.has(dbid)) {
      duplicates.push(row);
      removeIndices.push(index);
      return;
    }
    seen.add(dbid);
    keptCount += 1;
  });

  return { removeIndices, duplicates, orphans, cloudRows, danglingRows, keptCount, total: entries.length };
}

/**
 * Refuse to run a reconcile that would leave the playlist empty or that has
 * nothing to do. Returning a reason rather than throwing keeps this usable
 * directly from a route handler.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateReconcilePlan(plan, { minKeep = 1 } = {}) {
  if (!plan || !Array.isArray(plan.removeIndices)) return { ok: false, reason: "No reconcile plan." };
  if (!plan.removeIndices.length) return { ok: false, reason: "Playlist already matches iListen; nothing to reconcile." };
  if (plan.keptCount < minKeep) {
    return { ok: false, reason: `Refusing to reconcile: it would leave ${plan.keptCount} tracks in the playlist.` };
  }
  return { ok: true };
}

/**
 * Match playlist rows that Music can no longer play (cloud/subscription rows)
 * against the local library, so they can be swapped for an owned file.
 *
 * @param {object[]} rows rows from planReconcile().cloudRows
 * @param {object[]} jobs iListen jobs with an outputPath
 * @returns {{ swappable: Array<{row: object, job: object}>, missing: object[] }}
 */
export function planCloudRowSwap(rows = [], jobs = []) {
  const byKey = new Map();
  jobs.forEach((job) => {
    if (!job?.outputPath) return;
    const key = normalizeTagKey(job);
    if (key !== "||" && !byKey.has(key)) byKey.set(key, job);
  });

  const swappable = [];
  const missing = [];
  rows.forEach((row) => {
    const job = byKey.get(normalizeTagKey(row));
    if (job) swappable.push({ row, job });
    else missing.push(row);
  });
  return { swappable, missing };
}

/**
 * Summarize a playlist inventory for the "Before you sync" card.
 * `expectedCount` is how many approved tracks iListen believes should be there.
 */
export function summarizePreflight(playlists = [], { syncPlaylist, expectedCount = 0 } = {}) {
  const target = playlists.find((p) => p.name === syncPlaylist) || null;
  const others = playlists
    .filter((p) => p.name !== syncPlaylist && !p.smart && p.trackCount > 0)
    .sort((a, b) => b.trackCount - a.trackCount);

  return {
    playlist: target,
    expectedCount,
    matches: Boolean(target) && target.trackCount === expectedCount,
    // Finder syncs whatever the user ticked, and that selection is not exposed to
    // scripting. All iListen can do is show the arithmetic.
    otherPlaylists: others.map(({ name, trackCount, nonFileCount }) => ({ name, trackCount, nonFileCount })),
    otherTrackTotal: others.reduce((sum, p) => sum + p.trackCount, 0),
    // Playlist ROWS, not unique songs: a song in five playlists counts five
    // times. Do not present this as a song count.
    deadPlaylistRows: playlists.reduce((sum, p) => sum + (p.nonFileCount || 0), 0),
  };
}
