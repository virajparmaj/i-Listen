// Real client-side file exports (CSV + logs). ZIP/library are mocked
// as a manifest text file since there is no backend yet.

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
  const cols = ["Track", "Title", "Artist", "Album", "Year", "Genre", "Format", "Preset", "Size", "Status"];
  const rows = tracks.map((t) => [t.track, t.title, t.artist, t.album, t.year, t.genre, t.format.toUpperCase(), t.preset, t.size, t.status]);
  const csv = [cols, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
  triggerDownload("ilisten-report.csv", csv, "text/csv");
}

export function exportLogs(logs) {
  const text = logs.map((l) => `${l.t} ${l.label ? l.label + " " : ""}${l.msg}`).join("\n");
  triggerDownload("ilisten-logs.txt", text);
}

export function exportLibraryManifest(tracks, pattern = "track-song") {
  const done = tracks.filter((t) => t.status === "complete");
  const lines = ["Music Library/"];
  const byArtist = {};
  done.forEach((t) => {
    (byArtist[t.artist] = byArtist[t.artist] || []).push(t);
  });
  Object.entries(byArtist).forEach(([artist, items]) => {
    lines.push(`  ${artist}/`);
    const byAlbum = {};
    items.forEach((t) => (byAlbum[t.album] = byAlbum[t.album] || []).push(t));
    Object.entries(byAlbum).forEach(([album, ts]) => {
      lines.push(`    ${album}/`);
      ts.forEach((t) => lines.push(`      ${filenameFor(t, pattern)}`));
    });
  });
  triggerDownload("ilisten-library-manifest.txt", lines.join("\n"));
}

export function filenameFor(t, pattern) {
  const ext = t.format === "aac" ? "m4a" : "mp3";
  const tn = String(t.track).padStart(2, "0");
  switch (pattern) {
    case "artist-song": return `${t.artist} - ${t.title}.${ext}`;
    case "artist-track-song": return `${t.artist} - ${tn} - ${t.title}.${ext}`;
    case "year-artist-song": return `${t.year} - ${t.artist} - ${t.title}.${ext}`;
    case "track-song":
    default: return `${tn} - ${t.title}.${ext}`;
  }
}
