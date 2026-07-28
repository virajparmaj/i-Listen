import { createHash } from "node:crypto";
import { statSync } from "node:fs";

/**
 * Identity and staleness helpers for the Apple Music handoff.
 *
 * Background: Music copies files into its own Media folder by default, so the
 * export path iListen wrote is NOT the path Music stores. Deduping on the export
 * path therefore stops matching after the first add, and every later handoff
 * appends the whole library again. These helpers let the handoff resolve a job to
 * an existing Music track by identity instead of by path, and tell whether that
 * track still reflects the job's current tags.
 */

/** Split a list into fixed-size chunks (one osascript spawn per chunk). */
export function chunk(list, size) {
  const items = Array.isArray(list) ? list : [];
  const n = Math.max(1, Number(size) || 1);
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

function artworkStamp(path) {
  if (!path) return "";
  try {
    const s = statSync(path);
    return `${s.size}:${s.mtimeMs}`;
  } catch {
    return "";
  }
}

/**
 * A short hash of everything Music mirrors from the file. It changes whenever
 * organize/retag/reconvert alters a tag, the artwork, or the output path, so a
 * stored value that no longer matches means "Music holds stale tags".
 * @param {object} job
 * @returns {string}
 */
export function tagVersion(job) {
  if (!job) return "";
  const art = job.customCoverPath || job.coverPath || "";
  const parts = [
    job.title, job.artist, job.album, job.albumArtist,
    job.year, job.track, job.disc, job.outputPath,
    art, artworkStamp(art),
  ].map((value) => String(value ?? ""));
  return createHash("sha1").update(parts.join("")).digest("hex").slice(0, 16);
}

/** Normalized artist|title|album key, used as the last-resort match. */
export function normalizeTagKey({ title, artist, album } = {}) {
  const norm = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(artist)}|${norm(title)}|${norm(album)}`;
}

/**
 * Build lookup maps from a flat list of Music playlist entries.
 * @param {Array<{databaseId?: string, path?: string, title?: string, artist?: string, album?: string}>} entries
 */
export function buildIndex(entries = []) {
  const byDbid = new Map();
  const byPath = new Map();
  const byTagKey = new Map();
  entries.forEach((entry) => {
    if (!entry) return;
    if (entry.databaseId) byDbid.set(String(entry.databaseId), entry);
    if (entry.path) byPath.set(entry.path, entry);
    const key = normalizeTagKey(entry);
    if (key !== "||") byTagKey.set(key, entry);
  });
  return { byDbid, byPath, byTagKey };
}

/**
 * Find the Music entry that corresponds to a job, most reliable signal first.
 * The tag-key fallback is what catches a file organizeExport moved after the
 * original add.
 * @returns {object|null}
 */
export function resolvePresence(job, index) {
  if (!job || !index) return null;
  return (job.musicDatabaseId && index.byDbid.get(String(job.musicDatabaseId)))
    || (job.outputPath && index.byPath.get(job.outputPath))
    || (job.musicLocationPath && index.byPath.get(job.musicLocationPath))
    || index.byTagKey.get(normalizeTagKey(job))
    || null;
}

/**
 * Decide what the handoff should do with one job.
 * - "add"     : Music has no matching track
 * - "refresh" : Music has it, but the stored tag version is missing or stale
 * - "current" : Music has it and it is up to date
 * @returns {{ action: "add"|"refresh"|"current", entry: object|null, tagVersion: string }}
 */
export function classifyJob(job, index) {
  const version = tagVersion(job);
  const entry = resolvePresence(job, index);
  if (!entry) return { action: "add", entry: null, tagVersion: version };
  if (!job.musicTagVersion || job.musicTagVersion !== version) {
    return { action: "refresh", entry, tagVersion: version };
  }
  return { action: "current", entry, tagVersion: version };
}

/**
 * Build the DB patch for one handoff result. Identity fields are only written
 * when non-empty: a SKIPPED/duplicate result used to overwrite a good stored id
 * with "", which forced every later lookup onto the slow path.
 */
export function identityPatch(result = {}) {
  const patch = {};
  if (result.databaseId) patch.musicDatabaseId = String(result.databaseId);
  if (result.persistentId) patch.musicPersistentId = String(result.persistentId);
  if (result.locationPath) patch.musicLocationPath = String(result.locationPath);
  if (result.tagVersion) patch.musicTagVersion = String(result.tagVersion);
  return patch;
}
