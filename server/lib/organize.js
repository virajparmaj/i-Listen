import { existsSync } from "node:fs";
import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { customPlaylists } from "./metadata.js";
import { ensureParent, fileExists, sanitizePathSegment } from "./paths.js";
import { retagExport } from "./retag.js";

const METADATA_FIELDS = [
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
  "customCoverPath",
];

function cleanPatch(input = {}) {
  const patch = {};
  METADATA_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) patch[field] = String(input[field] ?? "").trim();
  });
  if (Object.prototype.hasOwnProperty.call(input, "playlists")) {
    patch.playlists = customPlaylists(input.playlists);
  }
  return patch;
}

function outputExtension(job) {
  const ext = extname(job.outputPath || "").replace(".", "").toLowerCase();
  return ext || "m4a";
}

export function organizedOutputPath(project, job) {
  const artist = sanitizePathSegment(job.artist, "Unknown Artist");
  const album = sanitizePathSegment(job.album, "Singles");
  const track = String(job.track || "1").padStart(2, "0");
  const stem = sanitizePathSegment(`${track} - ${job.title}`, `Track ${track}`);
  return ensureParent(join(project.exportsDir, "Music Library", artist, album, `${stem}.${outputExtension(job)}`));
}

function uniqueTargetPath(targetPath, sourcePath) {
  if (resolve(targetPath) === resolve(sourcePath)) return sourcePath;
  const ext = extname(targetPath);
  const stem = targetPath.slice(0, -ext.length);
  let next = targetPath;
  let i = 2;
  while (fileExists(next) && resolve(next) !== resolve(sourcePath)) {
    next = `${stem} (${i})${ext}`;
    i += 1;
  }
  return next;
}

async function moveFile(sourcePath, targetPath) {
  if (resolve(sourcePath) === resolve(targetPath)) return;
  await mkdir(dirname(targetPath), { recursive: true });
  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await copyFile(sourcePath, targetPath);
    await rm(sourcePath, { force: true });
  }
}

/**
 * Apply approved metadata to a completed export, move it to the canonical
 * Artist/Album path, and retag the media file in place after the move.
 */
export async function organizeExport({ project, tools, job, metadata = {} }) {
  if (!job?.outputPath || !existsSync(job.outputPath)) {
    return { ok: false, error: "Cannot organize: exported file is missing." };
  }

  const metadataPatch = cleanPatch(metadata);
  const nextJob = {
    ...job,
    ...metadataPatch,
    playlists: Object.prototype.hasOwnProperty.call(metadataPatch, "playlists")
      ? metadataPatch.playlists
      : customPlaylists(job.playlists || []),
  };
  const targetPath = uniqueTargetPath(organizedOutputPath(project, nextJob), job.outputPath);
  await moveFile(job.outputPath, targetPath);

  const movedJob = { ...nextJob, outputPath: targetPath };
  const validation = await retagExport(tools, movedJob);
  if (!validation.ok) return { ok: false, error: validation.error, path: targetPath, metadataPatch };

  return {
    ok: true,
    path: targetPath,
    metadataPatch,
    validation,
  };
}
