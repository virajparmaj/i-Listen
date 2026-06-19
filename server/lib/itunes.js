const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

function clean(value) {
  return String(value || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenOverlap(wanted, found) {
  const left = new Set(normalizeTokens(wanted));
  const right = new Set(normalizeTokens(found));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / left.size;
}

function releaseYear(value) {
  const match = String(value || "").match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : "";
}

function durationSec(value) {
  const millis = Number(value);
  return Number.isFinite(millis) && millis > 0 ? Math.round(millis / 1000) : null;
}

export function buildItunesQuery(job = {}) {
  if (clean(job.searchQuery)) return clean(job.searchQuery);
  return [job.title, job.artist]
    .map(clean)
    .filter(Boolean)
    .join(" ");
}

function uniqueQueries(job = {}) {
  return [
    buildItunesQuery(job),
    ...(Array.isArray(job.fallbackQueries) ? job.fallbackQueries : []),
  ].map(clean).filter(Boolean)
    .filter((query, index, list) => list.indexOf(query) === index);
}

export function metadataFromItunesResult(result = {}) {
  const artist = clean(result.artistName);
  return {
    id: String(result.trackId || ""),
    title: clean(result.trackName),
    artist,
    album: clean(result.collectionName),
    albumArtist: clean(result.collectionArtistName) || artist,
    year: releaseYear(result.releaseDate),
    genre: clean(result.primaryGenreName),
    track: result.trackNumber ? String(result.trackNumber) : "",
    disc: result.discNumber ? String(result.discNumber) : "",
    durationSec: durationSec(result.trackTimeMillis),
    artworkUrl: clean(result.artworkUrl100),
  };
}

export function scoreItunesCandidate(candidate = {}, job = {}) {
  const titleScore = tokenOverlap(job.title, candidate.title);
  const artistScore = tokenOverlap(job.artist, candidate.artist);
  let durationScore = 0.5;
  if (Number.isFinite(job.durationSec) && job.durationSec > 0 && Number.isFinite(candidate.durationSec)) {
    const delta = Math.abs(candidate.durationSec - job.durationSec);
    durationScore = delta <= 3 ? 1 : Math.max(0, 1 - (delta - 3) / 40);
  }
  const score = Math.round((titleScore * 0.65 + artistScore * 0.2 + durationScore * 0.15) * 100);
  return { score, titleScore, artistScore, durationScore };
}

export function rankItunesResults(results = [], job = {}) {
  return (Array.isArray(results) ? results : [])
    .map((result) => {
      const metadata = metadataFromItunesResult(result);
      const scores = scoreItunesCandidate(metadata, job);
      return {
        ...metadata,
        ...scores,
        source: "itunes",
      };
    })
    .filter((candidate) => candidate.title || candidate.artist || candidate.album)
    .sort((a, b) => b.score - a.score);
}

export async function searchItunes(job, {
  fetchImpl = fetch,
  baseUrl = ITUNES_SEARCH_URL,
  limit = 5,
  country = "US",
} = {}) {
  const queries = uniqueQueries(job);
  if (!queries.length) return { query: "", candidates: [], error: "No searchable title or artist." };

  let lastError = "";
  for (const query of queries) {
    const url = new URL(baseUrl);
    url.searchParams.set("term", query);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("country", country);

    try {
      const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`iTunes Search returned ${response.status}`);
      const data = await response.json();
      const candidates = rankItunesResults(data.results || [], job);
      if (candidates.length || query === queries.at(-1)) {
        return { query, candidates };
      }
    } catch (error) {
      lastError = error.message;
    }
  }

  return { query: queries.at(-1) || "", candidates: [], error: lastError };
}
