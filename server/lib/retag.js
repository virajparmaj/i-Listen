import { existsSync } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { extname } from "node:path";
import { metadataArgs, probeMedia, runProcess, validateExport } from "./converter.js";

/**
 * Pick the best available cover image for a job: a user-uploaded custom cover
 * first, then the downloaded YouTube thumbnail. Returns "" when neither exists.
 * @param {object} job
 * @returns {string}
 */
function coverForJob(job) {
  if (job.customCoverPath && existsSync(job.customCoverPath)) return job.customCoverPath;
  if (job.coverPath && existsSync(job.coverPath)) return job.coverPath;
  return "";
}

/**
 * Build ffmpeg args that re-mux an already-exported file in place, writing the
 * job's current metadata and artwork without re-encoding the audio (`-c:a copy`).
 * When a new cover is supplied it replaces the embedded art; otherwise any
 * existing embedded art is preserved.
 */
function buildRetagArgs({ inputPath, coverPath, outputPath }, job) {
  const isMp3 = extname(outputPath).toLowerCase() === ".mp3";
  const hasNewCover = Boolean(coverPath && existsSync(coverPath));

  const args = ["-hide_banner", "-y", "-i", inputPath];
  if (hasNewCover) args.push("-i", coverPath);

  args.push("-map", "0:a");
  if (hasNewCover) args.push("-map", "1:v");
  else args.push("-map", "0:v?");

  args.push("-c:a", "copy");
  args.push("-map_metadata", "-1");

  if (hasNewCover) {
    args.push("-c:v", "mjpeg");
    if (isMp3) args.push("-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (Front)");
    else args.push("-disposition:v:0", "attached_pic");
  } else {
    args.push("-c:v", "copy");
  }

  if (isMp3) args.push("-id3v2_version", "3");
  args.push(...metadataArgs(job));
  if (!isMp3) args.push("-movflags", "+faststart");
  args.push(outputPath);
  return args;
}

/**
 * Rewrite the tags/artwork of an already-converted export so the file Apple
 * Music ingests carries the latest metadata. Atomic: writes to a temp file then
 * renames over the original. Re-validates the result.
 *
 * @param {{ ffmpeg: { path: string }, ffprobe: { path: string } }} tools
 * @param {object} job a complete job with outputPath set
 * @returns {Promise<{ ok: boolean, error?: string, durationSec?: number,
 *   sizeBytes?: number, metadataStatus?: string, artworkStatus?: string }>}
 */
export async function retagExport(tools, job) {
  const outputPath = job.outputPath;
  if (!outputPath || !existsSync(outputPath)) {
    return { ok: false, error: "Cannot re-tag: exported file is missing." };
  }

  const coverPath = coverForJob(job);
  const tmpPath = `${outputPath}.retag${extname(outputPath)}`;
  const args = buildRetagArgs({ inputPath: outputPath, coverPath, outputPath: tmpPath }, job);

  try {
    await runProcess(tools.ffmpeg.path, args);
    await rename(tmpPath, outputPath);
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => {});
    return { ok: false, error: error.message };
  }

  const outputProbe = await probeMedia(tools.ffprobe.path, outputPath);
  const outputAudio = outputProbe.streams.find((stream) => stream.codec_type === "audio") || {};
  const validation = validateExport({ outputPath, outputProbe, outputAudio, coverPath, job });
  if (!validation.ok) return validation;

  const stats = await stat(outputPath);
  return { ...validation, sizeBytes: stats.size };
}
