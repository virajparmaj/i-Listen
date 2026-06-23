// iListen — prototype data, presets, options, and status metadata.

export const OUTPUT_OPTIONS = [
  {
    value: "best-youtube",
    label: "Best available from YouTube",
    shortLabel: "Best available",
    format: "m4a",
    ext: "m4a",
    kbps: null,
    encoder: "Copy AAC when iPod-compatible; otherwise ALAC",
    compatibility: "Avoids unnecessary extra lossy encoding. Cannot restore YouTube compression.",
  },
  {
    value: "ipod-safe-aac",
    label: "Bass-safe AAC-LC 256 kbps M4A",
    shortLabel: "Bass Safe AAC",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "AAC 256 with -4 dB headroom + limiter",
    compatibility: "Adds iPod-friendly headroom for bass-heavy tracks that crackle on older playback chains.",
  },
  {
    value: "bass-safe-plus",
    label: "Bass Safe Plus AAC-LC 256 kbps M4A",
    shortLabel: "Bass Safe Plus",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "loudnorm -18 LUFS + true-peak headroom limiter",
    compatibility: "Bass Safe Plus adds more headroom.",
  },
  {
    value: "left-channel-soften",
    label: "Left Channel Soften AAC-LC 256 kbps M4A",
    shortLabel: "Left Soften",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "left channel softened with right-channel blend + limiter",
    compatibility: "Reduces mild left-only artifacts.",
  },
  {
    value: "stereo-blend-safe",
    label: "Stereo Blend Safe AAC-LC 256 kbps M4A",
    shortLabel: "Stereo Blend",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "stereo channel blend + limiter",
    compatibility: "Stereo Blend reduces left-only artifacts.",
  },
  {
    value: "mono-rescue",
    label: "Mono Rescue AAC-LC 256 kbps M4A",
    shortLabel: "Mono Rescue",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "dual-mono rescue blend + limiter",
    compatibility: "Mono Rescue is last resort.",
  },
  {
    value: "right-channel-rescue",
    label: "Right Channel Rescue AAC-LC 256 kbps M4A",
    shortLabel: "Right Rescue",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "right channel copied to both ears + limiter",
    compatibility: "Use only when the left channel is clearly damaged.",
  },
  {
    value: "alac",
    label: "ALAC preservation M4A",
    shortLabel: "ALAC",
    format: "alac",
    ext: "m4a",
    kbps: null,
    encoder: "ffmpeg -c:a alac",
    compatibility: "Large iPod-compatible preservation file from the YouTube source.",
  },
  {
    value: "mp3-v0",
    label: "MP3 VBR highest",
    shortLabel: "MP3 VBR",
    format: "mp3",
    ext: "mp3",
    kbps: 245,
    encoder: "libmp3lame -q:a 0",
    compatibility: "ID3v2.3-safe MP3 for legacy iPods",
  },
  {
    value: "mp3-256",
    label: "MP3 256 kbps CBR",
    shortLabel: "MP3 256",
    format: "mp3",
    ext: "mp3",
    kbps: 256,
    encoder: "libmp3lame -b:a 256k",
    compatibility: "Predictable-size MP3",
  },
  {
    value: "mp3-320",
    label: "MP3 320 kbps CBR",
    shortLabel: "MP3 320",
    format: "mp3",
    ext: "mp3",
    kbps: 320,
    encoder: "libmp3lame -b:a 320k",
    compatibility: "Maximum MP3 bitrate",
  },
  {
    value: "aac-256",
    label: "AAC-LC 256 kbps M4A",
    shortLabel: "AAC 256",
    format: "aac",
    ext: "m4a",
    kbps: 256,
    encoder: "AAC-LC 256 kbps M4A",
    compatibility: "Apple-native efficient iPod output",
  },
  {
    value: "archive",
    label: "Project source archive",
    shortLabel: "Source archive",
    format: "archive",
    ext: "m4a",
    kbps: null,
    encoder: "Keep downloaded source beside exports",
    compatibility: "Retains the best downloaded YouTube source for reruns.",
  },
];

export const OUTPUT_OPTION_MAP = Object.fromEntries(OUTPUT_OPTIONS.map((o) => [o.value, o]));

export const PRESETS = [
  {
    id: "best",
    name: "Best Available",
    spec: "Copy AAC or preserve as ALAC",
    technical: "No avoidable lossy re-encode",
    tag: "Recommended",
    outputOption: "best-youtube",
  },
  {
    id: "ipodSafe",
    name: "Bass Safe",
    spec: "Headroom for bass hits",
    technical: "AAC 256 + limiter",
    tag: null,
    outputOption: "ipod-safe-aac",
  },
  {
    id: "alac",
    name: "ALAC Preserve",
    spec: "Large M4A preservation output",
    technical: "ffmpeg -c:a alac",
    tag: null,
    outputOption: "alac",
  },
  {
    id: "mp3",
    name: "iPod MP3",
    spec: "MP3 VBR highest quality",
    technical: "libmp3lame -q:a 0",
    tag: null,
    outputOption: "mp3-v0",
  },
  {
    id: "apple",
    name: "Apple Native",
    spec: "AAC-LC 256 kbps M4A",
    technical: "AAC-LC 256 kbps",
    tag: null,
    outputOption: "aac-256",
  },
];

