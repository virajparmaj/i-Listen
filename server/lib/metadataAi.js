import { inferTrackMetadata, customPlaylists } from "./metadata.js";
import { probeMedia, runProcess } from "./converter.js";
import { searchMusicBrainz } from "./musicBrainz.js";
import { lookupAcoustId } from "./acoustid.js";
import { searchItunes } from "./itunes.js";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_METADATA_MODEL = "qwen:1.8b";
export const DEFAULT_METADATA_TIMEOUT_MS = 45000;
export const DEFAULT_METADATA_PREFLIGHT_TIMEOUT_MS = 5000;
export const METADATA_TIMEOUT_ERROR_MESSAGE = "Local metadata model timed out. Try qwen:1.8b or restart Ollama.";
export const METADATA_MODEL_MISSING_ERROR_CODE = "ILISTEN_METADATA_MODEL_MISSING";

export const METADATA_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    artist: { type: "string" },
    album: { type: "string" },
    albumArtist: { type: "string" },
    year: { type: "string" },
    genre: { type: "string" },
    track: { type: "string" },
    disc: { type: "string" },
    composer: { type: "string" },
    comment: { type: "string" },
    playlists: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    sources: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "artist",
    "album",
    "albumArtist",
    "year",
    "genre",
    "track",
    "disc",
    "composer",
    "comment",
    "playlists",
    "confidence",
    "sources",
  ],
};

const TEXT_FIELDS = ["title", "artist", "album", "albumArtist", "genre", "composer"];
const METADATA_FIELDS = ["title", "artist", "album", "albumArtist", "year", "genre", "track", "disc", "composer", "comment", "playlists"];
const YOUTUBE_ALBUM_RE = /^(youtube imports?|youtube converts?|imported links?)$/i;
const PLACEHOLDER_ALBUM_RE = /^(youtube imports?|youtube converts?|imported links?|imports?|converts?|links?)$/i;
const SYNTHETIC_SINGLE_ALBUM_RE = /^(19\d{2}|20\d{2})\s*-\s*singles?$/i;
const STRONG_EVIDENCE_MIN_SCORE = 90;
const MIN_MODEL_CONFIDENCE = 0.65;
const TRUSTED_EXAMPLE_SOURCES = new Set(["manual_edit"]);
const CHANNEL_ARTIST_RE = /(^@|t-?\s*series|think music|records?|official|vevo|topic|channel|music india|label)/i;
const NOISE_WORDS = [
  "official music video",
  "official lyric video",
  "official video",
  "official audio",
  "lyric video",
  "visualizer",
  "music video",
  "lyrics",
  "audio",
  "hd",
  "4k",
];

