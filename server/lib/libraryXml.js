import * as plistModule from "plist";

// `plist` is a CommonJS package; default-import interop differs between plain
// Node ESM and the Vite/Vitest transform, so resolve the parse fn defensively.
const plist = plistModule.default || plistModule;

// An Apple Music / iTunes "Export Library…" file is an Apple property list whose
// top level is a dict with a `Tracks` dict and a `Playlists` array. This module
// turns that untrusted file into a small, provider-neutral shape the rest of the
// helper can use: a list of user playlists and a catalog of tracks keyed by id.
//
// It mirrors vault-verse's Swift `LibraryXMLParser` so both apps read the same
// file the same way (skip system/auto playlists, treat the file as untrusted).

// A real library export is at most a few tens of MB; refuse anything absurd.
export const MAX_LIBRARY_BYTES = 200 * 1024 * 1024;

function asString(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed;
}

function asInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function yearFrom(dict) {
  const year = asInt(dict["Year"]);
  if (year && year > 0) return String(year);
  const release = dict["Release Date"];
  if (release instanceof Date && !Number.isNaN(release.getTime())) return String(release.getUTCFullYear());
  if (typeof release === "string") {
    const match = release.match(/(\d{4})/);
    if (match) return match[1];
  }
  return "";
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

/**
 * Build the per-id track catalog from the raw `Tracks` dict.
 * A track with no usable title is dropped — it cannot be searched or tagged.
 * @returns {Record<string, object>}
 */
export function buildTracks(rawTracks) {
  const out = {};
  for (const [key, value] of Object.entries(rawTracks || {})) {
    if (!value || typeof value !== "object") continue;
    const trackId = asInt(value["Track ID"]) ?? asInt(key);
    if (trackId == null) continue;
    const title = asString(value["Name"]);
    if (!title) continue;

    const totalTimeMs = asInt(value["Total Time"]);
    out[String(trackId)] = {
      id: trackId,
      title,
      artist: asString(value["Artist"]) || "Unknown Artist",
      album: asString(value["Album"]),
      albumArtist: asString(value["Album Artist"]),
      genre: asString(value["Genre"]),
      year: yearFrom(value),
      trackNumber: asInt(value["Track Number"]) ?? null,
      discNumber: asInt(value["Disc Number"]) ?? null,
      durationSec: totalTimeMs != null ? Math.round(totalTimeMs / 1000) : null,
      location: asString(value["Location"]),
      addedAt: isoDate(value["Date Added"]),
    };
  }
  return out;
}

/**
 * Build the ordered list of user playlists, skipping the system/auto playlists
 * Music exports (the `Master` library and any `Distinguished Kind` such as
 * Music, Downloaded, Recently Added). Order and track order are preserved.
 * @returns {Array<{ id: string, name: string, trackCount: number, trackIds: number[] }>}
 */
export function buildPlaylists(rawPlaylists, tracksById) {
  const entries = [];
  for (const dict of Array.isArray(rawPlaylists) ? rawPlaylists : []) {
    if (!dict || typeof dict !== "object") continue;
    if (dict["Master"] === true) continue;
    if (dict["Distinguished Kind"] != null) continue;
    const name = asString(dict["Name"]);
    if (!name) continue;

    const items = Array.isArray(dict["Playlist Items"]) ? dict["Playlist Items"] : [];
    const trackIds = items
      .map((item) => asInt(item?.["Track ID"]))
      .filter((id) => id != null && tracksById[String(id)]);

    const id = asString(dict["Playlist Persistent ID"])
      || (asInt(dict["Playlist ID"]) != null ? String(asInt(dict["Playlist ID"])) : name);

    entries.push({ id, name, trackCount: trackIds.length, trackIds });
  }
  return entries;
}

/**
 * Turn a decoded plist root object into the provider-neutral library shape.
 * Throws an Error with a user-facing message when the shape is wrong.
 * @returns {{ playlists: Array, tracksById: Record<string, object> }}
 */
export function buildLibrary(root) {
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error("This doesn't look like a Music/iTunes “Export Library…” file.");
  }
  const rawTracks = root["Tracks"];
  const rawPlaylists = root["Playlists"];
  if (!rawTracks || typeof rawTracks !== "object" || !Array.isArray(rawPlaylists)) {
    throw new Error("This doesn't look like a Music/iTunes “Export Library…” file (no Tracks/Playlists).");
  }

  const tracksById = buildTracks(rawTracks);
  const playlists = buildPlaylists(rawPlaylists, tracksById);
  return { playlists, tracksById };
}

/**
 * Parse an exported Library.xml string into the provider-neutral library shape.
 * The string is treated as untrusted: it is size-capped and shape-validated, and
 * any failure surfaces as an Error with a message the UI can show directly.
 * @param {string} xml
 * @returns {{ playlists: Array, tracksById: Record<string, object> }}
 */
export function parseLibraryXml(xml) {
  const text = typeof xml === "string" ? xml : "";
  if (!text.trim()) {
    throw new Error("The selected file is empty. Pick a Music “Export Library…” .xml file.");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_LIBRARY_BYTES) {
    throw new Error(`That file is too large to be a library export (over ${MAX_LIBRARY_BYTES / (1024 * 1024)} MB).`);
  }

  let root;
  try {
    root = plist.parse(text);
  } catch (error) {
    throw new Error(`Couldn't read the file as a property list: ${error.message}`);
  }
  return buildLibrary(root);
}
