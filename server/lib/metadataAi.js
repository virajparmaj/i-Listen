import { inferTrackMetadata, customPlaylists } from "./metadata.js";
import { probeMedia, runProcess } from "./converter.js";
import { searchMusicBrainz } from "./musicBrainz.js";
import { lookupAcoustId } from "./acoustid.js";

export const DEFAULT_OLLAMA_URL = process.env.ILISTEN_OLLAMA_URL || "http://127.0.0.1:11434";
export const DEFAULT_METADATA_MODEL = process.env.ILISTEN_METADATA_MODEL || "llama3:latest";

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
    genre: "",
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
  const candidate = context.acoustidCandidates?.[0] || context.musicBrainzCandidates?.[0];
  if (candidate) return candidateToRaw(candidate, 0.55);
  if (context.youtubeInferred) return { ...context.youtubeInferred, confidence: 0.3, sources: ["youtube-inference"] };
  return { ...metadataSnapshot(job), confidence: 0.2, sources: ["current-metadata"] };
}

export function sanitizeMetadataProposal(raw = {}, job = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const metadata = metadataSnapshot(job);

  for (const field of TEXT_FIELDS) {
    const cleaned = stripNoise(source[field]);
    metadata[field] = cleaned || fallbackText(job, field);
  }

  if (!metadata.album || PLACEHOLDER_ALBUM_RE.test(source.album) || PLACEHOLDER_ALBUM_RE.test(metadata.album) || YOUTUBE_ALBUM_RE.test(metadata.album)) {
    metadata.album = fallbackText(job, "album");
  }
  if (!metadata.albumArtist || /^unknown artist$/i.test(metadata.albumArtist)) metadata.albumArtist = metadata.artist || fallbackText(job, "albumArtist");

  metadata.year = cleanYear(source.year, job.year);
  metadata.track = cleanNumber(source.track, job.track) || "1";
  metadata.disc = cleanNumber(source.disc, job.disc);
  metadata.comment = cleanBase(source.comment || job.comment || "");
  metadata.playlists = customPlaylists(Array.isArray(source.playlists) ? source.playlists : job.playlists || []);

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

function systemPrompt() {
  return [
    "You clean music metadata for an iPod/Apple Music library.",
    "Return only JSON matching the schema.",
    "Prefer MusicBrainz/AcoustID candidates when they clearly match.",
    "Remove YouTube wording such as official video, lyrics, visualizer, HD, Topic, and YouTube.",
    "Use normal music-library metadata. Do not invent custom playlists.",
  ].join(" ");
}

function userPrompt(context) {
  return JSON.stringify({
    task: "Choose clean final metadata for this converted song.",
    schema: METADATA_RESPONSE_SCHEMA,
    context,
  });
}

export async function callOllamaMetadata(context, {
  model = DEFAULT_METADATA_MODEL,
  ollamaUrl = DEFAULT_OLLAMA_URL,
  fetchImpl = fetch,
  timeoutMs = 120000,
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
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    return data?.message?.content || data?.response || "";
  } finally {
    clearTimeout(timer);
  }
}

export async function buildMetadataContext(job, {
  tools = {},
  examples = [],
  search = searchMusicBrainz,
  acoustid = lookupAcoustId,
  run = runProcess,
} = {}) {
  const currentTags = await readCurrentTags(job, tools);
  const youtube = await readYoutubeInfo(job, tools, run);
  const youtubeInferred = youtube.info ? inferTrackMetadata(youtube.info, job) : null;
  const musicBrainz = await search(job, { delayMs: 1000 });
  const acoustidResult = await acoustid(job, {
    fpcalcPath: tools.fpcalc?.ok ? tools.fpcalc.path : "",
  });

  return {
    job: metadataSnapshot(job),
    currentTags,
    youtubeInfo: youtube.info ? {
      title: youtube.info.title || "",
      artist: youtube.info.artist || youtube.info.creator || youtube.info.uploader || "",
      album: youtube.info.album || "",
      releaseDate: youtube.info.release_date || youtube.info.release_year || youtube.info.upload_date || "",
      durationSec: youtube.info.duration || job.durationSec || null,
    } : null,
    youtubeError: youtube.error || "",
    youtubeInferred,
    musicBrainzQuery: musicBrainz.query || "",
    musicBrainzCandidates: musicBrainz.candidates || [],
    musicBrainzError: musicBrainz.error || "",
    acoustidCandidates: acoustidResult.candidates || [],
    acoustidError: acoustidResult.error || "",
    examples,
  };
}

export async function proposeAiMetadata(job, {
  tools = {},
  examples = [],
  model = DEFAULT_METADATA_MODEL,
  ollamaUrl = DEFAULT_OLLAMA_URL,
  fetchImpl = fetch,
  contextBuilder = buildMetadataContext,
} = {}) {
  const context = await contextBuilder(job, { tools, examples });
  let raw;
  let usedFallback = false;
  let parseError = "";

  let content = "";
  try {
    content = await callOllamaMetadata(context, { model, ollamaUrl, fetchImpl });
  } catch (error) {
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
  const sources = sanitized.sources.length ? sanitized.sources : sourceList(raw.sources || [usedFallback ? "fallback" : "ollama"]);

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