function cleanBase(value) {
  return String(value || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export function ollamaUrlFromEnv(env = process.env) {
  return env.ILISTEN_OLLAMA_URL || DEFAULT_OLLAMA_URL;
}

export function metadataModelFromEnv(env = process.env) {
  return env.ILISTEN_METADATA_MODEL || DEFAULT_METADATA_MODEL;
}

export function metadataTimeoutMsFromEnv(env = process.env) {
  return positiveInteger(env.ILISTEN_METADATA_TIMEOUT_MS, DEFAULT_METADATA_TIMEOUT_MS);
}

export function missingMetadataModelMessage(model = metadataModelFromEnv()) {
  return `Local metadata model ${model} is not installed. Run: ollama pull ${model}`;
}

function missingMetadataModelError(model) {
  const error = new Error(missingMetadataModelMessage(model));
  error.code = METADATA_MODEL_MISSING_ERROR_CODE;
  return error;
}

export function isMissingMetadataModelError(error) {
  return error?.code === METADATA_MODEL_MISSING_ERROR_CODE
    || /^Local metadata model .+ is not installed\. Run: ollama pull .+$/i.test(String(error?.message || ""));
}

function compactString(value, maxLength = 220) {
  const text = cleanBase(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function compactObject(object = {}, fields = [], { maxLength = 220, dropEmpty = true } = {}) {
  const compact = {};
  for (const field of fields) {
    const value = object?.[field];
    if (Array.isArray(value)) {
      const items = value.map((item) => compactString(item, 80)).filter(Boolean);
      if (items.length || !dropEmpty) compact[field] = items;
      continue;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value) || !dropEmpty) compact[field] = value;
      continue;
    }
    const text = compactString(value, maxLength);
    if (text || !dropEmpty) compact[field] = text;
  }
  return compact;
}

function compactMetadata(value = {}) {
  return compactObject(value, METADATA_FIELDS, { maxLength: 180 });
}

function compactTags(value = {}) {
  if (value?.error) return { error: compactString(value.error) };
  return compactObject(value, ["title", "artist", "album", "albumArtist", "year", "genre", "track", "disc", "composer", "comment"], { maxLength: 180 });
}

function compactYoutubeInfo(info = null, job = {}) {
  if (!info) return null;
  return compactObject({
    title: info.title || "",
    uploader: info.uploader || "",
    channel: info.channel || "",
    artist: info.artist || info.creator || "",
    album: info.album || "",
    track: info.track || info.alt_title || "",
    durationSec: info.duration || job.durationSec || null,
    releaseDate: info.release_date || info.release_year || "",
    uploadDate: info.upload_date || "",
  }, ["title", "uploader", "channel", "artist", "album", "track", "durationSec", "releaseDate", "uploadDate"], { maxLength: 180 });
}

function compactCandidate(candidate = {}) {
  return compactObject(candidate, ["source", "score", "titleScore", "artistScore", "durationScore", "id", "title", "artist", "album", "albumArtist", "year", "genre", "track", "disc", "durationSec"], { maxLength: 180 });
}

function compactEvidenceForExample(evidence = {}) {
  const compact = compactMetadataContext(evidence);
  return { ...compact, correctionExamples: [] };
}

function compactExampleInput(input = {}) {
  if (input?.evidence) {
    return {
      before: compactMetadata(input.before || {}),
      evidence: compactEvidenceForExample(input.evidence),
      sources: sourceList(input.sources || []),
    };
  }
  if (input?.before) return { before: compactMetadata(input.before) };
  return compactMetadata(input);
}

function compactExamples(examples = []) {
  return (Array.isArray(examples) ? examples : []).slice(0, 5).map((example) => ({
    source: compactString(example?.source, 80),
    input: compactExampleInput(example?.input || {}),
    output: compactMetadata(example?.output || {}),
    createdAt: compactString(example?.createdAt, 40),
  }));
}

export function compactMetadataContext(context = {}) {
  return {
    currentMetadata: compactMetadata(context.currentMetadata || context.job || {}),
    currentEmbeddedTags: compactTags(context.currentEmbeddedTags || context.currentTags || {}),
    youtube: compactYoutubeInfo(context.youtubeInfo, context.currentMetadata || context.job || {}),
    youtubeError: compactString(context.youtubeError || ""),
    youtubeInferredMetadata: compactMetadata(context.youtubeInferredMetadata || context.youtubeInferred || {}),
    musicBrainzQuery: compactString(context.musicBrainzQuery || "", 260),
    musicBrainzCandidates: (Array.isArray(context.musicBrainzCandidates) ? context.musicBrainzCandidates : []).slice(0, 3).map(compactCandidate),
    musicBrainzError: compactString(context.musicBrainzError || ""),
    itunesQuery: compactString(context.itunesQuery || "", 260),
    itunesCandidates: (Array.isArray(context.itunesCandidates) ? context.itunesCandidates : []).slice(0, 3).map(compactCandidate),
    itunesError: compactString(context.itunesError || ""),
    acoustidCandidates: (Array.isArray(context.acoustidCandidates) ? context.acoustidCandidates : []).slice(0, 3).map(compactCandidate),
    acoustidError: compactString(context.acoustidError || ""),
    correctionExamples: compactExamples(context.correctionExamples || context.examples || []),
  };
}

function stripNoise(value) {
  let text = cleanBase(value);
  for (const word of NOISE_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text
      .replace(new RegExp(`\\s*[([{]\\s*${escaped}\\s*[)\\]}]`, "ig"), "")
      .replace(new RegExp(`\\s+-\\s+${escaped}$`, "ig"), "")
      .replace(new RegExp(`\\s+${escaped}$`, "ig"), "");
  }
  return text
    .replace(/\s*-\s*topic$/i, "")
    .replace(/\s*vevo$/i, "")
    .replace(/\s+official$/i, "")
    .replace(/\byoutube(?: music)?\b/ig, "")
    .replace(/\s+\|\s+.*/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function stripLeadingTitleDescriptors(value) {
  return stripNoise(value)
    .replace(/^(lyrical|lyric|full song|full video|video|audio)\s*:\s*/i, "")
    .trim();
}

function cleanMetadataField(field, value) {
  const text = stripNoise(value);
  if (field === "title") {
    return text.replace(/\s*\(\s*from\s+["'][^)]+["']\s*\)\s*$/i, "").trim();
  }
  return text;
}

function cleanCatalogSearchQuery(value) {
  let text = cleanBase(value);
  for (const word of NOISE_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "ig"), " ");
  }
  return text
    .replace(/[@#]/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[|:;,/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLookupArtist(value) {
  const artist = stripNoise(value).replace(/^@+/, "").trim();
  if (!artist || CHANNEL_ARTIST_RE.test(artist)) return "";
  return artist;
}

function catalogLookupJob(job = {}, youtubeInfo = null, youtubeInferred = null) {
  const inferredTitle = stripLeadingTitleDescriptors(youtubeInferred?.title || "");
  const rawTitle = stripLeadingTitleDescriptors(youtubeInfo?.title || "");
  const title = inferredTitle || rawTitle || stripLeadingTitleDescriptors(job.title);
  const artist = cleanLookupArtist(youtubeInferred?.artist) || cleanLookupArtist(job.artist);
  const searchQuery = youtubeInfo?.title ? cleanCatalogSearchQuery(youtubeInfo.title) : "";
  const firstTitleSegment = youtubeInfo?.title ? cleanCatalogSearchQuery(String(youtubeInfo.title).split(/\s+\|\s+/)[0]) : "";
  const titleArtistQuery = [title, artist].filter(Boolean).join(" ");
  return {
    ...job,
    title: title || job.title,
    artist,
    durationSec: Number.isFinite(youtubeInfo?.duration) ? youtubeInfo.duration : job.durationSec,
    searchQuery,
    fallbackQueries: [titleArtistQuery, firstTitleSegment].filter(Boolean),
  };
}

function fallbackText(job, key) {
  const raw = cleanBase(job?.[key]);
  const value = stripNoise(raw);
  if (key === "album" && (!value || PLACEHOLDER_ALBUM_RE.test(raw) || PLACEHOLDER_ALBUM_RE.test(value))) return "Unknown Album";
  if ((key === "artist" || key === "albumArtist") && (!value || /^unknown artist$/i.test(value))) return "Unknown Artist";
  if (key === "title" && (!value || /^youtube link/i.test(raw) || /^imported link/i.test(raw) || /^link \d+$/i.test(value))) return "Untitled";
  return value;
}

function cleanYear(value, fallback = "") {
  const match = String(value || "").match(/\b(19\d{2}|20\d{2})\b/);
  if (match) return match[1];
  const fallbackMatch = String(fallback || "").match(/\b(19\d{2}|20\d{2})\b/);
  return fallbackMatch ? fallbackMatch[1] : "";
}

function cleanNumber(value, fallback = "") {
  const text = cleanBase(value);
  const match = text.match(/^\d{1,3}(?:\/\d{1,3})?$/);
  if (match) return text;
  const fallbackTextValue = cleanBase(fallback);
  return /^\d{1,3}(?:\/\d{1,3})?$/.test(fallbackTextValue) ? fallbackTextValue : "";
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function sourceList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanBase(item)).filter(Boolean))].slice(0, 8);
}

function tokenSet(value) {
  return new Set(cleanBase(value)
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1));
}

function metadataTokens(metadata = {}) {
  return tokenSet([metadata.title, metadata.artist, metadata.album, metadata.albumArtist].filter(Boolean).join(" "));
}

function exampleTokens(example = {}) {
  const input = example.input || {};
  const values = [
    input.before,
    input.currentMetadata,
    input.evidence?.currentMetadata,
    input.evidence?.youtubeInferredMetadata,
    example.output,
  ].filter(Boolean);
  return tokenSet(values.map((value) => {
    if (typeof value === "string") return value;
    return [value.title, value.artist, value.album, value.albumArtist].filter(Boolean).join(" ");
  }).join(" "));
}

function overlapScore(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared;
}

export function selectRelevantMetadataExamples(job = {}, examples = [], limit = 5) {
  const jobTokens = metadataTokens(job);
  return (Array.isArray(examples) ? examples : [])
    .filter((example) => TRUSTED_EXAMPLE_SOURCES.has(example?.source))
    .map((example, index) => ({
      example,
      index,
      score: overlapScore(jobTokens, exampleTokens(example)),
      time: Date.parse(example?.createdAt || "") || 0,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.time - a.time || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.example);
}

function metadataSnapshot(job = {}) {
  return Object.fromEntries(METADATA_FIELDS.map((field) => [field, field === "playlists" ? customPlaylists(job.playlists || []) : job[field] || ""]));
}

function readTag(tags, name) {
  if (!tags) return "";
  const key = Object.keys(tags).find((tag) => tag.toLowerCase() === name);
  return key ? cleanBase(tags[key]) : "";
}

async function readCurrentTags(job, tools) {
  if (!job?.outputPath || !tools?.ffprobe?.ok) return {};
  try {
    const probe = await probeMedia(tools.ffprobe.path, job.outputPath);
    const tags = probe.format?.tags || {};
    return {
      title: readTag(tags, "title"),
      artist: readTag(tags, "artist"),
      album: readTag(tags, "album"),
      albumArtist: readTag(tags, "album_artist") || readTag(tags, "albumartist"),
      year: readTag(tags, "date"),
      genre: readTag(tags, "genre"),
      track: readTag(tags, "track"),
      disc: readTag(tags, "disc"),
      composer: readTag(tags, "composer"),
      comment: readTag(tags, "comment"),
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function readYoutubeInfo(job, tools, run = runProcess) {
  if (!job?.url || !tools?.ytdlp?.ok) return { info: null, error: "yt-dlp is unavailable." };
  try {
    const { stdout } = await run(tools.ytdlp.path, [
      "--dump-single-json",
      "--no-playlist",
      "--no-warnings",
      job.url,
    ]);
    return { info: JSON.parse(stdout || "{}"), error: "" };
  } catch (error) {
    return { info: null, error: error.message };
  }
}

function candidateToRaw(candidate, confidence = 0.35) {
  if (!candidate) return null;
  return {
    title: candidate.title || "",
    artist: candidate.artist || "",
    album: candidate.album || "",
    albumArtist: candidate.albumArtist || candidate.artist || "",
    year: candidate.year || "",
    genre: candidate.genre || "",
    track: candidate.track || "",
    disc: candidate.disc || "",
    composer: "",
    comment: "",
    playlists: [],
    confidence: Number.isFinite(candidate.score) ? candidate.score / 100 : confidence,
    sources: [candidate.source || "candidate"],
  };
}

function fallbackRaw(context, job) {
  const candidate = bestEvidenceCandidate(context);
  if (candidate) return candidateToRaw(candidate, 0.55);
  const youtubeInferred = context.youtubeInferredMetadata || context.youtubeInferred;
  if (youtubeInferred) return { ...youtubeInferred, confidence: 0.3, sources: ["youtube-inference"] };
  return { ...metadataSnapshot(job), confidence: 0.2, sources: ["current-metadata"] };
}

export function sanitizeMetadataProposal(raw = {}, job = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const metadata = metadataSnapshot(job);

  for (const field of TEXT_FIELDS) {
    const cleaned = cleanMetadataField(field, source[field]);
    metadata[field] = cleaned || (field === "composer" ? "" : fallbackText(job, field));
  }

  if (!metadata.album || PLACEHOLDER_ALBUM_RE.test(source.album) || PLACEHOLDER_ALBUM_RE.test(metadata.album) || YOUTUBE_ALBUM_RE.test(metadata.album) || SYNTHETIC_SINGLE_ALBUM_RE.test(metadata.album)) {
    metadata.album = fallbackText(job, "album");
  }
  if (!metadata.albumArtist || /^unknown artist$/i.test(metadata.albumArtist)) metadata.albumArtist = metadata.artist || fallbackText(job, "albumArtist");

  metadata.year = cleanYear(source.year, job.year);
  metadata.track = cleanNumber(source.track, job.track) || "1";
  metadata.disc = cleanNumber(source.disc, job.disc);
  metadata.comment = cleanBase(source.comment || job.comment || "");
  metadata.playlists = customPlaylists(job.playlists || []);

  if (!metadata.title) metadata.title = "Untitled";
  if (!metadata.artist) metadata.artist = "Unknown Artist";
  if (!metadata.album) metadata.album = "Unknown Album";
  if (!metadata.albumArtist) metadata.albumArtist = metadata.artist;

  return {
    metadata,
    confidence: clampConfidence(source.confidence),
    sources: sourceList(source.sources),
  };
}

function evidenceCandidates(context = {}) {
  return [
    ...(Array.isArray(context.acoustidCandidates) ? context.acoustidCandidates : []),
    ...(Array.isArray(context.itunesCandidates) ? context.itunesCandidates : []),
    ...(Array.isArray(context.musicBrainzCandidates) ? context.musicBrainzCandidates : []),
  ].filter((candidate) => candidate?.album || candidate?.title || candidate?.artist)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function bestEvidenceCandidate(context = {}) {
  return evidenceCandidates(context)[0] || null;
}

function isStrongEvidenceCandidate(candidate = {}) {
  if (!candidate) return null;
  if (!cleanBase(candidate.title) || !cleanBase(candidate.artist) || !cleanBase(candidate.album)) return null;
  if (PLACEHOLDER_ALBUM_RE.test(candidate.album) || YOUTUBE_ALBUM_RE.test(candidate.album) || SYNTHETIC_SINGLE_ALBUM_RE.test(candidate.album)) return null;
  const score = Number(candidate.score || 0);
  const titleScore = Number(candidate.titleScore || 0);
  const durationScore = Number(candidate.durationScore || 0);
  const titleAndDurationMatch = titleScore >= 0.95 && durationScore >= 0.7 && score >= 75;
  if (score < STRONG_EVIDENCE_MIN_SCORE && !titleAndDurationMatch) return null;
  return candidate;
}

function strongEvidenceCandidate(context = {}) {
  return evidenceCandidates(context).find((candidate) => isStrongEvidenceCandidate(candidate)) || null;
}

function applyEvidenceGuards(metadata, raw = {}, job = {}, context = {}) {
  const guarded = { ...metadata };
  const candidate = bestEvidenceCandidate(context);
  const albumLooksWeak = !guarded.album
    || /^unknown album$/i.test(guarded.album)
    || PLACEHOLDER_ALBUM_RE.test(guarded.album)
    || YOUTUBE_ALBUM_RE.test(guarded.album)
    || SYNTHETIC_SINGLE_ALBUM_RE.test(guarded.album)
    || PLACEHOLDER_ALBUM_RE.test(raw.album)
    || SYNTHETIC_SINGLE_ALBUM_RE.test(raw.album);

  if (albumLooksWeak && candidate?.album && !PLACEHOLDER_ALBUM_RE.test(candidate.album) && !SYNTHETIC_SINGLE_ALBUM_RE.test(candidate.album)) {
    guarded.album = candidate.album;
    if (candidate.albumArtist && (!guarded.albumArtist || /^unknown artist$/i.test(guarded.albumArtist))) guarded.albumArtist = candidate.albumArtist;
    if (candidate.year && !guarded.year) guarded.year = cleanYear(candidate.year, job.year);
  }

  if (candidate) {
    if (candidate.genre && !guarded.genre) guarded.genre = candidate.genre;
    const trackNumber = Number(String(guarded.track || "").split("/")[0]);
    const trackLooksWeak = !guarded.track || guarded.track === "1" || trackNumber > 99 || cleanBase(guarded.track) === cleanBase(job.track);
    if (candidate.track && trackLooksWeak) guarded.track = cleanNumber(candidate.track, job.track) || guarded.track;
    if (candidate.disc && !guarded.disc) guarded.disc = cleanNumber(candidate.disc, job.disc);
  }

  if (!guarded.album || PLACEHOLDER_ALBUM_RE.test(guarded.album) || YOUTUBE_ALBUM_RE.test(guarded.album) || SYNTHETIC_SINGLE_ALBUM_RE.test(guarded.album)) {
    guarded.album = "Unknown Album";
  }

  return guarded;
}

function tokenOverlapRatio(wanted, found) {
  const left = tokenSet(stripLeadingTitleDescriptors(wanted));
  const right = tokenSet(stripLeadingTitleDescriptors(found));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / left.size;
}

function supportedTitleEvidence(context = {}) {
  return [
    context.youtube?.title,
    context.youtube?.track,
    context.youtubeInferredMetadata?.title,
    ...(Array.isArray(context.musicBrainzCandidates) ? context.musicBrainzCandidates.map((candidate) => candidate.title) : []),
    ...(Array.isArray(context.itunesCandidates) ? context.itunesCandidates.map((candidate) => candidate.title) : []),
    ...(Array.isArray(context.acoustidCandidates) ? context.acoustidCandidates.map((candidate) => candidate.title) : []),
  ].map(stripLeadingTitleDescriptors).filter(Boolean);
}

function titleHasEvidenceSupport(title, context = {}) {
  const evidence = supportedTitleEvidence(context);
  if (!evidence.length) return true;
  return evidence.some((value) => tokenOverlapRatio(title, value) >= 0.6);
}

function albumLooksUnresolved(album) {
  return !cleanBase(album)
    || /^unknown album$/i.test(album)
    || PLACEHOLDER_ALBUM_RE.test(album)
    || YOUTUBE_ALBUM_RE.test(album)
    || SYNTHETIC_SINGLE_ALBUM_RE.test(album);
}

export function metadataApprovalBlocker({ metadata = {}, confidence = 0, context = {} } = {}) {
  if (confidence < MIN_MODEL_CONFIDENCE) {
    return `AI metadata confidence too low (${Math.round(confidence * 100)}%). Review manually.`;
  }
  if (!titleHasEvidenceSupport(metadata.title, context)) {
    return `AI metadata title "${metadata.title || "Untitled"}" does not match the supplied song evidence. Review manually.`;
  }
  if (albumLooksUnresolved(metadata.album)) {
    return "AI metadata could not confirm a real album or single title. Review manually.";
  }
  return "";
}

function systemPrompt() {
  return [
    "You clean music metadata for an iPod/Apple Music library.",
    "Return only JSON matching the schema.",
    "Choose from supplied evidence when possible. Do not invent album/year/track values. If evidence is weak, preserve cleaned current metadata and lower confidence.",
    "Prefer MusicBrainz, Apple/iTunes, and AcoustID candidates when they clearly match.",
    "Remove YouTube wording such as official video, lyrics, visualizer, HD, Topic, and YouTube.",
    "Use normal music-library metadata. Do not invent custom playlists.",
  ].join(" ");
}

function userPrompt(context) {
  return JSON.stringify({
    task: "Choose clean final metadata for this converted song using only this compact evidence.",
    evidence: context,
  });
}

function isAbortError(error) {
  return error?.name === "AbortError"
    || /aborted|aborterror|timed out|timeout/i.test(String(error?.message || ""));
}

export async function callOllamaMetadata(context, {
  model = metadataModelFromEnv(),
  ollamaUrl = ollamaUrlFromEnv(),
  fetchImpl = fetch,
  timeoutMs = metadataTimeoutMsFromEnv(),
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL("/api/chat", ollamaUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: METADATA_RESPONSE_SCHEMA,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(context) },
        ],
        options: { temperature: 0.1 },
      }),
    });
    if (!response.ok) {
      if (response.status === 404) throw missingMetadataModelError(model);
      throw new Error(`Ollama returned ${response.status}`);
    }
    const data = await response.json();
    return data?.message?.content || data?.response || "";
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) throw new Error(METADATA_TIMEOUT_ERROR_MESSAGE);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkOllamaMetadataHealth({
  model = metadataModelFromEnv(),
  ollamaUrl = ollamaUrlFromEnv(),
  fetchImpl = fetch,
  timeoutMs = DEFAULT_METADATA_PREFLIGHT_TIMEOUT_MS,
} = {}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL("/api/generate", ollamaUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: "Reply OK.",
        stream: false,
        options: { temperature: 0, num_predict: 2 },
      }),
    });
    const elapsedMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        ok: false,
        model,
        error: response.status === 404 ? missingMetadataModelMessage(model) : `Ollama returned ${response.status}`,
        timeoutMs,
        elapsedMs,
      };
    }
    return { ok: true, model, error: "", timeoutMs, elapsedMs };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = controller.signal.aborted || isAbortError(error)
      ? METADATA_TIMEOUT_ERROR_MESSAGE
      : error.message;
    return { ok: false, model, error: message, timeoutMs, elapsedMs };
  } finally {
    clearTimeout(timer);
  }
}

