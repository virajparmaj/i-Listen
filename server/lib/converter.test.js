import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUDIO_REPAIR_PRESETS, chooseOutputPlan, reconvertExistingJob, writePlaylists } from "./converter.js";
const probe = (codec, formatName) => ({
  streams: [{ codec_type: "audio", codec_name: codec }],
  format: { format_name: formatName },
});

const exportProbe = (codec = "aac", formatName = "mov,mp4,m4a,3gp,3g2,mj2") => ({
  streams: [{ codec_type: "audio", codec_name: codec }, { codec_type: "video", codec_name: "mjpeg" }],
  format: { format_name: formatName, duration: "180", tags: { title: "Clean Song", artist: "Clean Artist", album: "Clean Album" } },
});

function testProject() {
  tempDir = mkdtempSync(join(tmpdir(), "ilisten-reconvert-"));
  const project = {
    root: tempDir,
    stagingDir: join(tempDir, "staging"),
    exportsDir: join(tempDir, "exports"),
    artworkDir: join(tempDir, "artwork"),
  };
  Object.values(project).slice(1).forEach((path) => mkdirSync(path, { recursive: true }));
  return project;
}

function cleanJob(project, patch = {}) {
  return {
    id: "job-1",
    url: "https://www.youtube.com/watch?v=saved-link",
    title: "Clean Song",
    artist: "Clean Artist",
    album: "Clean Album",
    albumArtist: "Clean Artist",
    year: "2020",
    genre: "Pop",
    track: "4",
    disc: "1",
    composer: "",
    comment: "Cleaned by user",
    playlists: ["Road Trip"],
    outputOption: "best-youtube",
    outputPath: join(project.exportsDir, "Music Library", "Clean Artist", "Clean Album", "04 - Clean Song.m4a"),
    sourcePath: join(project.stagingDir, "job-1.m4a"),
    coverPath: "",
    customCoverPath: "",
    durationSec: 180,
    ...patch,
  };
}

const tools = {
  ytdlp: { path: "yt-dlp" },
  ffmpeg: { path: "ffmpeg" },
  ffprobe: { path: "ffprobe" },
};

