import { runProcess } from "./converter.js";

// Resolve a "song name" into real YouTube videos. yt-dlp's `ytsearchN:` query
// returns search results with full metadata (no API key, no download), which is
// the one capability the rest of the helper lacks. We then score each candidate
// against the library track so the review UI can flag weak/wrong matches.

const DEFAULT_LIMIT = 5;

function clean(value) {
  return String(value || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the YouTube search query for a track. The "official audio" hint biases
 * results toward clean studio uploads over covers/live versions.
 * @returns {string}
 */
export function buildSearchQuery(track = {}, { hint = "official audio" } = {}) {
  const artist = clean(track.artist) && !/^unknown artist$/i.test(track.artist) ? clean(track.artist) : "";
  const title = clean(track.title);
  return [artist, title, hint].filter(Boolean).join(" ").trim();
}

/**
 * Parse yt-dlp `--dump-single-json` output for an `ytsearch` query into a flat
 * list of candidates. Tolerates either a playlist object (with `entries`) or a
 * single entry, and ignores blank lines.
 * @returns {Array<{ id: string, url: string, title: string, channel: string, durationSec: number|null }>}
 */
export function parseSearchOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return [];

  let entries = [];
  try {
    const parsed = JSON.parse(text);
    entries = Array.isArray(parsed?.entries) ? parsed.entries : [parsed];
  } catch {
    // Fall back to NDJSON (one entry per line, as `--dump-json` emits).
    entries = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  }

  return entries
    .filter((entry) => entry && (entry.id || entry.url || entry.webpage_url))
    .map((entry) => ({
      id: String(entry.id || ""),
      url: entry.webpage_url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : entry.url || ""),
      title: clean(entry.title),
      channel: clean(entry.channel || entry.uploader || entry.creator || ""),
      durationSec: Number.isFinite(entry.duration) ? Math.round(entry.duration) : null,
    }))
    .filter((candidate) => candidate.url);
}

function normalizeTokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenOverlap(a, b) {
  const setA = new Set(normalizeTokens(a));
  const setB = new Set(normalizeTokens(b));
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / setA.size;
}

/**
 * Score a candidate against the library track on a 0–100 scale, combining how
 * close the duration is and how well the title/artist text overlaps. Mirrors the
 * idea behind vault-verse's TrackMatchingService confidence.
 * @returns {number}
 */
export function scoreCandidate(candidate, track = {}) {
  const wanted = `${track.artist || ""} ${track.title || ""}`;
  const found = `${candidate.channel || ""} ${candidate.title || ""}`;
  const textScore = tokenOverlap(`${track.title || ""}`, candidate.title) * 0.6
    + tokenOverlap(wanted, found) * 0.4;

  let durationScore = 0.5; // neutral when the library has no duration
  if (Number.isFinite(track.durationSec) && track.durationSec > 0 && Number.isFinite(candidate.durationSec)) {
    const delta = Math.abs(candidate.durationSec - track.durationSec);
    durationScore = delta <= 2 ? 1 : Math.max(0, 1 - (delta - 2) / 30);
  }

  return Math.round((textScore * 0.6 + durationScore * 0.4) * 100);
}

/**
 * Rank candidates best-first and attach a confidence score + duration delta.
 * @returns {Array<object>}
 */
export function rankCandidates(candidates, track = {}) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      confidence: scoreCandidate(candidate, track),
      durationDeltaSec: Number.isFinite(track.durationSec) && Number.isFinite(candidate.durationSec)
        ? candidate.durationSec - track.durationSec
        : null,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

// Below this confidence (or with a large duration gap) the match is flagged so
// the reviewer looks before it downloads.
export const LOW_CONFIDENCE = 55;
export const MAX_DURATION_GAP_SEC = 12;

function isFlagged(best) {
  if (!best) return true;
  if (best.confidence < LOW_CONFIDENCE) return true;
  if (Number.isFinite(best.durationDeltaSec) && Math.abs(best.durationDeltaSec) > MAX_DURATION_GAP_SEC) return true;
  return false;
}

/**
 * Search YouTube for one track and return ranked candidates + the best pick.
 * @returns {Promise<{ id, query, candidates, best, flagged, error? }>}
 */
export async function searchTrack(track, { ytdlpPath, limit = DEFAULT_LIMIT, run = runProcess } = {}) {
  const query = buildSearchQuery(track);
  const base = { id: track.id, query, candidates: [], best: null, flagged: true };
  if (!query) return { ...base, error: "Track has no title to search for." };

  try {
    const { stdout } = await run(ytdlpPath, [
      `ytsearch${limit}:${query}`,
      "--dump-single-json",
      "--no-warnings",
      "--no-playlist",
      "--skip-download",
    ]);
    const ranked = rankCandidates(parseSearchOutput(stdout), track);
    const best = ranked[0] || null;
    return { id: track.id, query, candidates: ranked, best, flagged: isFlagged(best) };
  } catch (error) {
    return { ...base, error: error.message };
  }
}

/**
 * Run several tracks through `searchTrack` with a small concurrency cap so we
 * stay polite to YouTube. `onProgress({ done, total, result })` fires per track.
 * @returns {Promise<Array<object>>}
 */
export async function searchTracks(tracks, { ytdlpPath, limit, concurrency = 3, onProgress, run } = {}) {
  const list = Array.isArray(tracks) ? tracks : [];
  const results = new Array(list.length);
  const total = list.length;
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      const result = await searchTrack(list[index], { ytdlpPath, limit, run });
      results[index] = result;
      done += 1;
      onProgress?.({ done, total, result });
    }
  };

  const pool = Array.from({ length: Math.min(Math.max(1, concurrency), list.length || 1) }, () => worker());
  await Promise.all(pool);
  return results;
}
