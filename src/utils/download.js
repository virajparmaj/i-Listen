// Real client-side report exports. Audio conversion and playlist writing happen
// through the localhost helper when it is connected.

function triggerDownload(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvField = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(tracks) {
  const cols = ["Track", "Title", "Artist", "Album", "Playlists", "Year", "Genre", "Source URL", "Output", "Encoder", "Size", "Duration", "Status", "Note"];
  const rows = tracks.map((t) => [
    t.track,
    t.title,
    t.artist,
    t.album,
    (t.playlists || []).join("; "),
    t.year,
    t.genre,
    t.url,
    t.qualityLabel || t.format.toUpperCase(),
    t.encoder || "",
    t.size,
    t.duration,
    t.status,
    t.status === "queued" ? "Waiting for local helper conversion." : "",
  ]);
  const csv = [cols, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
  triggerDownload("ilisten-report.csv", csv, "text/csv");
}

export function exportLogs(logs) {
  const text = logs.map((l) => `${l.t} ${l.label ? l.label + " " : ""}${l.msg}`).join("\n");
  triggerDownload("ilisten-logs.txt", text);
}

export function exportLibraryManifest(tracks, pattern = "track-song", options = {}) {
  triggerDownload("ilisten-library-manifest.txt", buildLibraryManifest(tracks, pattern, options));
}

export function exportBackendManifest(tracks, pattern = "track-song", options = {}) {
  triggerDownload("ilisten-conversion-plan.txt", buildBackendManifest(tracks, pattern, options));
}

const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizePathSegment(value, fallback = "Untitled") {
  const cleaned = String(value ?? "")
    .replace(FORBIDDEN_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[-. ]+$/g, "");

  if (!cleaned || RESERVED_WINDOWS_NAMES.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

function extensionFor(t) {
  if (t.ext) return t.ext;
  if (t.format === "aac") return "m4a";
  if (t.format === "archive") return "flac";
  return "mp3";
}

function rawFilenameFor(t, pattern) {
  const ext = extensionFor(t);
  const tn = String(t.track || "1").padStart(2, "0");
  switch (pattern) {
    case "artist-song": return `${t.artist} - ${t.title}.${ext}`;
    case "artist-track-song": return `${t.artist} - ${tn} - ${t.title}.${ext}`;
    case "year-artist-song": return `${t.year} - ${t.artist} - ${t.title}.${ext}`;
    case "track-song":
    default: return `${tn} - ${t.title}.${ext}`;
  }
}

function uniquePath(path, seen, avoidOverwrite) {
  if (!avoidOverwrite) {
    seen.add(path.toLowerCase());
    return path;
  }

  const normalized = path.toLowerCase();
  if (!seen.has(normalized)) {
    seen.add(normalized);
    return path;
  }

  const dot = path.lastIndexOf(".");
  const stem = dot > -1 ? path.slice(0, dot) : path;
  const ext = dot > -1 ? path.slice(dot) : "";
  let i = 2;
  let candidate = `${stem} (${i})${ext}`;
  while (seen.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${stem} (${i})${ext}`;
  }
  seen.add(candidate.toLowerCase());
  return candidate;
}

export function filenameFor(t, pattern, options = {}) {
  const raw = rawFilenameFor(t, pattern);
  if (options.safe === false) return raw;

  const dot = raw.lastIndexOf(".");
  const stem = dot > -1 ? raw.slice(0, dot) : raw;
  const ext = dot > -1 ? raw.slice(dot + 1) : extensionFor(t);
  return `${sanitizePathSegment(stem)}.${sanitizePathSegment(ext, "mp3").toLowerCase()}`;
}

export function libraryEntries(tracks, pattern = "track-song", options = {}) {
  const done = tracks.filter((t) => t.status === "complete");
  const seen = new Set();
  return done.map((t) => {
    const artist = sanitizePathSegment(t.artist, "Unknown Artist");
    const album = sanitizePathSegment(t.album, "Untitled Album");
    const filename = filenameFor(t, pattern);
    const path = uniquePath(`Music Library/${artist}/${album}/${filename}`, seen, options.avoidOverwrite !== false);
    return { track: t, artist, album, filename: path.split("/").pop(), path };
  });
}

export function buildBackendManifest(tracks, pattern = "track-song", options = {}) {
  const lines = [
    "iListen Conversion Plan",
    "Use the local helper to download, convert, tag, validate, and export these YouTube links.",
    "Quality note: best available from YouTube cannot restore original studio/master quality.",
    `Queued links: ${tracks.length}`,
    "",
  ];

  if (!tracks.length) {
    lines.push("No queued YouTube links.");
    return lines.join("\n");
  }

  tracks.forEach((track, index) => {
    lines.push(`${index + 1}. ${track.title || `YouTube link ${index + 1}`}`);
    lines.push(`   Source URL: ${track.url || track.videoTitle || "Unknown source"}`);
    lines.push(`   Status: ${track.status}`);
    lines.push(`   Planned output: ${track.qualityLabel || track.format?.toUpperCase() || "Not selected"}`);
    lines.push(`   Planned filename: ${filenameFor(track, pattern, options)}`);
    if (track.playlists?.length) lines.push(`   Playlists: ${track.playlists.join(", ")}`);
    if (track.outputPath) lines.push(`   Output path: ${track.outputPath}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function buildLibraryManifest(tracks, pattern = "track-song", options = {}) {
  const entries = libraryEntries(tracks, pattern, options);
  const lines = ["Music Library/"];
  const byArtist = {};
  entries.forEach((entry) => {
    byArtist[entry.artist] = byArtist[entry.artist] || {};
    byArtist[entry.artist][entry.album] = byArtist[entry.artist][entry.album] || [];
    byArtist[entry.artist][entry.album].push(entry);
  });

  Object.entries(byArtist).forEach(([artist, albums]) => {
    lines.push(`  ${artist}/`);
    Object.entries(albums).forEach(([album, items]) => {
      lines.push(`    ${album}/`);
      items.forEach((entry) => lines.push(`      ${entry.filename}`));
    });
  });

  return lines.join("\n");
}
