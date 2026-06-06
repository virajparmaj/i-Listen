import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { addLog, getJob, listJobs, updateJob } from "./db.js";
import { inferTrackMetadata, normalizePlaylists } from "./metadata.js";
import { ensureParent, fileExists, relativePlaylistPath, sanitizePathSegment } from "./paths.js";

const COMPLETE_CODECS = new Set(["aac", "alac", "mp3"]);

function runProcess(command, args, options = {}) {
  const { cwd, signal, onStdout, onStderr } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, signal, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onStdout?.(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onStderr?.(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${basename(command)} exited with code ${code}`));
    });
  });
}

function metadataArgs(job) {
  const fields = [
    ["title", job.title],
    ["artist", job.artist],
    ["album", job.album],
    ["album_artist", job.albumArtist],
    ["date", job.year],
    ["genre", job.genre],
    ["track", job.track],
    ["composer", job.composer],
    ["comment", job.comment],
  ];

  return fields
    .filter(([, value]) => String(value || "").trim())
    .flatMap(([key, value]) => ["-metadata", `${key}=${value}`]);
}

function outputExtension(plan) {
  if (plan.codec === "mp3") return "mp3";
  return "m4a";
}

function outputLabel(plan) {
  if (plan.mode === "copy-aac") return "AAC copied from YouTube";
  if (plan.codec === "alac") return "ALAC from YouTube";
  if (plan.codec === "aac") return "AAC 256 from YouTube";
  if (plan.codec === "mp3") return "MP3 V0 from YouTube";
  return "Best available from YouTube";
}

export function chooseOutputPlan(job, probe) {
  const requested = job.outputOption || "best-youtube";
  const audio = probe.streams.find((stream) => stream.codec_type === "audio") || {};
  const codec = String(audio.codec_name || "").toLowerCase();
  const formatName = String(probe.format?.format_name || "").toLowerCase();
  const isMp4Family = /mp4|mov|m4a|3gp/.test(formatName);

  if (requested === "mp3-v0") return { mode: "transcode", codec: "mp3", args: ["-c:a", "libmp3lame", "-q:a", "0"] };
  if (requested === "aac-256") return { mode: "transcode", codec: "aac", args: ["-c:a", "aac", "-b:a", "256k"] };
  if (requested === "alac") return { mode: "transcode", codec: "alac", args: ["-c:a", "alac"] };
  if (codec === "aac" && isMp4Family) return { mode: "copy-aac", codec: "aac", args: ["-c:a", "copy"] };
  return { mode: "transcode", codec: "alac", args: ["-c:a", "alac"] };
}

function uniqueOutputPath(project, job, plan) {
  const artist = sanitizePathSegment(job.artist, "Unknown Artist");
  const album = sanitizePathSegment(job.album, "YouTube imports");
  const track = String(job.track || "1").padStart(2, "0");
  const stem = sanitizePathSegment(`${track} - ${job.title}`, `Track ${track}`);
  const ext = outputExtension(plan);
  const dir = join(project.exportsDir, "Music Library", artist, album);
  let path = join(dir, `${stem}.${ext}`);
  let i = 2;
  while (fileExists(path)) {
    path = join(dir, `${stem} (${i}).${ext}`);
    i += 1;
  }
  return ensureParent(path);
}

function buildFfmpegArgs({ inputPath, coverPath, outputPath, job, plan }) {
  const args = ["-hide_banner", "-y", "-i", inputPath];
  if (coverPath && existsSync(coverPath)) args.push("-i", coverPath);

  args.push("-map", "0:a:0");
  const hasCover = coverPath && existsSync(coverPath);
  if (hasCover) args.push("-map", "1:v:0");
  args.push(...plan.args);

  if (hasCover) {
    args.push("-c:v", "mjpeg");
    if (outputExtension(plan) === "mp3") {
      args.push("-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (Front)");
    } else {
      args.push("-disposition:v:0", "attached_pic");
    }
  }

  if (outputExtension(plan) === "mp3") args.push("-id3v2_version", "3");
  args.push(...metadataArgs(job));
  if (outputExtension(plan) !== "mp3") args.push("-movflags", "+faststart");
  args.push(outputPath);
  return args;
}

async function probeMedia(ffprobe, path) {
  const { stdout } = await runProcess(ffprobe, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    path,
  ]);
  return JSON.parse(stdout);
}

async function downloadThumbnail(url, outputPath) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;

  const type = response.headers.get("content-type") || "";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const finalPath = `${outputPath}.${ext}`;
  await mkdir(join(outputPath, ".."), { recursive: true }).catch(() => {});
  await writeFile(finalPath, Buffer.from(await response.arrayBuffer()));
  return finalPath;
}

function firstExistingPath(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => existsSync(line));
}

function logSnippet(text) {
  return text.trim().split(/\n+/).slice(-4).join(" ").slice(0, 500);
}

export class JobRunner {
  constructor({ db, project, tools, emit }) {
    this.db = db;
    this.project = project;
    this.tools = tools;
    this.emit = emit;
    this.active = new Map();
  }

  log(msg, kind = null, label = null) {
    const log = addLog(this.db, msg, kind, label);
    this.emit({ type: "log", log });
    return log;
  }

  patch(id, patch) {
    const job = updateJob(this.db, id, patch);
    this.emit({ type: "jobs", jobs: listJobs(this.db) });
    return job;
  }

  async startJob(id) {
    if (this.active.has(id)) return getJob(this.db, id);
    if (!this.tools.ready) {
      const missing = [this.tools.ytdlp, this.tools.ffmpeg, this.tools.ffprobe].filter((tool) => !tool.ok).map((tool) => tool.name).join(", ");
      return this.patch(id, { status: "failed", progress: 0, error: `Missing tools: ${missing}` });
    }

    const controller = new AbortController();
    this.active.set(id, controller);

    try {
      await this.runJob(id, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        this.patch(id, { status: "canceled", progress: 0, error: "Canceled by user." });
        this.log(`${id} canceled.`, "warn", "Cancel:");
      } else {
        this.patch(id, { status: "failed", progress: 0, error: error.message });
        this.log(error.message, "err", "Failed:");
      }
    } finally {
      this.active.delete(id);
    }

    return getJob(this.db, id);
  }

  cancelJob(id) {
    const controller = this.active.get(id);
    if (controller) controller.abort();
    else this.patch(id, { status: "canceled", progress: 0, error: "Canceled before conversion started." });
    return getJob(this.db, id);
  }

  async runJob(id, signal) {
    let job = this.patch(id, { status: "analyzing", progress: 8, error: "", warning: "" });
    this.log(`${job.url}`, null, "Analyze:");

    const { stdout: infoText } = await runProcess(this.tools.ytdlp.path, [
      "--dump-single-json",
      "--no-playlist",
      "--no-warnings",
      job.url,
    ], { signal });
    const info = JSON.parse(infoText);
    const inferred = inferTrackMetadata(info, job);
    job = this.patch(id, {
      title: job.title.startsWith("YouTube link") ? inferred.title : job.title,
      artist: job.artist === "Unknown Artist" ? inferred.artist : job.artist,
      album: job.album === "YouTube imports" ? inferred.album : job.album,
      albumArtist: job.albumArtist === "Unknown Artist" ? inferred.albumArtist : job.albumArtist,
      year: job.year || inferred.year,
      comment: job.comment || inferred.comment,
      playlists: job.playlists?.length ? normalizePlaylists([...job.playlists, ...inferred.playlists]) : inferred.playlists,
      thumbnailUrl: info.thumbnail || "",
      durationSec: info.duration || null,
      status: "downloading",
      progress: 22,
    });

    await rm(join(this.project.stagingDir, `${id}${extname(job.sourcePath || "")}`), { force: true }).catch(() => {});
    const outputTemplate = join(this.project.stagingDir, `${id}.%(ext)s`);
    const { stdout: downloadText, stderr: downloadErr } = await runProcess(this.tools.ytdlp.path, [
      "-f", "ba/b",
      "--no-playlist",
      "--no-progress",
      "--force-overwrites",
      "--print", "after_move:filepath",
      "-o", outputTemplate,
      job.url,
    ], {
      signal,
      onStderr: (text) => {
        if (text.includes("[download]")) this.patch(id, { status: "downloading", progress: 34 });
      },
    });

    const sourcePath = firstExistingPath(downloadText) || firstExistingPath(downloadErr);
    if (!sourcePath) throw new Error("yt-dlp finished without reporting a downloaded audio file.");
    job = this.patch(id, { sourcePath, status: "converting", progress: 42 });

    let coverPath = "";
    try {
      coverPath = await downloadThumbnail(job.thumbnailUrl, join(this.project.artworkDir, id)) || "";
    } catch (error) {
      this.log(`Artwork skipped: ${error.message}`, "warn", "Artwork:");
    }

    const sourceProbe = await probeMedia(this.tools.ffprobe.path, sourcePath);
    const audio = sourceProbe.streams.find((stream) => stream.codec_type === "audio") || {};
    const plan = chooseOutputPlan(job, sourceProbe);
    const outputPath = uniqueOutputPath(this.project, job, plan);
    const ffmpegArgs = buildFfmpegArgs({ inputPath: sourcePath, coverPath, outputPath, job, plan });
    await runProcess(this.tools.ffmpeg.path, ffmpegArgs, {
      signal,
      onStderr: (text) => {
        if (text.trim()) this.log(logSnippet(text), null, "FFmpeg:");
      },
    });

    job = this.patch(id, {
      status: "validating",
      progress: 88,
      coverPath,
      outputPath,
      sourceCodec: audio.codec_name || "",
      sourceContainer: sourceProbe.format?.format_name || "",
      selectedOutput: outputLabel(plan),
    });

    const outputProbe = await probeMedia(this.tools.ffprobe.path, outputPath);
    const outputAudio = outputProbe.streams.find((stream) => stream.codec_type === "audio") || {};
    const outputStats = await stat(outputPath);
    if (!COMPLETE_CODECS.has(String(outputAudio.codec_name || "").toLowerCase())) {
      throw new Error(`ffprobe found unsupported output codec: ${outputAudio.codec_name || "unknown"}`);
    }

    this.patch(id, {
      status: "complete",
      progress: 100,
      durationSec: Number(outputProbe.format?.duration || job.durationSec || 0),
      sizeBytes: outputStats.size,
      error: "",
      warning: job.outputOption === "best-youtube" ? "Best available from YouTube; not original studio/master quality." : "",
    });
    this.log(`${relativePlaylistPath(outputPath)} ready for Apple Music import.`, "ok", "Complete:");
  }
}

export async function writePlaylist(project, jobs, filename = "iListen Export.m3u") {
  const done = jobs.filter((job) => job.status === "complete" && job.outputPath);
  const path = join(project.exportsDir, "Playlists", filename);
  ensureParent(path);
  const lines = ["#EXTM3U", ...done.map((job) => relativePlaylistPath(job.outputPath))];
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
  return { path, count: done.length };
}

export async function writePlaylists(project, jobs) {
  const done = jobs.filter((job) => job.status === "complete" && job.outputPath);
  const groups = new Map();

  done.forEach((job) => {
    const names = normalizePlaylists(job.playlists?.length ? job.playlists : ["iPod - YouTube Converts"]);
    names.forEach((name) => {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(job);
    });
  });

  const playlists = [];
  for (const [name, items] of groups.entries()) {
    const filename = `${sanitizePathSegment(name, "iListen Playlist")}.m3u`;
    const path = join(project.exportsDir, "Playlists", filename);
    ensureParent(path);
    const lines = ["#EXTM3U", ...items.map((job) => relativePlaylistPath(job.outputPath))];
    await writeFile(path, `${lines.join("\n")}\n`, "utf8");
    playlists.push({ name, path, count: items.length });
  }

  const all = await writePlaylist(project, done, "iListen Export.m3u");
  return { playlists, all, count: done.length };
}
