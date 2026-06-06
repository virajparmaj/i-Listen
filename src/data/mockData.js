// iListen — mock data, presets, options, and status metadata.

export const PRESETS = [
  { id: "balanced", name: "iPod Balanced", spec: "MP3 VBR · highest quality", tag: "Recommended", kbps: 245, ext: "mp3" },
  { id: "max", name: "Maximum MP3", spec: "320 kbps CBR · largest size", tag: null, kbps: 320, ext: "mp3" },
  { id: "apple", name: "Apple Native", spec: "AAC 256 kbps M4A · efficient", tag: null, kbps: 256, ext: "m4a" },
  { id: "archive", name: "Archive Mode", spec: "Preserve lossless source", tag: null, kbps: 1000, ext: "flac" },
];

export const FORMAT_OPTIONS = [
  { value: "mp3", label: "MP3" },
  { value: "aac", label: "AAC (M4A)" },
];

export const TAG_VERSIONS = [
  { value: "id3v23", label: "ID3v2.3" },
  { value: "id3v24", label: "ID3v2.4" },
  { value: "id3v1", label: "ID3v1" },
];

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
  downloading: { label: "Downloading source", tone: "info" },
  extracting:  { label: "Extracting audio", tone: "info" },
  converting:  { label: "Converting", tone: "info" },
  metadata:    { label: "Embedding metadata", tone: "info" },
  artwork:     { label: "Embedding artwork", tone: "info" },
  complete:    { label: "Complete", tone: "success" },
  failed:      { label: "Failed", tone: "error" },
  skipped:     { label: "Skipped: already converted", tone: "warning" },
};

export const TERMINAL = ["complete", "failed", "skipped"];
export const IN_FLIGHT = ["downloading", "extracting", "converting", "metadata", "artwork"];

const COVER_COLORS = ["#3E6F9E", "#7AA874", "#C89B3C", "#8FB7D9", "#2C2C2E", "#B75D5D", "#5B8CBE"];

let _id = 0;
export const nextId = () => `trk_${++_id}`;

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function estimateSize(durationSec, kbps) {
  const mb = (durationSec * kbps) / 8 / 1024;
  return `${mb.toFixed(1)} MB`;
}

// Build a queue track from a pasted URL + parsed-ish title.
export function makeTrack({ url, videoTitle, artist, title, album, year, durationSec, fate = "ok", index = 0 }) {
  return {
    id: nextId(),
    url,
    videoTitle,
    thumbColor: COVER_COLORS[index % COVER_COLORS.length],
    // metadata
    title,
    artist,
    album,
    albumArtist: artist,
    year: String(year),
    genre: "Indie",
    track: String(index + 1),
    composer: "",
    producer: "",
    comment: "",
    versionLabel: "",
    durationSec,
    duration: fmtTime(durationSec),
    // output
    format: "mp3",
    preset: "balanced",
    coverArt: null,
    // processing
    progress: 0,
    status: "queued",
    size: estimateSize(durationSec, 245),
    warning: null,
    error: null,
    _fate: fate,
  };
}

// A believable starting library by an artist converting their own catalog.
export const SEED_TRACKS = [
  makeTrack({ url: "https://youtube.com/watch?v=aXr1k09", videoTitle: "Coastlines — Midnight Reel (Official Audio)", artist: "Coastlines", title: "Midnight Reel", album: "2026 - Singles", year: 2026, durationSec: 232, fate: "ok", index: 0 }),
  makeTrack({ url: "https://youtube.com/watch?v=9fbZ02p", videoTitle: "Coastlines - Paper Lanterns [lyric video]", artist: "Coastlines", title: "Paper Lanterns", album: "2026 - Singles", year: 2026, durationSec: 198, fate: "ok", index: 1 }),
  makeTrack({ url: "https://youtube.com/watch?v=k27Lmq3", videoTitle: "Tide Marks — Coastlines (visualizer)", artist: "Coastlines", title: "Tide Marks", album: "Saltwater EP", year: 2025, durationSec: 174, fate: "warn", index: 2 }),
  makeTrack({ url: "https://youtube.com/watch?v=p0Wq8zz", videoTitle: "Coastlines – Slow Harbor", artist: "Coastlines", title: "Slow Harbor", album: "Saltwater EP", year: 2025, durationSec: 251, fate: "fail", index: 3 }),
  makeTrack({ url: "https://youtube.com/watch?v=Lm5vv21", videoTitle: "Old Cassette (demo) - Coastlines", artist: "Coastlines", title: "Old Cassette", album: "Demos", year: 2024, durationSec: 143, fate: "skip", index: 4 }),
];

export const DEFAULT_SETTINGS = {
  parallelJobs: 4,
  defaultFormat: "mp3",
  tagVersion: "id3v23",
  filenamePattern: "track-song",
  skipConverted: true,
  avoidOverwrite: true,
  generateLogs: true,
  resizeArtwork: true,
};
