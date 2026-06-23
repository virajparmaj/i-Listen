import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createJobs, getJob, listMetadataExamples, openDatabase, updateJob } from "./lib/db.js";
import { createAppState, helperReuseMessage, helperStartupMessage, probeRunningHelper, route, selectAppleMusicHandoffJobs } from "./index.js";

let tempDir = null;

function createProject() {
  tempDir = mkdtempSync(join(tmpdir(), "ilisten-server-"));
  const project = {
    root: tempDir,
    dbPath: join(tempDir, "ilisten.sqlite"),
    stagingDir: join(tempDir, "staging"),
    exportsDir: join(tempDir, "exports"),
    artworkDir: join(tempDir, "artwork"),
    logsDir: join(tempDir, "logs"),
  };
  Object.values(project).slice(2).forEach((path) => mkdirSync(path, { recursive: true }));
  return project;
}

function createState() {
  const project = createProject();
  const state = createAppState();
  state.token = "test-token";
  state.project = project;
  state.db = openDatabase(project.dbPath);
  return { state, project };
}

function readyTools() {
  return {
    ready: true,
    ytdlp: { ok: true, path: "yt-dlp" },
    ffmpeg: { ok: true, path: "ffmpeg" },
    ffprobe: { ok: true, path: "ffprobe" },
    ollama: { ok: true, path: "ollama" },
    fpcalc: { ok: false, path: null },
  };
}

function makeReq({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: "127.0.0.1:4317", ...headers };
  return req;
}

function makeRes() {
  const res = new PassThrough();
  const chunks = [];

  res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  res.writeHead = (statusCode, headers = {}) => {
    res.statusCode = statusCode;
    res.headers = headers;
    return res;
  };

  return {
    res,
    async done() {
      if (res.writableFinished) return;
      await new Promise((resolve) => res.once("finish", resolve));
    },
    body() {
      return Buffer.concat(chunks);
    },
    json() {
      return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    },
  };
}

