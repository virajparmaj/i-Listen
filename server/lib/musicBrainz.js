const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const USER_AGENT = "iListen/1.0 (local metadata cleanup; https://github.com/local/ilisten)";

let lastRequestAt = 0;

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

function artistCreditName(credit = []) {
  if (!Array.isArray(credit)) return "";
  return credit
    .map((item) => clean(item?.name || item?.artist?.name || ""))
    .filter(Boolean)
    .join("");
}

function releaseYear(date) {
  const match = String(date || "").match(/^(\d{4})/);
  return match ? match[1] : "";
}

function firstRelease(recording = {}) {
  const releases = Array.isArray(recording.releases) ? recording.releases : [];
  return releases.find((release) => release?.title) || releases[0] || {};
}

function firstMediumTrack(release = {}, recordingId = "") {
  const media = Array.isArray(release.media) ? release.media : [];
  for (const medium of media) {
    const tracks = Array.isArray(medium.tracks) ? medium.tracks : [];
    const track = tracks.find((item) => item?.recording?.id === recordingId) || tracks[0];
    if (track) return { medium, track };
  }
  return { medium: {}, track: {} };
}

export function buildMusicBrainzQuery(job = {}) {
  const title = clean(job.title);
  const artist = clean(job.artist);
  const parts = [];
  if (title) parts.push(`recording:"${title.replace(/"/g, "")}"`);
  if (artist && !/^unknown artist$/i.test(artist)) parts.push(`artist:"${artist.replace(/"/g, "")}"`);
  return parts.join(" AND ") || title || artist;
}

export function metadataFromRecording(recording = {}) {
  const release = firstRelease(recording);
  const { medium, track } = firstMediumTrack(release, recording.id);
  const artist = artistCreditName(recording["artist-credit"]) || artistCreditName(release["artist-credit"]);
  const albumArtist = artistCreditName(release["artist-credit"]) || artist;

  return {
    id: recording.id || "",
    title: clean(recording.title),
    artist,
    album: clean(release.title),
    albumArtist,
    year: releaseYear(release.date || recording["first-release-date"]),
    track: clean(track.number || track.position || ""),
    disc: clean(medium.position || ""),
    durationSec: Number.isFinite(recording.length) ? Math.round(recording.length / 1000) : null,
  };
}

export function scoreMusicBrainzCandidate(candidate = {}, job = {}) {
  const titleScore = tokenOverlap(job.title, candidate.title);
  const artistScore = tokenOverlap(job.artist, candidate.artist);
  let durationScore = 0.5;
  if (Number.isFinite(job.durationSec) && job.durationSec > 0 && Number.isFinite(candidate.durationSec)) {
    const delta = Math.abs(candidate.durationSec - job.durationSec);
    durationScore = delta <= 2 ? 1 : Math.max(0, 1 - (delta - 2) / 30);
  }
  return Math.round((titleScore * 0.45 + artistScore * 0.35 + durationScore * 0.2) * 100);
}

export function rankMusicBrainzRecordings(recordings = [], job = {}) {
  return (Array.isArray(recordings) ? recordings : [])
    .map((recording) => {
      const metadata = metadataFromRecording(recording);
      return {
        ...metadata,
        source: "musicbrainz",
        score: scoreMusicBrainzCandidate(metadata, job),
      };
    })
    .filter((candidate) => candidate.title || candidate.artist || candidate.album)
    .sort((a, b) => b.score - a.score);
}

async function waitForSlot(delayMs) {
  if (!delayMs) return;
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < delayMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs - elapsed));
  }
  lastRequestAt = Date.now();
}

export async function searchMusicBrainz(job, {
  fetchImpl = fetch,
  baseUrl = MUSICBRAINZ_BASE_URL,
  limit = 5,
  delayMs = 1000,
} = {}) {
  const query = buildMusicBrainzQuery(job);
  if (!query) return { query, candidates: [], error: "No searchable title or artist." };

  await waitForSlot(delayMs);
  const url = new URL(`${baseUrl}/recording`);
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", String(limit));

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) throw new Error(`MusicBrainz returned ${response.status}`);
    const data = await response.json();
    return {
      query,
      candidates: rankMusicBrainzRecordings(data.recordings || [], job),
    };
  } catch (error) {
    return { query, candidates: [], error: error.message };
  }
}