export async function buildMetadataContext(job, {
  tools = {},
  examples = [],
  search = searchMusicBrainz,
  itunes = searchItunes,
  acoustid = lookupAcoustId,
  run = runProcess,
} = {}) {
  const currentTags = await readCurrentTags(job, tools);
  const youtube = await readYoutubeInfo(job, tools, run);
  const youtubeInferred = youtube.info ? inferTrackMetadata(youtube.info, job) : null;
  const lookupJob = catalogLookupJob(job, youtube.info, youtubeInferred);
  const musicBrainz = await search(lookupJob, { delayMs: 1000, limit: 3 });
  const itunesResult = await itunes(lookupJob, { limit: 3 });
  const acoustidResult = await acoustid(job, {
    fpcalcPath: tools.fpcalc?.ok ? tools.fpcalc.path : "",
  });

  return compactMetadataContext({
    currentMetadata: metadataSnapshot(job),
    currentEmbeddedTags: currentTags,
    youtubeInfo: youtube.info,
    youtubeError: youtube.error || "",
    youtubeInferredMetadata: youtubeInferred,
    musicBrainzQuery: musicBrainz.query || "",
    musicBrainzCandidates: musicBrainz.candidates || [],
    musicBrainzError: musicBrainz.error || "",
    itunesQuery: itunesResult.query || "",
    itunesCandidates: itunesResult.candidates || [],
    itunesError: itunesResult.error || "",
    acoustidCandidates: acoustidResult.candidates || [],
    acoustidError: acoustidResult.error || "",
    correctionExamples: examples,
  });
}