async function request(state, options) {
  const req = makeReq(options);
  const wrapped = makeRes();
  await route(req, wrapped.res, state, new Set());
  await wrapped.done();
  return wrapped;
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeProbeRequest({ statusCode = 200, body = "", error = null, assertOptions = null } = {}) {
  return (options, onResponse) => {
    assertOptions?.(options);
    const req = new EventEmitter();
    req.setTimeout = (_timeoutMs, handler) => {
      req._timeoutHandler = handler;
      return req;
    };
    req.destroy = (destroyError) => {
      if (destroyError) Promise.resolve().then(() => req.emit("error", destroyError));
    };
    req.end = () => {
      Promise.resolve().then(() => {
        if (error) {
          req.emit("error", error);
          return;
        }

        const res = new EventEmitter();
        res.statusCode = statusCode;
        res.setEncoding = () => {};
        onResponse(res);
        if (body) res.emit("data", body);
        res.emit("end");
      });
    };
    return req;
  };
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("helper asset endpoints", () => {
  it("formats a friendly message when the helper port is already in use", () => {
    const msg = helperStartupMessage({ code: "EADDRINUSE" }, "127.0.0.1", 4317);

    expect(msg).toContain("127.0.0.1:4317 is already in use");
    expect(msg).toContain("lsof -nP -iTCP:4317 -sTCP:LISTEN");
  });

  it("formats a friendly reuse message when the helper is already running", () => {
    const msg = helperReuseMessage({
      ok: true,
      paired: false,
      project: { root: "/tmp/iListen Project" },
      tools: { ready: true },
      jobs: [],
      logs: [],
    }, "127.0.0.1", 4317);

    expect(msg).toContain("already running");
    expect(msg).toContain("Reusing the existing local helper");
    expect(msg).toContain("/tmp/iListen Project");
  });

  it("detects a running iListen helper on an occupied port", async () => {
    const health = await probeRunningHelper({
      host: "127.0.0.1",
      port: 4317,
      timeoutMs: 500,
    }, makeProbeRequest({
      body: JSON.stringify({
        ok: true,
        paired: false,
        project: null,
        tools: { ready: true },
        jobs: [],
        logs: [],
      }),
      assertOptions: (options) => {
        expect(options).toMatchObject({
          host: "127.0.0.1",
          port: 4317,
          method: "GET",
          path: "/health",
        });
      },
    }));

    expect(health).toMatchObject({
      ok: true,
      paired: false,
    });
    expect(Array.isArray(health.jobs)).toBe(true);
    expect(Array.isArray(health.logs)).toBe(true);
  });

  it("ignores unrelated listeners when probing an occupied port", async () => {
    const health = await probeRunningHelper({
      host: "127.0.0.1",
      port: 4317,
      timeoutMs: 500,
    }, makeProbeRequest({
      body: "not iListen",
    }));

    expect(health).toBeNull();
  });

  it("includes cached AI metadata readiness in health", async () => {
    const oldModel = process.env.ILISTEN_METADATA_MODEL;
    const oldTimeout = process.env.ILISTEN_METADATA_TIMEOUT_MS;
    delete process.env.ILISTEN_METADATA_MODEL;
    delete process.env.ILISTEN_METADATA_TIMEOUT_MS;

    try {
      const { state } = createState();
      let calls = 0;
      state.aiMetadataHealthFetch = async (_url, options) => {
        calls += 1;
        expect(options.body).toContain("qwen:1.8b");
        return { ok: true, json: async () => ({ response: "OK" }) };
      };

      const first = await request(state, { url: "/health" });
      const second = await request(state, { url: "/health" });

      expect(first.res.statusCode).toBe(200);
      expect(first.json().aiMetadata).toMatchObject({
        ok: true,
        model: "qwen:1.8b",
        error: "",
        timeoutMs: 45000,
        preflightTimeoutMs: 5000,
      });
      expect(second.json().aiMetadata.ok).toBe(true);
      expect(calls).toBe(1);
    } finally {
      if (oldModel == null) delete process.env.ILISTEN_METADATA_MODEL;
      else process.env.ILISTEN_METADATA_MODEL = oldModel;
      if (oldTimeout == null) delete process.env.ILISTEN_METADATA_TIMEOUT_MS;
      else process.env.ILISTEN_METADATA_TIMEOUT_MS = oldTimeout;
    }
  });

  it("serves stored cover art for a completed job", async () => {
    const { state, project } = createState();
    const created = createJobs(state.db, ["https://youtube.com/watch?v=asset-cover"]).created[0];
    const coverPath = join(project.artworkDir, "cover.jpg");
    writeFileSync(coverPath, Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
    updateJob(state.db, created.id, { status: "complete", coverPath });

    const response = await request(state, {
      url: `/jobs/${created.id}/cover?token=test-token`,
    });

    expect(response.res.statusCode).toBe(200);
    expect(response.res.headers["Content-Type"]).toBe("image/jpeg");
    expect(response.body()).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
  });

  it("serves trusted custom/catalog art before the original downloaded thumbnail", async () => {
    const { state, project } = createState();
    const created = createJobs(state.db, ["https://youtube.com/watch?v=asset-custom-cover"]).created[0];
    const coverPath = join(project.artworkDir, "cover.jpg");
    const customCoverPath = join(project.artworkDir, "cover-custom.jpg");
    writeFileSync(coverPath, Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
    writeFileSync(customCoverPath, Buffer.from([0xff, 0xd8, 0xff, 0xee]));
    updateJob(state.db, created.id, { status: "complete", coverPath, customCoverPath });

    const response = await request(state, {
      url: `/jobs/${created.id}/cover?token=test-token`,
    });

    expect(response.res.statusCode).toBe(200);
    expect(response.body()).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0xee]));
  });

  it("serves local helper assets without requiring a pairing token", async () => {
    const { state, project } = createState();
    const created = createJobs(state.db, ["https://youtube.com/watch?v=asset-open"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("abcdef"));
    updateJob(state.db, created.id, { status: "complete", outputPath });

    const response = await request(state, {
      url: `/jobs/${created.id}/audio`,
      headers: { range: "bytes=0-1" },
    });

    expect(response.res.statusCode).toBe(206);
    expect(response.body().toString("utf8")).toBe("ab");
  });

  it("returns 404 when a requested job asset is missing", async () => {
    const { state } = createState();
    const created = createJobs(state.db, ["https://youtube.com/watch?v=missing-cover"]).created[0];

    const response = await request(state, {
      url: `/jobs/${created.id}/cover?token=test-token`,
    });

    expect(response.res.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not found" });
  });

  it("accepts bare YouTube video IDs as canonical watch URLs", async () => {
    const { state } = createState();

    const response = await request(state, {
      method: "POST",
      url: "/jobs?token=test-token",
      body: JSON.stringify({ text: "KvT4gs8wZxg", outputOption: "best-youtube" }),
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.created).toHaveLength(1);
    expect(data.created[0].url).toBe("https://www.youtube.com/watch?v=KvT4gs8wZxg");
    expect(data.rejected).toEqual([]);
  });

  it("supports byte-range audio streaming for browser preview seeking", async () => {
    const { state, project } = createState();
    const created = createJobs(state.db, ["https://youtube.com/watch?v=asset-audio"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("abcdef"));
    updateJob(state.db, created.id, { status: "complete", outputPath });

    const response = await request(state, {
      url: `/jobs/${created.id}/audio?token=test-token`,
      headers: { range: "bytes=1-3" },
    });

    expect(response.res.statusCode).toBe(206);
    expect(response.res.headers["Accept-Ranges"]).toBe("bytes");
    expect(response.res.headers["Content-Range"]).toBe("bytes 1-3/6");
    expect(response.res.headers["Content-Type"]).toBe("audio/mp4");
    expect(response.body().toString("utf8")).toBe("bcd");
  });

  it("deletes a job and removes its local conversion files", async () => {
    const { state, project } = createState();
    const created = createJobs(state.db, ["https://youtube.com/watch?v=delete-me"]).created[0];
    const sourcePath = join(project.stagingDir, `${created.id}.m4a`);
    const coverPath = join(project.artworkDir, `${created.id}.jpg`);
    const customCoverPath = join(project.artworkDir, `${created.id}-custom.png`);
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(sourcePath, Buffer.from("src"));
    writeFileSync(coverPath, Buffer.from("art"));
    writeFileSync(customCoverPath, Buffer.from("custom"));
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, created.id, {
      status: "complete",
      sourcePath,
      coverPath,
      customCoverPath,
      outputPath,
    });

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${created.id}/remove?token=test-token`,
      body: "{}",
    });

    expect(response.res.statusCode).toBe(200);
    expect(response.json().job.id).toBe(created.id);
    expect(existsSync(sourcePath)).toBe(false);
    expect(existsSync(coverPath)).toBe(false);
    expect(existsSync(customCoverPath)).toBe(false);
    expect(existsSync(outputPath)).toBe(false);
  });
});

describe("reconvert endpoints", () => {
  it("reconverts a completed job with saved source/link data and preserves approved metadata", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const created = createJobs(state.db, ["https://www.youtube.com/watch?v=reconvert-one"]).created[0];
    const sourcePath = join(project.stagingDir, `${created.id}.m4a`);
    const customCoverPath = join(project.artworkDir, `${created.id}-custom.jpg`);
    const outputPath = join(project.exportsDir, "Music Library", "Clean Artist", "Clean Album", "04 - Clean Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(sourcePath, Buffer.from("source"));
    writeFileSync(customCoverPath, Buffer.from("cover"));
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, created.id, {
      status: "complete",
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      albumArtist: "Clean Artist",
      year: "2020",
      track: "4",
      disc: "1",
      genre: "Pop",
      playlists: ["Road Trip"],
      sourcePath,
      customCoverPath,
      outputPath,
      exportStatus: "validated",
      metadataStatus: "complete",
      artworkStatus: "embedded",
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "imported",
      appleMusicPlaylistStatus: "added",
      readyForFinderSync: 1,
      syncState: "needs_manual",
      musicPersistentId: "ABC123",
    });
    let received = null;
    state.reconvertExistingJob = async (input) => {
      received = input;
      return {
        sourcePath,
        usedSavedSource: true,
        outputPath,
        sourceCodec: "aac",
        sourceContainer: "mov,mp4,m4a,3gp,3g2,mj2",
        selectedOutput: "Bass-safe AAC for iPod",
        durationSec: 180,
        sizeBytes: 1234,
        metadataStatus: "complete",
        artworkStatus: "embedded",
        warning: "Bass-safe export leaves headroom.",
      };
    };

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${created.id}/reconvert?token=test-token`,
      body: JSON.stringify({ outputOption: "ipod-safe-aac", replaceExisting: true }),
    });

    expect(response.res.statusCode).toBe(202);
    expect(response.json().result).toMatchObject({ id: created.id, accepted: true });
    await nextTick();
    expect(received.job).toMatchObject({
      id: created.id,
      url: "https://www.youtube.com/watch?v=reconvert-one",
      sourcePath,
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      customCoverPath,
      playlists: ["Road Trip"],
    });
    expect(received.outputOption).toBe("ipod-safe-aac");
    expect(getJob(state.db, created.id)).toMatchObject({
      outputOption: "ipod-safe-aac",
      selectedOutput: "Bass-safe AAC for iPod",
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      playlists: ["Road Trip"],
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "pending",
      appleMusicPlaylistStatus: "pending",
      readyForFinderSync: 0,
      syncState: "",
      musicPersistentId: "",
      exportStatus: "validated",
    });
  });

  it("processes a reconvert batch sequentially", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const first = createJobs(state.db, ["https://www.youtube.com/watch?v=reconvert-a"]).created[0];
    const second = createJobs(state.db, ["https://www.youtube.com/watch?v=reconvert-b"]).created[0];
    for (const [index, job] of [first, second].entries()) {
      const sourcePath = join(project.stagingDir, `${job.id}.m4a`);
      const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", `0${index + 1} - Song.m4a`);
      mkdirSync(join(outputPath, ".."), { recursive: true });
      writeFileSync(sourcePath, Buffer.from("source"));
      writeFileSync(outputPath, Buffer.from("audio"));
      updateJob(state.db, job.id, {
        status: "complete",
        sourcePath,
        outputPath,
        exportStatus: "validated",
        metadataReviewStatus: "approved",
        appleMusicPlaylistStatus: "added",
        readyForFinderSync: 1,
      });
    }
    const order = [];
    state.reconvertExistingJob = async ({ job, outputOption }) => {
      order.push(job.id);
      return {
        sourcePath: job.sourcePath,
        usedSavedSource: true,
        outputPath: job.outputPath,
        sourceCodec: "aac",
        sourceContainer: "mp4",
        selectedOutput: outputOption,
        durationSec: 100,
        sizeBytes: 1000,
        metadataStatus: "complete",
        artworkStatus: "embedded",
        warning: "",
      };
    };

    const response = await request(state, {
      method: "POST",
      url: "/jobs/reconvert?token=test-token",
      body: JSON.stringify({ ids: [second.id, first.id], outputOption: "ipod-safe-aac" }),
    });

    expect(response.res.statusCode).toBe(202);
    const data = response.json();
    expect(data.results).toEqual([
      expect.objectContaining({ id: second.id, accepted: true }),
      expect.objectContaining({ id: first.id, accepted: true }),
    ]);
    await nextTick();
    expect(order).toEqual([second.id, first.id]);
    expect(getJob(state.db, first.id)).toMatchObject({
      outputOption: "ipod-safe-aac",
      appleMusicPlaylistStatus: "pending",
      readyForFinderSync: 0,
    });
  });

  it("rejects reconvert when neither a source file nor saved URL is available", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const created = createJobs(state.db, ["https://www.youtube.com/watch?v=reconvert-nosource"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, created.id, {
      url: "",
      status: "complete",
      outputPath,
      sourcePath: "",
      exportStatus: "validated",
      metadataReviewStatus: "approved",
    });

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${created.id}/reconvert?token=test-token`,
      body: JSON.stringify({ outputOption: "ipod-safe-aac" }),
    });

    expect(response.res.statusCode).toBe(400);
    expect(response.json().error).toMatch(/saved YouTube URL/);
  });
});

describe("audio repair endpoints", () => {
  it("flags, dedupes, and clears per-track audio issues", async () => {
    const { state } = createState();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=audio-flags"]).created[0];

    const flagged = await request(state, {
      method: "PATCH",
      url: `/jobs/${job.id}/audio-issues?token=test-token`,
      body: JSON.stringify({
        audioIssueTags: ["bass_crackle", "bass_crackle", "left_channel_disturbance"],
        audioRepairNotes: "Crackles on old iPod.",
      }),
    });

    expect(flagged.res.statusCode).toBe(200);
    expect(flagged.json().job).toMatchObject({
      audioIssueTags: ["bass_crackle", "left_channel_disturbance"],
      audioRepairStatus: "needs_repair",
      audioRepairNotes: "Crackles on old iPod.",
    });

    const cleared = await request(state, {
      method: "PATCH",
      url: `/jobs/${job.id}/audio-issues?token=test-token`,
      body: JSON.stringify({ cleared: true }),
    });

    expect(cleared.res.statusCode).toBe(200);
    expect(cleared.json().job).toMatchObject({
      audioIssueTags: [],
      audioRepairStatus: "cleared",
      audioRepairNotes: "Crackles on old iPod.",
    });
  });

  it("stores analyze-only astats results without rewriting the export", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=audio-analyze"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, job.id, {
      status: "complete",
      outputPath,
      audioIssueTags: ["left_channel_disturbance"],
      audioRepairStatus: "needs_repair",
    });
    state.analyzeAudio = async ({ inputPath }) => ({
      analyzedAt: "2026-06-21T12:00:00.000Z",
      inputPath,
      summary: ["left channel hotter/noisier"],
      flags: { leftHotterOrNoisier: true },
      channels: [],
      comparisons: { rmsLevelDeltaDb: 2.5 },
    });

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/audio-repair?token=test-token`,
      body: JSON.stringify({ analyzeOnly: true }),
    });

    expect(response.res.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({ id: job.id, ok: true, summary: ["left channel hotter/noisier"] });
    expect(getJob(state.db, job.id)).toMatchObject({
      outputPath,
      audioRepairStatus: "needs_repair",
      audioAnalysis: {
        summary: ["left channel hotter/noisier"],
        flags: { leftHotterOrNoisier: true },
      },
    });
  });

  it("repairs a flagged track while preserving metadata, artwork, playlists, and resetting Apple Music handoff", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const created = createJobs(state.db, ["https://www.youtube.com/watch?v=audio-repair-one"]).created[0];
    const sourcePath = join(project.stagingDir, `${created.id}.m4a`);
    const customCoverPath = join(project.artworkDir, `${created.id}-custom.jpg`);
    const outputPath = join(project.exportsDir, "Music Library", "Clean Artist", "Clean Album", "04 - Clean Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(sourcePath, Buffer.from("source"));
    writeFileSync(customCoverPath, Buffer.from("cover"));
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, created.id, {
      status: "complete",
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      albumArtist: "Clean Artist",
      year: "2020",
      track: "4",
      genre: "Pop",
      playlists: ["Road Trip"],
      sourcePath,
      customCoverPath,
      outputPath,
      exportStatus: "validated",
      metadataStatus: "complete",
      artworkStatus: "embedded",
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "imported",
      appleMusicPlaylistStatus: "added",
      readyForFinderSync: 1,
      syncState: "needs_manual",
      musicPersistentId: "ABC123",
      audioIssueTags: ["left_channel_disturbance"],
      audioRepairStatus: "needs_repair",
    });
    state.analyzeAudio = async ({ kind }) => ({
      analyzedAt: `2026-06-21T12:00:0${kind === "after" ? "2" : "1"}.000Z`,
      summary: kind === "after" ? [] : ["left channel hotter/noisier"],
      flags: kind === "after" ? {} : { leftHotterOrNoisier: true },
    });
    let received = null;
    state.reconvertExistingJob = async (input) => {
      received = input;
      return {
        sourcePath,
        usedSavedSource: true,
        outputPath,
        sourceCodec: "aac",
        sourceContainer: "mp4",
        selectedOutput: "Stereo Blend Safe AAC",
        durationSec: 180,
        sizeBytes: 1234,
        metadataStatus: "complete",
        artworkStatus: "embedded",
        warning: "Stereo Blend reduces left-only artifacts.",
      };
    };

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${created.id}/audio-repair?token=test-token`,
      body: JSON.stringify({ preset: "stereo-blend-safe", replaceExisting: true }),
    });

    expect(response.res.statusCode).toBe(202);
    await nextTick();
    expect(received.outputOption).toBe("stereo-blend-safe");
    expect(received.job).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      customCoverPath,
      playlists: ["Road Trip"],
    });
    expect(getJob(state.db, created.id)).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      album: "Clean Album",
      playlists: ["Road Trip"],
      outputPath,
      outputOption: "stereo-blend-safe",
      selectedOutput: "Stereo Blend Safe AAC",
      audioIssueTags: [],
      audioRepairPreset: "stereo-blend-safe",
      audioRepairStatus: "repaired",
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "pending",
      appleMusicPlaylistStatus: "pending",
      readyForFinderSync: 0,
      syncState: "",
      musicPersistentId: "",
    });
  });

  it("processes audio repair batches sequentially", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const first = createJobs(state.db, ["https://www.youtube.com/watch?v=audio-batch-a"]).created[0];
    const second = createJobs(state.db, ["https://www.youtube.com/watch?v=audio-batch-b"]).created[0];
    for (const [index, job] of [first, second].entries()) {
      const sourcePath = join(project.stagingDir, `${job.id}.m4a`);
      const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", `0${index + 1} - Song.m4a`);
      mkdirSync(join(outputPath, ".."), { recursive: true });
      writeFileSync(sourcePath, Buffer.from("source"));
      writeFileSync(outputPath, Buffer.from("audio"));
      updateJob(state.db, job.id, {
        status: "complete",
        sourcePath,
        outputPath,
        exportStatus: "validated",
        metadataReviewStatus: "approved",
        audioIssueTags: ["bass_crackle"],
        audioRepairStatus: "needs_repair",
      });
    }
    state.analyzeAudio = async () => ({ analyzedAt: "2026-06-21T12:00:00.000Z", summary: [], flags: {} });
    const order = [];
    state.reconvertExistingJob = async ({ job, outputOption }) => {
      order.push(job.id);
      return {
        sourcePath: job.sourcePath,
        usedSavedSource: true,
        outputPath: job.outputPath,
        sourceCodec: "aac",
        sourceContainer: "mp4",
        selectedOutput: outputOption,
        durationSec: 100,
        sizeBytes: 1000,
        metadataStatus: "complete",
        artworkStatus: "embedded",
        warning: "",
      };
    };

    const response = await request(state, {
      method: "POST",
      url: "/jobs/audio-repair?token=test-token",
      body: JSON.stringify({ ids: [second.id, first.id], preset: "bass-safe-plus" }),
    });

    expect(response.res.statusCode).toBe(202);
    await nextTick();
    expect(order).toEqual([second.id, first.id]);
    expect(getJob(state.db, first.id)).toMatchObject({
      audioIssueTags: [],
      audioRepairPreset: "bass-safe-plus",
      audioRepairStatus: "repaired",
    });
  });

  it("keeps the old outputPath and handoff state when audio repair fails", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://www.youtube.com/watch?v=audio-fail"]).created[0];
    const sourcePath = join(project.stagingDir, `${job.id}.m4a`);
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(sourcePath, Buffer.from("source"));
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, job.id, {
      status: "complete",
      sourcePath,
      outputPath,
      exportStatus: "validated",
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "imported",
      appleMusicPlaylistStatus: "added",
      readyForFinderSync: 1,
      syncState: "needs_manual",
      musicPersistentId: "KEEP",
      audioIssueTags: ["bass_crackle"],
      audioRepairStatus: "needs_repair",
    });
    state.analyzeAudio = async () => ({ analyzedAt: "2026-06-21T12:00:00.000Z", summary: ["peaks too hot"], flags: { clipping: true } });
    state.reconvertExistingJob = async () => {
      throw new Error("ffmpeg repair failed");
    };

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/audio-repair?token=test-token`,
      body: JSON.stringify({ preset: "bass-safe-plus" }),
    });

    expect(response.res.statusCode).toBe(202);
    await nextTick();
    expect(getJob(state.db, job.id)).toMatchObject({
      outputPath,
      audioIssueTags: ["bass_crackle"],
      audioRepairPreset: "bass-safe-plus",
      audioRepairStatus: "failed",
      appleMusicImportStatus: "imported",
      appleMusicPlaylistStatus: "added",
      readyForFinderSync: 1,
      syncState: "needs_manual",
      musicPersistentId: "KEEP",
      lastError: "ffmpeg repair failed",
    });
  });
});

