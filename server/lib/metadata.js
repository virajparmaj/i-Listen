const INFO_WORDS = [
  "official video",
  "official music video",
  "official audio",
  "official lyric video",
  "lyric video",
  "lyrics",
  "audio",
  "visualizer",
  "music video",
  "hd",
  "4k",
];

function cleanChannelName(value) {
  return String(value || "")
    .replace(/\s*-\s*topic$/i, "")
    .replace(/\s*vevo$/i, "")
    .replace(/\s+official$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  let text = String(value || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  INFO_WORDS.forEach((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text
      .replace(new RegExp(`\\s*[([{]\\s*${escaped}\\s*[)\\]}]`, "ig"), "")
      .replace(new RegExp(`\\s+-\\s+${escaped}$`, "ig"), "")
      .replace(new RegExp(`\\s+${escaped}$`, "ig"), "");
  });

  return text
    .replace(/\s+\|\s+.*/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function splitArtistTitle(title) {
  const separators = [" - ", " – ", " — ", " -- "];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const [artist, ...rest] = title.split(sep);
      const song = rest.join(sep);
      if (artist.trim() && song.trim()) return { artist: cleanText(artist), title: cleanText(song) };
    }
  }
  return null;
}

function uniq(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function normalizePlaylists(value) {
  if (Array.isArray(value)) return uniq(value);
  return uniq(String(value || "").split(/[,\n]+/));
}

export function playlistsToText(playlists) {
  return normalizePlaylists(playlists).join(", ");
}

export function inferTrackMetadata(info = {}, fallback = {}) {
  const rawTitle = cleanText(info.title || fallback.title || "");
  const uploader = cleanChannelName(info.uploader || info.channel || fallback.artist || "");
  const split = splitArtistTitle(rawTitle);
  const artist = split?.artist || uploader || "Unknown Artist";
  const title = split?.title || rawTitle || fallback.title || "Untitled";
  const year = String(info.release_year || info.upload_date || fallback.year || "").slice(0, 4);
  const album = fallback.album && fallback.album !== "YouTube imports"
    ? fallback.album
    : year
      ? `${year} - Singles`
      : "Singles";

  const playlists = normalizePlaylists([
    ...(fallback.playlists || []),
    "iPod - YouTube Converts",
    artist && artist !== "Unknown Artist" ? `iPod - ${artist}` : "",
  ]);

  return {
    title,
    artist,
    album,
    albumArtist: artist,
    year,
    playlists,
    comment: fallback.comment || "Source=YouTube; best available from YouTube. This cannot restore YouTube compression.",
  };
}