export async function proposeAiMetadata(job, {
  tools = {},
  examples = [],
  model = metadataModelFromEnv(),
  ollamaUrl = ollamaUrlFromEnv(),
  timeoutMs = metadataTimeoutMsFromEnv(),
  fetchImpl = fetch,
  contextBuilder = buildMetadataContext,
} = {}) {
  const selectedExamples = selectRelevantMetadataExamples(job, examples, 5);
  const context = await contextBuilder(job, { tools, examples: selectedExamples });
  let raw;
  let usedFallback = false;
  let parseError = "";

  const strongCandidate = strongEvidenceCandidate(context);
  if (strongCandidate) {
    raw = {
      ...candidateToRaw(strongCandidate, 0.9),
      playlists: customPlaylists(job.playlists || []),
      sources: [strongCandidate.source || "candidate", "evidence-shortcut"],
    };
    const sanitized = sanitizeMetadataProposal(raw, job);
    sanitized.metadata = applyEvidenceGuards(sanitized.metadata, raw, job, context);
    const blocker = metadataApprovalBlocker({ metadata: sanitized.metadata, confidence: sanitized.confidence, context });
    if (blocker) throw new Error(blocker);
    return {
      metadata: sanitized.metadata,
      confidence: sanitized.confidence,
      sources: sanitized.sources,
      model: "evidence-only",
      usedFallback: false,
      parseError: "",
      raw,
      context,
    };
  }

  let content = "";
  try {
    content = await callOllamaMetadata(context, { model, ollamaUrl, fetchImpl, timeoutMs });
  } catch (error) {
    if (error.message === METADATA_TIMEOUT_ERROR_MESSAGE || isMissingMetadataModelError(error)) throw error;
    throw new Error(`Ollama metadata model unavailable: ${error.message}`);
  }

  try {
    raw = JSON.parse(content);
  } catch (error) {
    raw = fallbackRaw(context, job);
    usedFallback = true;
    parseError = error.message;
  }

  const sanitized = sanitizeMetadataProposal(raw, job);
  sanitized.metadata = applyEvidenceGuards(sanitized.metadata, raw, job, context);
  const sources = sanitized.sources.length ? sanitized.sources : sourceList(raw.sources || [usedFallback ? "fallback" : "ollama"]);
  const blocker = metadataApprovalBlocker({ metadata: sanitized.metadata, confidence: sanitized.confidence, context });
  if (blocker) throw new Error(blocker);

  return {
    metadata: sanitized.metadata,
    confidence: sanitized.confidence,
    sources,
    model,
    usedFallback,
    parseError,
    raw,
    context,
  };
}