describe("iPod sync endpoints", () => {
  it("selects only new or changed tracks for Apple Music handoff", () => {
    const jobs = [
      { id: "old-1", status: "complete", outputPath: "/tmp/old-1.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "added" },
      { id: "old-2", status: "complete", outputPath: "/tmp/old-2.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "added" },
      { id: "old-3", status: "complete", outputPath: "/tmp/old-3.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "added" },
      { id: "new-1", status: "complete", outputPath: "/tmp/new-1.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "pending" },
    ];

    const selected = selectAppleMusicHandoffJobs(jobs);

    expect(selected.eligible.map((job) => job.id)).toEqual(["old-1", "old-2", "old-3", "new-1"]);
    expect(selected.pending.map((job) => job.id)).toEqual(["new-1"]);
  });

  it("preserves explicit handoff id order", () => {
    const jobs = [
      { id: "older", status: "complete", outputPath: "/tmp/older.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "pending" },
      { id: "middle", status: "complete", outputPath: "/tmp/middle.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "pending" },
      { id: "newer", status: "complete", outputPath: "/tmp/newer.m4a", exportStatus: "validated", metadataReviewStatus: "approved", appleMusicPlaylistStatus: "pending" },
    ];

    const selected = selectAppleMusicHandoffJobs(jobs, ["newer", "older"]);

    expect(selected.eligible.map((job) => job.id)).toEqual(["newer", "older"]);
    expect(selected.pending.map((job) => job.id)).toEqual(["newer", "older"]);
  });

  it("rejects an Apple Music handoff when nothing is validated", async () => {
    const { state } = createState();
    createJobs(state.db, ["https://youtube.com/watch?v=noexport"]);

    const response = await request(state, {
      method: "POST",
      url: "/ipod/handoff?token=test-token",
      body: "{}",
    });

    expect(response.res.statusCode).toBe(400);
  });

  it("rejects a validated handoff until metadata is approved", async () => {
    const { state, project } = createState();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=needsreview"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("abcdef"));
    updateJob(state.db, job.id, {
      status: "complete",
      exportStatus: "validated",
      outputPath,
      metadataReviewStatus: "needs_review",
    });

    const response = await request(state, {
      method: "POST",
      url: "/ipod/handoff?token=test-token",
      body: "{}",
    });

    expect(response.res.statusCode).toBe(400);
    expect(response.json().error).toMatch(/approved/);
  });

  it("returns a no-op when approved tracks are already in iPod Sync", async () => {
    const { state, project } = createState();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=alreadyadded"]).created[0];
    updateJob(state.db, job.id, {
      status: "complete",
      exportStatus: "validated",
      outputPath: join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a"),
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "imported",
      appleMusicPlaylistStatus: "added",
      readyForFinderSync: 1,
      syncState: "needs_manual",
    });

    const response = await request(state, {
      method: "POST",
      url: "/ipod/handoff?token=test-token",
      body: "{}",
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.noop).toBe(true);
    expect(data.message).toBe("Nothing new to add; sync in Finder.");
    expect(data.results).toEqual([]);
    expect(data.master).toBe("iPod Sync");
  });

  it("reports iPod status with pipeline counts", async () => {
    const { state } = createState();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=statuscount"]).created[0];
    updateJob(state.db, job.id, {
      status: "complete",
      exportStatus: "validated",
      outputPath: "/tmp/x.m4a",
      metadataStatus: "complete",
      artworkStatus: "embedded",
      metadataReviewStatus: "approved",
    });

    const response = await request(state, { method: "GET", url: "/ipod/status?token=test-token" });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.counts.validated).toBe(1);
    expect(data.counts.approved).toBe(1);
    expect(data.counts.metadataComplete).toBe(1);
    expect(data.master).toBe("iPod Sync");
    expect(data.folder).toBe("iListen");
  });

  it("rejects a manual iPod volume that is not an iPod", async () => {
    const { state, project } = createState();

    const response = await request(state, {
      method: "POST",
      url: "/ipod/select?token=test-token",
      body: JSON.stringify({ path: project.root }),
    });

    expect(response.res.statusCode).toBe(400);
    expect(response.json().error).toMatch(/iPod/);
  });

  it("returns an iPod detection payload shape", async () => {
    const { state } = createState();

    const response = await request(state, { method: "GET", url: "/ipod/devices?token=test-token" });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(typeof data.connected).toBe("boolean");
    expect(Array.isArray(data.mounted)).toBe(true);
    expect(Array.isArray(data.usb)).toBe(true);
  });

  it("persists uploaded custom artwork for a job", async () => {
    const { state } = createState();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=art"]).created[0];
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/artwork?token=test-token`,
      body: JSON.stringify({ dataUrl }),
    });

    expect(response.res.statusCode).toBe(200);
    expect(response.json().job.customCoverPath).toMatch(/-custom\.png$/);
  });

  it("AI-approves a completed track through the organize path", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=aiok"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Unknown Artist", "Unknown Album", "01 - Messy.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, job.id, {
      status: "complete",
      outputPath,
      metadataReviewStatus: "needs_review",
    });

    const cleanPath = join(project.exportsDir, "Music Library", "Clean Artist", "Clean Album", "04 - Clean Song.m4a");
    state.proposeAiMetadata = async () => ({
      metadata: {
        title: "Clean Song",
        artist: "Clean Artist",
        album: "Clean Album",
        albumArtist: "Clean Artist",
        year: "2020",
        genre: "Pop",
        track: "4",
        disc: "1",
        composer: "",
        comment: "Cleaned locally",
        playlists: ["Chill"],
      },
      confidence: 0.91,
      sources: ["ollama", "musicbrainz"],
      model: "llama3:latest",
      usedFallback: false,
    });
    const catalogPath = join(project.artworkDir, `${job.id}-catalog.jpg`);
    let organizedMetadata = null;
    state.fetchCatalogArtwork = async ({ metadata }) => ({
      ok: true,
      path: catalogPath,
      source: "itunes",
      metadata,
    });
    state.organizeExport = async ({ metadata }) => {
      organizedMetadata = metadata;
      return {
        ok: true,
        path: cleanPath,
        metadataPatch: metadata,
        validation: {
          metadataStatus: "complete",
          artworkStatus: "embedded",
          durationSec: 200,
          sizeBytes: 1000,
        },
      };
    };

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/ai-approve?token=test-token`,
      body: "{}",
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.result).toMatchObject({ ok: true, path: cleanPath });
    expect(data.proposal).toMatchObject({ confidence: 0.91, sources: ["ollama", "musicbrainz"] });
    expect(data.job).toMatchObject({
      title: "Clean Song",
      artist: "Clean Artist",
      metadataReviewStatus: "approved",
      aiMetadataStatus: "approved",
      aiMetadataModel: "llama3:latest",
      aiMetadataConfidence: 0.91,
      customCoverPath: catalogPath,
      appleMusicPlaylistStatus: "pending",
    });
    expect(organizedMetadata.customCoverPath).toBe(catalogPath);
    expect(listMetadataExamples(state.db)[0]).toMatchObject({
      source: "ai_approval",
      output: { title: "Clean Song", customCoverPath: catalogPath },
    });
  });

  it("holds AI approval in review when trusted catalog artwork is missing", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=ainoart"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, job.id, { status: "complete", outputPath, metadataReviewStatus: "needs_review" });
    state.proposeAiMetadata = async () => ({
      metadata: {
        title: "Clean Song",
        artist: "Clean Artist",
        album: "Clean Album",
        albumArtist: "Clean Artist",
        year: "2020",
        genre: "",
        track: "1",
        disc: "",
        composer: "",
        comment: "",
        playlists: [],
      },
      confidence: 0.88,
      sources: ["itunes", "evidence-shortcut"],
      model: "evidence-only",
    });
    state.fetchCatalogArtwork = async () => ({
      ok: false,
      error: "Trusted catalog artwork was not found. Review artwork manually.",
    });
    let organized = false;
    state.organizeExport = async () => {
      organized = true;
      return { ok: true };
    };

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/ai-approve?token=test-token`,
      body: "{}",
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.result).toMatchObject({ ok: false, error: "Trusted catalog artwork was not found. Review artwork manually." });
    expect(data.job).toMatchObject({
      metadataReviewStatus: "needs_review",
      aiMetadataStatus: "failed",
      lastError: "Trusted catalog artwork was not found. Review artwork manually.",
    });
    expect(organized).toBe(false);
  });

  it("rejects AI approval before a track has an output file", async () => {
    const { state } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=aipending"]).created[0];
    updateJob(state.db, job.id, { status: "complete", metadataReviewStatus: "needs_review" });

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/ai-approve?token=test-token`,
      body: "{}",
    });

    expect(response.res.statusCode).toBe(400);
    expect(response.json().error).toMatch(/converted/);
  });

  it("leaves a row unapproved with an actionable error when the local model times out", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=ainomodel"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, job.id, { status: "complete", outputPath, metadataReviewStatus: "needs_review" });
    state.proposeAiMetadata = async () => {
      throw new Error("Local metadata model timed out. Try qwen:1.8b or restart Ollama.");
    };

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/ai-approve?token=test-token`,
      body: "{}",
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.result.ok).toBe(false);
    expect(data.job.metadataReviewStatus).toBe("needs_review");
    expect(data.job.aiMetadataStatus).toBe("failed");
    expect(data.job.lastError).toBe("Local metadata model timed out. Try qwen:1.8b or restart Ollama.");
    const log = data.logs.find((entry) => entry.msg.includes("AI metadata failed"));
    expect(log.msg).toContain("model=qwen:1.8b");
    expect(log.msg).toContain("timeout=45000ms");
    expect(log.msg).toMatch(/elapsed=\d+ms/);
  });

  it("keeps AI-approved metadata unapproved when organize or retag fails", async () => {
    const { state, project } = createState();
    state.tools = readyTools();
    const job = createJobs(state.db, ["https://youtube.com/watch?v=airetagfail"]).created[0];
    const outputPath = join(project.exportsDir, "Music Library", "Artist", "Album", "01 - Song.m4a");
    mkdirSync(join(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, Buffer.from("audio"));
    updateJob(state.db, job.id, { status: "complete", outputPath, metadataReviewStatus: "needs_review" });
    state.proposeAiMetadata = async () => ({
      metadata: {
        title: "Clean Song",
        artist: "Clean Artist",
        album: "Clean Album",
        albumArtist: "Clean Artist",
        year: "",
        genre: "",
        track: "1",
        disc: "",
        composer: "",
        comment: "",
        playlists: [],
      },
      confidence: 0.7,
      sources: ["ollama"],
      model: "llama3:latest",
    });
    state.fetchCatalogArtwork = async () => ({
      ok: true,
      path: join(project.artworkDir, `${job.id}-catalog.jpg`),
      source: "itunes",
    });
    state.organizeExport = async ({ metadata }) => ({
      ok: false,
      path: outputPath,
      metadataPatch: metadata,
      error: "ffmpeg retag failed",
    });

    const response = await request(state, {
      method: "POST",
      url: `/jobs/${job.id}/ai-approve?token=test-token`,
      body: "{}",
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.result).toMatchObject({ ok: false, error: "ffmpeg retag failed" });
    expect(data.job).toMatchObject({
      title: "Clean Song",
      metadataReviewStatus: "needs_review",
      aiMetadataStatus: "failed",
      exportStatus: "invalid",
      lastError: "ffmpeg retag failed",
    });
  });
});

describe("Apple Music library import endpoints", () => {
  const LIBRARY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Tracks</key>
  <dict>
    <key>101</key>
    <dict><key>Track ID</key><integer>101</integer><key>Name</key><string>Apocalypse</string><key>Artist</key><string>Cigarettes After Sex</string><key>Total Time</key><integer>290000</integer></dict>
  </dict>
  <key>Playlists</key>
  <array>
    <dict><key>Name</key><string>Chill</string><key>Playlist Items</key><array><dict><key>Track ID</key><integer>101</integer></dict></array></dict>
  </array>
</dict>
</plist>`;

  it("parses an uploaded library and flags tracks already in the database", async () => {
    const { state } = createState();
    const existing = createJobs(state.db, ["https://youtube.com/watch?v=dup"]).created[0];
    updateJob(state.db, existing.id, { title: "Apocalypse", artist: "Cigarettes After Sex" });

    const response = await request(state, {
      method: "POST",
      url: "/library/parse?token=test-token",
      body: JSON.stringify({ xml: LIBRARY_XML }),
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.playlists).toHaveLength(1);
    expect(data.playlists[0]).toMatchObject({ name: "Chill", trackCount: 1 });
    expect(data.tracksById["101"]).toMatchObject({ title: "Apocalypse", existing: true });
  });

  it("rejects a file that is not a library export", async () => {
    const { state } = createState();
    const response = await request(state, {
      method: "POST",
      url: "/library/parse?token=test-token",
      body: JSON.stringify({ xml: "not a plist" }),
    });
    expect(response.res.statusCode).toBe(400);
  });

  it("searches selected tracks through an injectable search implementation", async () => {
    const { state } = createState();
    state.searchTracks = async (tracks) =>
      tracks.map((track) => ({ id: track.id, query: track.title, candidates: [], best: null, flagged: true }));

    const response = await request(state, {
      method: "POST",
      url: "/library/search?token=test-token",
      body: JSON.stringify({ tracks: [{ id: 101, title: "Apocalypse", artist: "Cigarettes After Sex" }] }),
    });

    expect(response.res.statusCode).toBe(200);
    expect(response.json().results[0]).toMatchObject({ id: 101, query: "Apocalypse" });
  });

  it("imports approved matches as jobs seeded with clean metadata and playlists", async () => {
    const { state } = createState();
    const response = await request(state, {
      method: "POST",
      url: "/library/import?token=test-token",
      body: JSON.stringify({
        autoStart: false,
        matches: [
          {
            youtubeUrl: "https://www.youtube.com/watch?v=sElE_BfQ67s",
            metadata: { title: "Apocalypse", artist: "Cigarettes After Sex", album: "Cigarettes After Sex", year: "2017", track: "4" },
            playlists: ["Chill"],
          },
        ],
      }),
    });

    expect(response.res.statusCode).toBe(200);
    const data = response.json();
    expect(data.created).toHaveLength(1);
    expect(data.created[0]).toMatchObject({
      title: "Apocalypse",
      artist: "Cigarettes After Sex",
      album: "Cigarettes After Sex",
      year: "2017",
      track: "4",
      playlists: ["Chill"],
      status: "queued",
    });
    expect(data.sourceBatch).toMatch(/^xml-import-/);
  });

  it("rejects an import with no valid YouTube links", async () => {
    const { state } = createState();
    const response = await request(state, {
      method: "POST",
      url: "/library/import?token=test-token",
      body: JSON.stringify({ matches: [{ youtubeUrl: "https://example.com/not-youtube" }] }),
    });
    expect(response.res.statusCode).toBe(400);
  });
});
