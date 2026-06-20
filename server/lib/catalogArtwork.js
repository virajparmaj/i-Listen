import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const MIN_ARTWORK_BYTES = 128;
const SQUARE_TOLERANCE = 0.08;

function clean(value) {
  return String(value || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenOverlap(wanted, found) {
  const left = new Set(tokens(wanted));
  const right = new Set(tokens(found));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / left.size;
}

function matchesMetadata(candidate = {}, metadata = {}) {
  const title = tokenOverlap(metadata.title, candidate.title);
  const album = tokenOverlap(metadata.album, candidate.album);
  const artist = Math.max(
    tokenOverlap(metadata.artist, candidate.artist),
    tokenOverlap(metadata.albumArtist, candidate.albumArtist || candidate.artist)
  );
  return title >= 0.75 && album >= 0.75 && (artist >= 0.35 || Number(candidate.score || 0) >= 85);
}

function sourcePriority(source) {
  if (source === "itunes") return 0;
  if (source === "musicbrainz") return 1;
  return 2;
}

function candidateArtworkUrl(candidate = {}) {
  if (candidate.source === "itunes" && candidate.artworkUrl) {
    return upgradeItunesArtworkUrl(candidate.artworkUrl);
  }
  if (candidate.source === "musicbrainz" && candidate.releaseId) {
    return coverArtArchiveUrl(candidate.releaseId);
  }
  return "";
}

export function upgradeItunesArtworkUrl(url, size = 1000) {
  const raw = clean(url);
  if (!raw) return "";
  return raw
    .replace(/\/\d+x\d+(bb)?(?=\.[a-z0-9]+(?:$|\?))/i, `/${size}x${size}$1`)
    .replace(/\/source\/\d+x\d+(bb)?(?=\.[a-z0-9]+(?:$|\?))/i, `/source/${size}x${size}$1`);
}

export function coverArtArchiveUrl(releaseId) {
  const id = clean(releaseId);
  return id ? `https://coverartarchive.org/release/${encodeURIComponent(id)}/front-500` : "";
}

export function selectCatalogArtworkCandidate({ metadata = {}, context = {} } = {}) {
  const candidates = [
    ...(Array.isArray(context.itunesCandidates) ? context.itunesCandidates : []),
    ...(Array.isArray(context.musicBrainzCandidates) ? context.musicBrainzCandidates : []),
    ...(Array.isArray(context.acoustidCandidates) ? context.acoustidCandidates : []),
  ]
    .filter((candidate) => candidateArtworkUrl(candidate))
    .filter((candidate) => matchesMetadata(candidate, metadata))
    .filter((candidate) => Number(candidate.score || 0) >= 70 || candidate.source === "itunes")
    .sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source) || Number(b.score || 0) - Number(a.score || 0));

  const candidate = candidates[0] || null;
  if (!candidate) return null;
  return {
    ...candidate,
    artworkUrl: candidateArtworkUrl(candidate),
  };
}

function extensionForContentType(contentType) {
  const value = clean(contentType).toLowerCase();
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  return "";
}

function readPngDimensions(buffer) {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (!length || offset + length + 2 > buffer.length) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += length + 2;
  }
  return null;
}

export function imageDimensions(buffer) {
  return readPngDimensions(buffer) || readJpegDimensions(buffer) || null;
}

function validateArtworkBuffer(buffer, contentType) {
  const ext = extensionForContentType(contentType);
  if (!ext) return { ok: false, error: "Catalog artwork response was not an image." };
  if (buffer.length < MIN_ARTWORK_BYTES) return { ok: false, error: "Catalog artwork image was empty or too small." };
  if (buffer.length > MAX_ARTWORK_BYTES) return { ok: false, error: "Catalog artwork image was too large." };

  const dimensions = imageDimensions(buffer);
  if (dimensions) {
    const max = Math.max(dimensions.width, dimensions.height);
    const delta = Math.abs(dimensions.width - dimensions.height);
    if (!max || delta / max > SQUARE_TOLERANCE) {
      return { ok: false, error: `Catalog artwork was not square (${dimensions.width}x${dimensions.height}).` };
    }
  }

  return { ok: true, ext, dimensions };
}

export async function downloadCatalogArtwork({ project, job, metadata = {}, context = {}, fetchImpl = fetch } = {}) {
  if (job?.customCoverPath && existsSync(job.customCoverPath)) {
    return { ok: true, path: job.customCoverPath, source: "existing-custom", reused: true };
  }

  const candidate = selectCatalogArtworkCandidate({ metadata, context });
  if (!candidate) {
    return { ok: false, error: "Trusted catalog artwork was not found. Review artwork manually." };
  }

  let response;
  try {
    response = await fetchImpl(candidate.artworkUrl, { headers: { Accept: "image/jpeg,image/png,image/webp" } });
  } catch (error) {
    return { ok: false, error: `Could not fetch catalog artwork: ${error.message}` };
  }

  if (!response?.ok) {
    return { ok: false, error: `Could not fetch catalog artwork: HTTP ${response?.status || 0}` };
  }

  const contentType = response.headers?.get?.("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  const validation = validateArtworkBuffer(buffer, contentType);
  if (!validation.ok) return validation;

  await mkdir(project.artworkDir, { recursive: true });
  const path = join(project.artworkDir, `${job.id}-catalog.${validation.ext}`);
  await writeFile(path, buffer);
  return {
    ok: true,
    path,
    source: candidate.source,
    artworkUrl: candidate.artworkUrl,
    candidateId: candidate.id || candidate.releaseId || "",
    dimensions: validation.dimensions || null,
  };
}