let tempDir = null;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("smart output planning", () => {
  it("copies iPod-compatible AAC from MP4/M4A sources", () => {
    const plan = chooseOutputPlan({ outputOption: "best-youtube" }, probe("aac", "mov,mp4,m4a,3gp,3g2,mj2"));

    expect(plan.mode).toBe("copy-aac");
    expect(plan.args).toEqual(["-c:a", "copy"]);
  });

  it("uses ALAC for non-iPod YouTube audio in best-available mode", () => {
    const plan = chooseOutputPlan({ outputOption: "best-youtube" }, probe("opus", "matroska,webm"));

    expect(plan.codec).toBe("alac");
    expect(plan.args).toEqual(["-c:a", "alac"]);
  });

  it("keeps advanced MP3 V0 available", () => {
    const plan = chooseOutputPlan({ outputOption: "mp3-v0" }, probe("opus", "matroska,webm"));

    expect(plan.codec).toBe("mp3");
    expect(plan.args).toEqual(["-c:a", "libmp3lame", "-q:a", "0"]);
  });

  it("uses a headroom limiter for bass-safe iPod AAC", () => {
    const plan = chooseOutputPlan({ outputOption: "ipod-safe-aac" }, probe("aac", "mov,mp4,m4a,3gp,3g2,mj2"));

    expect(plan.mode).toBe("ipod-safe-aac");
    expect(plan.codec).toBe("aac");
    expect(plan.args).toEqual(["-af", "volume=-4dB,alimiter=limit=0.85:level=false", "-c:a", "aac", "-b:a", "256k"]);
  });

  it("uses AAC 256 with the exact audio repair filter for each repair preset", () => {
    for (const [outputOption, preset] of Object.entries(AUDIO_REPAIR_PRESETS)) {
      const plan = chooseOutputPlan({ outputOption }, probe("aac", "mov,mp4,m4a,3gp,3g2,mj2"));

      expect(plan.mode).toBe(outputOption);
      expect(plan.codec).toBe("aac");
      expect(plan.args).toEqual(["-af", preset.filter, "-c:a", "aac", "-b:a", "256k"]);
    }
  });

  it("writes one playlist file for each assigned playlist plus an all export", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "ilisten-playlists-"));
    const outputPath = join(tempDir, "exports", "Music Library", "Artist", "Singles", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, "");

    const result = await writePlaylists({ exportsDir: join(tempDir, "exports") }, [{
      id: "job-1",
      status: "complete",
      outputPath,
      playlists: ["Chill", "iPod - Artist", "Hindi Mix"],
    }]);

    expect(result.count).toBe(1);
    expect(result.playlists.map((item) => item.name)).toEqual(["Chill", "Hindi Mix"]);
    expect(result.all.path.endsWith("iListen Export.m3u")).toBe(true);
  });

  it("reconverts from an existing sourcePath without redownloading or inferring YouTube metadata", async () => {
    const project = testProject();
    const customCoverPath = join(project.artworkDir, "job-1-custom.jpg");
    const job = cleanJob(project, { customCoverPath });
    mkdirSync(join(job.outputPath, ".."), { recursive: true });
    writeFileSync(job.sourcePath, "source-audio");
    writeFileSync(job.outputPath, "old-export");
    writeFileSync(customCoverPath, "cover");
    const calls = [];
    const run = async (command, args) => {
      calls.push({ command, args });
      if (command === "ffmpeg") writeFileSync(args.at(-1), "new-export");
      return { stdout: "", stderr: "" };
    };
    const mediaProbe = async (_ffprobe, mediaPath) => mediaPath === job.sourcePath
      ? probe("aac", "mov,mp4,m4a,3gp,3g2,mj2")
      : exportProbe();

    const result = await reconvertExistingJob({
      project,
      tools,
      job,
      outputOption: "ipod-safe-aac",
      run,
      probe: mediaProbe,
    });

    expect(result.usedSavedSource).toBe(true);
    expect(result.sourcePath).toBe(job.sourcePath);
    expect(result.outputPath).toBe(job.outputPath);
    expect(result.selectedOutput).toBe("Bass-safe AAC for iPod");
    expect(readFileSync(job.outputPath, "utf8")).toBe("new-export");
    expect(calls.some((call) => call.command === "yt-dlp")).toBe(false);
    const ffmpegArgs = calls.find((call) => call.command === "ffmpeg").args;
    expect(ffmpegArgs).toContain(job.sourcePath);
    expect(ffmpegArgs).toContain(customCoverPath);
    expect(ffmpegArgs).toContain("title=Clean Song");
    expect(ffmpegArgs.join(" ")).not.toContain("--dump-single-json");
  });

  it("redownloads from the saved job URL when sourcePath is missing", async () => {
    const project = testProject();
    const missingSourcePath = join(project.stagingDir, "missing.m4a");
    const downloadedPath = join(project.stagingDir, "job-1-reconvert.m4a");
    const job = cleanJob(project, { sourcePath: missingSourcePath });
    mkdirSync(join(job.outputPath, ".."), { recursive: true });
    writeFileSync(job.outputPath, "old-export");
    const calls = [];
    const run = async (command, args) => {
      calls.push({ command, args });
      if (command === "yt-dlp") {
        writeFileSync(downloadedPath, "downloaded-source");
        return { stdout: `${downloadedPath}\n`, stderr: "" };
      }
      if (command === "ffmpeg") writeFileSync(args.at(-1), "new-export");
      return { stdout: "", stderr: "" };
    };
    const mediaProbe = async (_ffprobe, mediaPath) => mediaPath === downloadedPath
      ? probe("aac", "mov,mp4,m4a,3gp,3g2,mj2")
      : exportProbe();

    const result = await reconvertExistingJob({
      project,
      tools,
      job,
      outputOption: "ipod-safe-aac",
      run,
      probe: mediaProbe,
    });

    expect(result.usedSavedSource).toBe(false);
    expect(result.sourcePath).toBe(downloadedPath);
    const downloadCall = calls.find((call) => call.command === "yt-dlp");
    expect(downloadCall.args).toContain(job.url);
    expect(calls.flatMap((call) => call.args).join(" ")).not.toContain("--dump-single-json");
  });

  it("archives the old export and writes a new path when output extension changes", async () => {
    const project = testProject();
    const job = cleanJob(project);
    mkdirSync(join(job.outputPath, ".."), { recursive: true });
    writeFileSync(job.sourcePath, "source-audio");
    writeFileSync(job.outputPath, "old-export");
    const run = async (command, args) => {
      if (command === "ffmpeg") writeFileSync(args.at(-1), "new-mp3-export");
      return { stdout: "", stderr: "" };
    };
    const mediaProbe = async (_ffprobe, mediaPath) => mediaPath === job.sourcePath
      ? probe("aac", "mov,mp4,m4a,3gp,3g2,mj2")
      : exportProbe("mp3", "mp3");

    const result = await reconvertExistingJob({
      project,
      tools,
      job,
      outputOption: "mp3-v0",
      run,
      probe: mediaProbe,
    });

    expect(result.outputPath).toMatch(/04 - Clean Song\.mp3$/);
    expect(result.archivedOutputPath).toContain(join("archive", "reconverted"));
    expect(existsSync(job.outputPath)).toBe(false);
    expect(existsSync(result.archivedOutputPath)).toBe(true);
    expect(readFileSync(result.outputPath, "utf8")).toBe("new-mp3-export");
  });
});