export const PRESET_MAP = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export const TAG_VERSIONS = [
  { value: "id3v23", label: "ID3v2.3" },
  { value: "id3v24", label: "ID3v2.4" },
  { value: "id3v1", label: "ID3v1" },
];

export const TAG_VERSION_MAP = Object.fromEntries(TAG_VERSIONS.map((t) => [t.value, t]));

export const GENRES = [
  "Alternative", "Ambient", "Blues", "Classical", "Electronic", "Folk",
  "Hip-Hop", "Indie", "Jazz", "Pop", "R&B", "Rock", "Soul", "Soundtrack",
];

export const FILENAME_PATTERNS = [
  { value: "artist-song", label: "Artist - Song Title.mp3" },
  { value: "track-song", label: "01 - Song Title.mp3" },
  { value: "artist-track-song", label: "Artist - 01 - Song Title.mp3" },
  { value: "year-artist-song", label: "Year - Artist - Song Title.mp3" },
];

// status -> { label, tone }
export const STATUS = {
  queued:      { label: "Queued", tone: "neutral" },
  analyzing:   { label: "Analyzing YouTube source", tone: "info" },
  downloading: { label: "Downloading source", tone: "info" },
  extracting:  { label: "Extracting audio", tone: "info" },
  converting:  { label: "Converting", tone: "info" },
  metadata:    { label: "Embedding metadata", tone: "info" },
  validating:  { label: "Validating file", tone: "info" },
  artwork:     { label: "Embedding artwork", tone: "info" },
  complete:    { label: "Complete", tone: "success" },
  failed:      { label: "Failed", tone: "error" },
  canceled:    { label: "Canceled", tone: "warning" },
  skipped:     { label: "Skipped: already converted", tone: "warning" },
};

export const TERMINAL = ["complete", "failed", "skipped", "canceled"];
export const IN_FLIGHT = ["analyzing", "downloading", "extracting", "converting", "metadata", "artwork", "validating"];

const COVER_COLORS = ["#3E6F9E", "#7AA874", "#C89B3C", "#8FB7D9", "#2C2C2E", "#B75D5D", "#5B8CBE"];

let _id = 0;
export const nextId = () => `trk_${++_id}`;

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec <= 0) {
    return "Pending";
  }
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function estimateSize(durationSec, kbps) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return "After analysis";
  }
  if (!Number.isFinite(kbps) || kbps <= 0) {
    return "After conversion";
  }
  const mb = (durationSec * kbps) / 8 / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function outputFor(value = "best-youtube") {
  return OUTPUT_OPTION_MAP[value] || OUTPUT_OPTION_MAP["best-youtube"];
}

export function presetFor(id = "best") {
  return PRESET_MAP[id] || PRESET_MAP.best;
}

export function tagVersionLabel(value = "id3v23") {
  return TAG_VERSION_MAP[value]?.label || "ID3v2.3";
}

export function applyOutputFields(track, outputOption = "best-youtube") {
  const option = outputFor(outputOption);
  return {
    ...track,
    outputOption: option.value,
    format: option.format,
    ext: option.ext,
    encoder: option.encoder,
    qualityLabel: option.shortLabel,
    compatibility: option.compatibility,
    size: estimateSize(track.durationSec, option.kbps),
  };
}

// Build a queued import from a pasted URL. Real metadata arrives from the local helper.
export function makeTrack({ url, videoTitle, artist = "Unknown Artist", title, album = "Imported links", year = "", durationSec = null, index = 0 }) {
  return applyOutputFields({
    id: nextId(),
    url,
    videoTitle,
    thumbColor: COVER_COLORS[index % COVER_COLORS.length],
    // metadata
    title: title || `Imported link ${index + 1}`,
    artist,
    album,
    albumArtist: artist,
    year: year ? String(year) : "",
    genre: "",
    track: String(index + 1),
    composer: "",
    producer: "",
    comment: "Source=YouTube; best available from YouTube. This cannot restore YouTube compression.",
    versionLabel: "",
    durationSec,
    duration: fmtTime(durationSec),
    // output
    preset: "best",
    coverArt: null,
    // processing
    progress: 0,
    status: "queued",
    warning: null,
    error: null,
  }, "best-youtube");
}

export const DEFAULT_SETTINGS = {
  parallelJobs: 4,
  defaultOutput: "best-youtube",
  tagVersion: "id3v23",
  filenamePattern: "track-song",
  skipConverted: true,
  avoidOverwrite: true,
  generateLogs: true,
  resizeArtwork: true,
};
