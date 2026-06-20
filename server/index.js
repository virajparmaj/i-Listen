import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addLog, addMetadataExample, createJobs, createJobsFromMatches, existingTrackKeys, getJob, getState, listJobs, listLogs, listMetadataExamples, openDatabase, removeJob, setState, trackKey, updateJob } from "./lib/db.js";
import { JobRunner, writePlaylists } from "./lib/converter.js";
import { parseLibraryXml } from "./lib/libraryXml.js";
import { searchTracks } from "./lib/youtubeSearch.js";
import { isYoutubeUrl } from "./lib/youtube.js";
import { retagExport } from "./lib/retag.js";
import { cleanupStaleIlistenPlaylists, classifyOsascriptError, handoffToAppleMusic, ILISTEN_FOLDER, MASTER_PLAYLIST } from "./lib/appleMusic.js";
import { detectIpods, verifyIpodVolume } from "./lib/ipod.js";
import { appendFileLog } from "./lib/filelog.js";
import { organizeExport } from "./lib/organize.js";
import { downloadCatalogArtwork } from "./lib/catalogArtwork.js";
import {
  DEFAULT_METADATA_PREFLIGHT_TIMEOUT_MS,
  checkOllamaMetadataHealth,
  metadataModelFromEnv,
  metadataTimeoutMsFromEnv,
  ollamaUrlFromEnv,
  proposeAiMetadata,
} from "./lib/metadataAi.js";
import { detectTools } from "./lib/tools.js";
import { DEFAULT_PROJECT_PATH, ensureProject } from "./lib/paths.js";
import { splitYoutubeUrls } from "./lib/youtube.js";

const PORT = Number(process.env.ILISTEN_PORT || 4317);
const AI_METADATA_HEALTH_CACHE_MS = 30000;

function parseAllowedOrigins(value = process.env.ILISTEN_ALLOWED_ORIGINS || "") {
  return new Set(String(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean));
}

export function createAppState() {
  return {
    token: null,
    project: null,
    db: null,
    tools: detectTools(),
    runner: null,
    clients: new Set(),
    aiMetadataHealthCache: null,
  };
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

function corsHeaders(req, allowedOrigins) {
  const origin = req.headers.origin;
  const headers = {
    "Access-Control-Allow-Headers": "content-type, x-ilisten-token",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    Vary: "Origin, Access-Control-Request-Private-Network",
  };
  if (isAllowedOrigin(origin, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = origin || "*";
    if (req.headers["access-control-request-private-network"] === "true") {
      headers["Access-Control-Allow-Private-Network"] = "true";
    }
  }
  return headers;
}

function send(res, req, allowedOrigins, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(req, allowedOrigins),
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function notFound(res, req, allowedOrigins) {
  send(res, req, allowedOrigins, 404, { error: "Not found" });
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function ensureToken(state) {
  if (!state.token) state.token = randomBytes(24).toString("hex");
  return state.token;
}

function authed(req, state) {
  if (!state.token) return false;
  const url = new URL(req.url, `http://${req.headers.host}`);
  return req.headers["x-ilisten-token"] === state.token || url.searchParams.get("token") === state.token;
}

function requireAuth(req, res, state, allowedOrigins) {
  if (authed(req, state)) return true;
  send(res, req, allowedOrigins, 401, { error: "Pair with the local helper first." });
  return false;
}

function requireProject(req, res, state, allowedOrigins) {
  if (state.db && state.project) return true;
  send(res, req, allowedOrigins, 409, { error: "Open a project folder first." });
  return false;
}

function emit(state, payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  state.clients.forEach((client) => client.write(data));
}

function appleMusicEligible(job) {
  return job.status === "complete"
    && job.outputPath
    && job.exportStatus !== "invalid"
    && job.metadataReviewStatus === "approved";
}

export function selectAppleMusicHandoffJobs(jobs, ids = null) {
  const byId = Array.isArray(ids) ? new Map(jobs.map((job) => [job.id, job])) : null;
  const scoped = byId ? ids.map((id) => byId.get(id)).filter(Boolean) : jobs;
  const eligible = scoped.filter(appleMusicEligible);
  const pending = eligible.filter((job) => job.appleMusicPlaylistStatus !== "added");
  return { eligible, pending };
}

export function openProjectState(state, projectPath = DEFAULT_PROJECT_PATH) {
  state.project = ensureProject(projectPath);
  state.db = openDatabase(state.project.dbPath);
  state.tools = detectTools();
  state.runner = new JobRunner({
    db: state.db,
    project: state.project,
    tools: state.tools,
    emit: (payload) => emit(state, payload),
  });
  addLog(state.db, `Opened ${state.project.root}`, "ok", "Project:");
  emit(state, { type: "project", project: state.project, tools: state.tools, jobs: listJobs(state.db), logs: listLogs(state.db) });
}

function contentTypeFor(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".m4a":
      return "audio/mp4";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

function parseRangeHeader(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return { invalid: true };

  const [, startText, endText] = match;
  if (!startText && !endText) return { invalid: true };

  let start = startText ? Number(startText) : NaN;
  let end = endText ? Number(endText) : NaN;

  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    if (!Number.isFinite(start) || start < 0 || start >= size) return { invalid: true };
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (end < start) return { invalid: true };
  }

  return { start, end };
}

async function serveJobAsset(req, res, state, allowedOrigins, job, filePath, kind) {
  if (!job || !filePath) {
    notFound(res, req, allowedOrigins);
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    notFound(res, req, allowedOrigins);
    return;
  }

  const headers = {
    ...corsHeaders(req, allowedOrigins),
    "Cache-Control": "private, max-age=300",
    "Content-Type": contentTypeFor(filePath),
  };

  if (kind === "audio") {
    headers["Accept-Ranges"] = "bytes";
    const range = parseRangeHeader(req.headers.range, fileStat.size);
    if (range?.invalid) {
      res.writeHead(416, {
        ...headers,
        "Content-Range": `bytes */${fileStat.size}`,
      });
      res.end();
      return;
    }

    if (range) {
      const { start, end } = range;
      res.writeHead(206, {
        ...headers,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, {
    ...headers,
    "Content-Length": fileStat.size,
  });
  createReadStream(filePath).pipe(res);
}

async function handleEvents(req, res, state, allowedOrigins) {
  if (!requireAuth(req, res, state, allowedOrigins)) return;
  res.writeHead(200, {
    ...corsHeaders(req, allowedOrigins),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify({
    type: "hello",
    project: state.project,
    tools: state.tools,
    jobs: state.db ? listJobs(state.db) : [],
    logs: state.db ? listLogs(state.db) : [],
  })}\n\n`);
  state.clients.add(res);
  req.on("close", () => state.clients.delete(res));
}

const METADATA_KEYS = [
  "title", "artist", "album", "albumArtist", "year", "genre",
  "track", "disc", "composer", "comment", "customCoverPath", "playlists",
];

function metaTouched(patch) {
  return Object.keys(patch || {}).some((key) => METADATA_KEYS.includes(key));
}

function isoNow() {
  return new Date().toISOString();
}

function metadataExample(job = {}) {
  return Object.fromEntries(METADATA_KEYS
    .filter((key) => key !== "customCoverPath")
    .map((key) => [key, key === "playlists" ? job.playlists || [] : job[key] || ""]));
}

function proposalForClient(proposal = {}) {
  return {
    metadata: proposal.metadata || {},
    confidence: proposal.confidence ?? null,
    sources: proposal.sources || [],
    model: proposal.model || "",
    usedFallback: Boolean(proposal.usedFallback),
    parseError: proposal.parseError || "",
  };
}

async function aiMetadataReadiness(state) {
  const model = metadataModelFromEnv();
  const ollamaUrl = ollamaUrlFromEnv();
  const timeoutMs = metadataTimeoutMsFromEnv();
  const key = `${model}\n${ollamaUrl}`;
  const nowMs = Date.now();
  const cached = state.aiMetadataHealthCache;
  if (cached?.key === key && cached.expiresAt > nowMs) {
    return { ...cached.value, model, timeoutMs };
  }

  const preflight = await checkOllamaMetadataHealth({
    model,
    ollamaUrl,
    fetchImpl: state.aiMetadataHealthFetch || fetch,
    timeoutMs: DEFAULT_METADATA_PREFLIGHT_TIMEOUT_MS,
  });
  const value = {
    ok: preflight.ok,
    model,
    error: preflight.error || "",
    timeoutMs,
    preflightTimeoutMs: preflight.timeoutMs,
    elapsedMs: preflight.elapsedMs,
    checkedAt: isoNow(),
  };
  state.aiMetadataHealthCache = {
    key,
    value,
    expiresAt: nowMs + AI_METADATA_HEALTH_CACHE_MS,
  };
  return value;
}

async function runAiApprove(state, job) {
  const model = metadataModelFromEnv();
  const ollamaUrl = ollamaUrlFromEnv();
  const timeoutMs = metadataTimeoutMsFromEnv();
  const propose = state.proposeAiMetadata || proposeAiMetadata;
  const organize = state.organizeExport || organizeExport;
  const fetchArtwork = state.fetchCatalogArtwork || downloadCatalogArtwork;
  const startedAt = isoNow();
  const startedMs = Date.now();

  updateJob(state.db, job.id, {
    aiMetadataStatus: "running",
    aiMetadataModel: model,
    aiMetadataConfidence: null,
    aiMetadataSources: [],
    aiMetadataError: "",
    aiMetadataUpdatedAt: startedAt,
    lastError: "",
  });
  addLog(state.db, `AI metadata cleanup started for ${job.title}.`, null, "AI:");
  emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });

  let proposal;
  try {
    proposal = await propose(job, {
      tools: state.tools,
      project: state.project,
      examples: listMetadataExamples(state.db, 25),
      model,
      ollamaUrl,
      timeoutMs,
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedMs;
    const failed = updateJob(state.db, job.id, {
      metadataReviewStatus: "needs_review",
      aiMetadataStatus: "failed",
      aiMetadataModel: model,
      aiMetadataConfidence: null,
      aiMetadataSources: [],
      aiMetadataError: error.message,
      aiMetadataUpdatedAt: isoNow(),
      lastError: error.message,
    });
    addLog(state.db, `AI metadata failed for ${job.title}: ${error.message} (model=${model}, timeout=${timeoutMs}ms, elapsed=${elapsedMs}ms)`, "err", "AI:");
    emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
    return { proposal: null, result: { id: job.id, ok: false, error: error.message }, job: failed };
  }

  try {
    const artwork = await fetchArtwork({
      project: state.project,
      job,
      metadata: proposal.metadata,
      context: proposal.context || {},
      fetchImpl: state.catalogArtworkFetch || fetch,
    });
    if (!artwork.ok) {
      const failed = updateJob(state.db, job.id, {
        metadataReviewStatus: "needs_review",
        aiMetadataStatus: "failed",
        aiMetadataModel: proposal.model || model,
        aiMetadataConfidence: proposal.confidence,
        aiMetadataSources: proposal.sources,
        aiMetadataError: artwork.error,
        aiMetadataUpdatedAt: isoNow(),
        lastError: artwork.error,
      });
      addLog(state.db, `AI metadata held for ${job.title}: ${artwork.error}`, "warn", "AI:");
      emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
      return { proposal: proposalForClient(proposal), result: { id: job.id, ok: false, error: artwork.error }, job: failed };
    }

    const metadata = { ...proposal.metadata, customCoverPath: artwork.path };
    const organized = await organize({ project: state.project, tools: state.tools, job, metadata });
    if (!organized.ok) {
      const failed = updateJob(state.db, job.id, {
        ...organized.metadataPatch,
        outputPath: organized.path || job.outputPath,
        exportStatus: "invalid",
        metadataReviewStatus: "needs_review",
        aiMetadataStatus: "failed",
        aiMetadataModel: proposal.model || model,
        aiMetadataConfidence: proposal.confidence,
        aiMetadataSources: proposal.sources,
        aiMetadataError: organized.error,
        aiMetadataUpdatedAt: isoNow(),
        lastError: organized.error,
      });
      addLog(state.db, `AI organize failed for ${job.title}: ${organized.error}`, "err", "AI:");
      emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
      return { proposal: proposalForClient(proposal), result: { id: job.id, ok: false, error: organized.error }, job: failed };
    }

    const updated = updateJob(state.db, job.id, {
      ...organized.metadataPatch,
      outputPath: organized.path,
      exportStatus: "validated",
      metadataStatus: organized.validation.metadataStatus,
      artworkStatus: organized.validation.artworkStatus,
      durationSec: organized.validation.durationSec,
      sizeBytes: organized.validation.sizeBytes,
      metadataReviewStatus: "approved",
      appleMusicImportStatus: "pending",
      appleMusicPlaylistStatus: "pending",
      readyForFinderSync: 0,
      syncState: "",
      musicPersistentId: "",
      lastError: "",
      aiMetadataStatus: "approved",
      aiMetadataModel: proposal.model || model,
      aiMetadataConfidence: proposal.confidence,
      aiMetadataSources: proposal.sources,
      aiMetadataError: "",
      aiMetadataUpdatedAt: isoNow(),
    });
    addMetadataExample(state.db, {
      jobId: job.id,
      source: "ai_approval",
      input: { before: metadataExample(job), evidence: proposal.context || {}, sources: proposal.sources || [] },
      output: metadata,
    });
    addLog(state.db, `AI approved and organized ${updated.artist} — ${updated.title}.`, "ok", "AI:");
    emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
    return { proposal: proposalForClient(proposal), result: { id: job.id, ok: true, path: organized.path }, job: updated };
  } catch (error) {
    const failed = updateJob(state.db, job.id, {
      metadataReviewStatus: "needs_review",
      aiMetadataStatus: "failed",
      aiMetadataModel: proposal.model || model,
      aiMetadataConfidence: proposal.confidence,
      aiMetadataSources: proposal.sources,
      aiMetadataError: error.message,
      aiMetadataUpdatedAt: isoNow(),
      lastError: error.message,
    });
    addLog(state.db, `AI metadata error for ${job.title}: ${error.message}`, "err", "AI:");
    emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
    return { proposal: proposalForClient(proposal), result: { id: job.id, ok: false, error: error.message }, job: failed };
  }
}

/**
 * Re-tag an already-exported file in place so Apple Music ingests fresh tags,
 * then reset its downstream sync status. Runs in the background; emits when done.
 */
async function runRetag(state, id) {
  const job = getJob(state.db, id);
  if (!job || job.status !== "complete" || !job.outputPath) return;
  if (!state.tools?.ffmpeg?.ok || !state.tools?.ffprobe?.ok) {
    addLog(state.db, "Cannot re-tag: ffmpeg/ffprobe unavailable.", "warn", "Retag:");
    emit(state, { type: "logs", logs: listLogs(state.db) });
    return;
  }

  // Guard against concurrent ffmpeg rewrites of the same output file.
  if (!state.retagging) state.retagging = new Set();
  if (state.retagging.has(id)) return;
  state.retagging.add(id);

  updateJob(state.db, id, {
    appleMusicImportStatus: "pending",
    appleMusicPlaylistStatus: "pending",
    readyForFinderSync: 0,
    syncState: "",
  });

  try {
    const result = await retagExport(state.tools, job);
    if (result.ok) {
      updateJob(state.db, id, {
        exportStatus: "validated",
        metadataStatus: result.metadataStatus,
        artworkStatus: result.artworkStatus,
        durationSec: result.durationSec,
        sizeBytes: result.sizeBytes,
        lastError: "",
      });
      addLog(state.db, `Re-tagged ${job.title}; re-add to Apple Music to refresh.`, "ok", "Retag:");
      void appendFileLog(state.project, "applemusic.log", `retag ok: ${job.outputPath}`);
    } else {
      updateJob(state.db, id, { exportStatus: "invalid", lastError: result.error });
      addLog(state.db, `Re-tag failed for ${job.title}: ${result.error}`, "err", "Retag:");
      void appendFileLog(state.project, "applemusic.log", `retag fail: ${job.outputPath} :: ${result.error}`);
    }
  } catch (error) {
    updateJob(state.db, id, { lastError: error.message });
    addLog(state.db, `Re-tag error for ${job.title}: ${error.message}`, "err", "Retag:");
  } finally {
    state.retagging.delete(id);
  }
  emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
}

/**
 * Decode a base64 image data URL and persist it as the job's custom cover.
 * @returns {Promise<{ ok: boolean, path?: string, error?: string }>}
 */
async function persistArtwork(project, id, dataUrl) {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(String(dataUrl || ""));
  if (!match) return { ok: false, error: "Expected a base64 image data URL (png, jpeg, or webp)." };
  const ext = match[1].toLowerCase() === "jpeg" || match[1].toLowerCase() === "jpg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  const path = join(project.artworkDir, `${id}-custom.${ext}`);
  await mkdir(project.artworkDir, { recursive: true });
  await writeFile(path, buffer);
  return { ok: true, path };
}

function isWithinDir(filePath, dirPath) {
  const rel = relative(resolve(dirPath), resolve(filePath));
  return Boolean(rel) && !rel.startsWith("..") && !isAbsolute(rel);
}

async function removeFileAndEmptyParents(filePath, rootDir) {
  try {
    await stat(filePath);
  } catch {
    return false;
  }

  await rm(filePath, { force: true });

  let current = dirname(filePath);
  const boundary = resolve(rootDir);
  while (current !== boundary && isWithinDir(current, boundary)) {
    const entries = await readdir(current).catch(() => null);
    if (!entries || entries.length) break;
    await rm(current, { recursive: true, force: true });
    current = dirname(current);
  }
  return true;
}

async function removeJobArtifacts(project, job) {
  const candidates = [
    [job.outputPath, project.exportsDir],
    [job.sourcePath, project.stagingDir],
    [job.coverPath, project.artworkDir],
    [job.customCoverPath, project.artworkDir],
  ];
  const files = new Map();

  candidates.forEach(([filePath, rootDir]) => {
    if (!filePath || !rootDir) return;
    if (!isWithinDir(filePath, rootDir)) return;
    files.set(resolve(filePath), rootDir);
  });

  const removedPaths = [];
  for (const [filePath, rootDir] of files.entries()) {
    if (await removeFileAndEmptyParents(filePath, rootDir)) removedPaths.push(filePath);
  }
  return removedPaths;
}

/**
 * Start a list of jobs in the background through a small concurrency pool so an
 * XML import does not spawn dozens of yt-dlp/ffmpeg processes at once. Failures
 * are logged; the per-job runner already records them on the job itself.
 */
function startJobsInBackground(state, ids, limit = 2) {
  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await state.runner.startJob(id);
      } catch (error) {
        addLog(state.db, error.message, "err", "Failed:");
        emit(state, { type: "logs", logs: listLogs(state.db) });
      }
    }
  };
  const workers = Array.from({ length: Math.min(limit, ids.length) }, () => worker());
  Promise.all(workers).catch(() => {});
}

/**
 * Shape a parsed library for the client: ordered playlists plus a track catalog
 * annotated with whether each song is already in the local database.
 */
function libraryForClient(db, library) {
  const existing = existingTrackKeys(db);
  const tracks = Object.values(library.tracksById).map((track) => ({
    ...track,
    existing: existing.has(trackKey(track.artist, track.title)),
  }));
  const tracksById = Object.fromEntries(tracks.map((track) => [String(track.id), track]));
  return { playlists: library.playlists, tracksById };
}

export async function route(req, res, state, allowedOrigins) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!isAllowedOrigin(req.headers.origin, allowedOrigins)) {
    send(res, req, allowedOrigins, 403, { error: "Origin is not allowed by this local helper." });
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req, allowedOrigins));
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    state.tools = detectTools();
    if (state.runner) state.runner.tools = state.tools;
    const aiMetadata = await aiMetadataReadiness(state);
    send(res, req, allowedOrigins, 200, {
      ok: true,
      paired: Boolean(state.token),
      project: state.project,
      tools: state.tools,
      aiMetadata,
      jobs: state.db ? listJobs(state.db) : [],
      logs: state.db ? listLogs(state.db) : [],
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/pair") {
    const token = ensureToken(state);
    send(res, req, allowedOrigins, 200, { token, helperUrl: `http://127.0.0.1:${PORT}` });
    return;
  }

  if (req.method === "GET" && url.pathname === "/events") {
    await handleEvents(req, res, state, allowedOrigins);
    return;
  }

  const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)(?:\/([^/]+))?$/);
  if (req.method === "GET" && jobMatch) {
    const [, id, action] = jobMatch;

    if (action === "cover") {
      if (!requireProject(req, res, state, allowedOrigins)) return;
      const job = getJob(state.db, id);
      await serveJobAsset(req, res, state, allowedOrigins, job, job?.customCoverPath || job?.coverPath, "cover");
      return;
    }

    if (action === "audio") {
      if (!requireProject(req, res, state, allowedOrigins)) return;
      const job = getJob(state.db, id);
      await serveJobAsset(req, res, state, allowedOrigins, job, job?.outputPath, "audio");
      return;
    }
  }

  if (!requireAuth(req, res, state, allowedOrigins)) return;

  if (req.method === "POST" && url.pathname === "/projects/open") {
    const body = await readJson(req);
    openProjectState(state, body.path);
    send(res, req, allowedOrigins, 200, {
      project: state.project,
      tools: state.tools,
      jobs: listJobs(state.db),
      logs: listLogs(state.db),
    });
    return;
  }

  if (!requireProject(req, res, state, allowedOrigins)) return;

  if (req.method === "GET" && url.pathname === "/jobs") {
    send(res, req, allowedOrigins, 200, { jobs: listJobs(state.db), logs: listLogs(state.db) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/jobs") {
    const body = await readJson(req);
    const { accepted, rejected } = splitYoutubeUrls(Array.isArray(body.urls) ? body.urls.join("\n") : body.text);
    if (!accepted.length) {
      send(res, req, allowedOrigins, 400, { error: "Paste one or more valid YouTube links.", rejected });
      return;
    }
    const result = createJobs(state.db, accepted, body.outputOption || "best-youtube");
    addLog(state.db, `Added ${result.created.length} YouTube link${result.created.length === 1 ? "" : "s"}.`, null, "Queue:");
    if (rejected.length) addLog(state.db, `${rejected.length} non-YouTube link${rejected.length === 1 ? "" : "s"} rejected.`, "warn", "Queue:");
    emit(state, { type: "jobs", jobs: result.jobs, logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, { ...result, rejected });
    return;
  }

  if (req.method === "POST" && url.pathname === "/library/parse") {
    const body = await readJson(req);
    let library;
    try {
      library = parseLibraryXml(body.xml);
    } catch (error) {
      send(res, req, allowedOrigins, 400, { error: error.message });
      return;
    }
    const shaped = libraryForClient(state.db, library);
    addLog(state.db, `Parsed library: ${shaped.playlists.length} playlist${shaped.playlists.length === 1 ? "" : "s"}, ${Object.keys(shaped.tracksById).length} track${Object.keys(shaped.tracksById).length === 1 ? "" : "s"}.`, "ok", "Import:");
    emit(state, { type: "logs", logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, { ...shaped, logs: listLogs(state.db) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/library/search") {
    if (!state.tools?.ytdlp?.ok) {
      send(res, req, allowedOrigins, 409, { error: "yt-dlp is required to search YouTube." });
      return;
    }
    const body = await readJson(req);
    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    if (!tracks.length) {
      send(res, req, allowedOrigins, 400, { error: "Select one or more tracks to search for." });
      return;
    }
    const search = state.searchTracks || searchTracks;
    const results = await search(tracks, {
      ytdlpPath: state.tools.ytdlp.path,
      onProgress: ({ done, total }) => emit(state, { type: "library-search", done, total }),
    });
    send(res, req, allowedOrigins, 200, { results });
    return;
  }

  if (req.method === "POST" && url.pathname === "/library/import") {
    const body = await readJson(req);
    const matches = (Array.isArray(body.matches) ? body.matches : [])
      .filter((match) => isYoutubeUrl(match?.youtubeUrl));
    if (!matches.length) {
      send(res, req, allowedOrigins, 400, { error: "Provide one or more approved matches with valid YouTube links." });
      return;
    }

    const sourceBatch = `xml-import-${Date.now()}`;
    const result = createJobsFromMatches(state.db, matches, {
      outputOption: body.outputOption || "best-youtube",
      sourceBatch,
    });
    addLog(state.db, `Imported ${result.created.length} track${result.created.length === 1 ? "" : "s"} from Apple Music library.${result.skipped.length ? ` ${result.skipped.length} skipped (already queued).` : ""}`, "ok", "Import:");
    emit(state, { type: "jobs", jobs: result.jobs, logs: listLogs(state.db) });

    const autoStart = body.autoStart !== false;
    if (autoStart && state.runner && result.created.length) {
      startJobsInBackground(state, result.created.map((job) => job.id), 2);
    }
    send(res, req, allowedOrigins, 200, { ...result, sourceBatch, autoStarted: autoStart });
    return;
  }

  if (jobMatch) {
    const [, id, action] = jobMatch;
    const job = getJob(state.db, id);

    if (req.method === "POST" && action === "ai-approve") {
      if (!job) {
        send(res, req, allowedOrigins, 404, { error: "Job not found" });
        return;
      }
      if (job.status !== "complete" || !job.outputPath) {
        send(res, req, allowedOrigins, 400, { error: "Track must be converted before AI metadata approval." });
        return;
      }
      if (!state.tools?.ffmpeg?.ok || !state.tools?.ffprobe?.ok) {
        send(res, req, allowedOrigins, 409, { error: "ffmpeg and ffprobe are required to organize and retag exports." });
        return;
      }

      const outcome = await runAiApprove(state, job);
      send(res, req, allowedOrigins, 200, {
        ...outcome,
        jobs: listJobs(state.db),
        logs: listLogs(state.db),
      });
      return;
    }

    if (req.method === "PATCH" && !action) {
      const body = await readJson(req);
      const before = getJob(state.db, id);
      const patch = { ...body };
      if (before && before.status === "complete" && metaTouched(body) && !body.metadataReviewStatus) {
        patch.metadataReviewStatus = "needs_review";
        patch.appleMusicImportStatus = "pending";
        patch.appleMusicPlaylistStatus = "pending";
        patch.readyForFinderSync = 0;
        patch.syncState = "";
      }
      const job = updateJob(state.db, id, patch);
      if (before && before.status === "complete" && metaTouched(body)) {
        addMetadataExample(state.db, {
          jobId: id,
          source: "manual_edit",
          input: { before: metadataExample(before) },
          output: metadataExample(job),
        });
      }
      emit(state, { type: "jobs", jobs: listJobs(state.db) });
      send(res, req, allowedOrigins, 200, { job, jobs: listJobs(state.db) });
      if (before && before.status === "complete" && metaTouched(body)) void runRetag(state, id);
      return;
    }

    if (req.method === "POST" && action === "start") {
      if (!job) {
        send(res, req, allowedOrigins, 404, { error: "Job not found" });
        return;
      }
      state.runner.startJob(id).catch((error) => {
        addLog(state.db, error.message, "err", "Failed:");
        emit(state, { type: "logs", logs: listLogs(state.db) });
      });
      send(res, req, allowedOrigins, 202, { job: getJob(state.db, id), jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "cancel") {
      const job = state.runner.cancelJob(id);
      emit(state, { type: "jobs", jobs: listJobs(state.db) });
      send(res, req, allowedOrigins, 200, { job, jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "retry") {
      const job = updateJob(state.db, id, { status: "queued", progress: 0, error: "", warning: "" });
      emit(state, { type: "jobs", jobs: listJobs(state.db) });
      send(res, req, allowedOrigins, 200, { job, jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "remove") {
      if (!job) {
        send(res, req, allowedOrigins, 404, { error: "Job not found" });
        return;
      }
      const removedPaths = await removeJobArtifacts(state.project, job);
      const deleted = removeJob(state.db, id);
      const fileCount = removedPaths.length;
      addLog(
        state.db,
        `Deleted ${job.artist} — ${job.title}.${fileCount ? ` Removed ${fileCount} local file${fileCount === 1 ? "" : "s"}.` : ""}`,
        "ok",
        "Delete:"
      );
      emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
      send(res, req, allowedOrigins, 200, { job: deleted, removedPaths, jobs: listJobs(state.db), logs: listLogs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "retag") {
      if (!job) {
        send(res, req, allowedOrigins, 404, { error: "Job not found" });
        return;
      }
      send(res, req, allowedOrigins, 202, { job: getJob(state.db, id), jobs: listJobs(state.db) });
      void runRetag(state, id);
      return;
    }

    if (req.method === "POST" && action === "artwork") {
      if (!job) {
        send(res, req, allowedOrigins, 404, { error: "Job not found" });
        return;
      }
      const body = await readJson(req);
      const saved = await persistArtwork(state.project, id, body.dataUrl);
      if (!saved.ok) {
        send(res, req, allowedOrigins, 400, { error: saved.error });
        return;
      }
      updateJob(state.db, id, { customCoverPath: saved.path, artworkStatus: "external" });
      addLog(state.db, `Saved custom artwork for ${job.title}.`, "ok", "Artwork:");
      emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
      send(res, req, allowedOrigins, 200, { job: getJob(state.db, id), jobs: listJobs(state.db) });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/jobs/organize") {
    const body = await readJson(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      send(res, req, allowedOrigins, 400, { error: "Provide one or more tracks to organize." });
      return;
    }
    if (!state.tools?.ffmpeg?.ok || !state.tools?.ffprobe?.ok) {
      send(res, req, allowedOrigins, 409, { error: "ffmpeg and ffprobe are required to organize and retag exports." });
      return;
    }

    const results = [];
    for (const item of items) {
      const job = getJob(state.db, item.id);
      if (!job) {
        results.push({ id: item.id, ok: false, error: "Job not found." });
        continue;
      }
      if (job.status !== "complete" || !job.outputPath) {
        results.push({ id: item.id, ok: false, error: "Track must be converted before it can be organized." });
        continue;
      }

      try {
        const organized = await organizeExport({ project: state.project, tools: state.tools, job, metadata: item });
        if (!organized.ok) {
          updateJob(state.db, job.id, {
            ...organized.metadataPatch,
            outputPath: organized.path || job.outputPath,
            exportStatus: "invalid",
            metadataReviewStatus: "needs_review",
            lastError: organized.error,
          });
          addLog(state.db, `Organize failed for ${job.title}: ${organized.error}`, "err", "Organize:");
          results.push({ id: job.id, ok: false, error: organized.error });
          continue;
        }

        const updated = updateJob(state.db, job.id, {
          ...organized.metadataPatch,
          outputPath: organized.path,
          exportStatus: "validated",
          metadataStatus: organized.validation.metadataStatus,
          artworkStatus: organized.validation.artworkStatus,
          durationSec: organized.validation.durationSec,
          sizeBytes: organized.validation.sizeBytes,
          metadataReviewStatus: "approved",
          appleMusicImportStatus: "pending",
          appleMusicPlaylistStatus: "pending",
          readyForFinderSync: 0,
          syncState: "",
          musicPersistentId: "",
          lastError: "",
        });
        addLog(state.db, `Approved and organized ${updated.artist} — ${updated.title}.`, "ok", "Organize:");
        results.push({ id: job.id, ok: true, path: organized.path });
      } catch (error) {
        updateJob(state.db, job.id, { metadataReviewStatus: "needs_review", lastError: error.message });
        addLog(state.db, `Organize error for ${job.title}: ${error.message}`, "err", "Organize:");
        results.push({ id: job.id, ok: false, error: error.message });
      }
    }

    emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, { results, jobs: listJobs(state.db), logs: listLogs(state.db) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/exports/playlist") {
    const playlist = await writePlaylists(state.project, listJobs(state.db));
    addLog(state.db, `Wrote ${playlist.playlists.length} playlist${playlist.playlists.length === 1 ? "" : "s"} with ${playlist.count} converted track${playlist.count === 1 ? "" : "s"}.`, "ok", "Export:");
    emit(state, { type: "logs", logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, { playlist, logs: listLogs(state.db) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/exports/reveal") {
    try {
      spawn("open", [state.project.exportsDir], { stdio: "ignore", detached: true }).unref();
      send(res, req, allowedOrigins, 200, { ok: true, path: state.project.exportsDir });
    } catch (error) {
      send(res, req, allowedOrigins, 500, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/ipod/handoff") {
    const body = await readJson(req);
    const { eligible, pending: selected } = selectAppleMusicHandoffJobs(listJobs(state.db), body.ids);

    if (!selected.length) {
      if (eligible.length) {
        const message = "Nothing new to add; sync in Finder.";
        addLog(state.db, `Apple Music handoff skipped: ${eligible.length} approved track${eligible.length === 1 ? "" : "s"} already in "${MASTER_PLAYLIST}".`, "ok", "Sync:", "applemusic");
        emit(state, { type: "logs", logs: listLogs(state.db) });
        send(res, req, allowedOrigins, 200, {
          noop: true,
          message,
          folder: ILISTEN_FOLDER,
          master: MASTER_PLAYLIST,
          playlists: [{ name: MASTER_PLAYLIST, count: eligible.length }],
          results: [],
          jobs: listJobs(state.db),
          logs: listLogs(state.db),
        });
        return;
      }
      send(res, req, allowedOrigins, 400, { error: "No approved exports are ready to hand off to Apple Music. Review and organize metadata first." });
      return;
    }

    addLog(state.db, `Apple Music handoff: ${selected.length} track${selected.length === 1 ? "" : "s"}.`, null, "Sync:", "applemusic");
    emit(state, { type: "logs", logs: listLogs(state.db) });

    let outcome;
    try {
      outcome = await handoffToAppleMusic(selected, {
        onLog: (msg, kind) => {
          addLog(state.db, msg, kind || null, "Sync:", "applemusic");
          void appendFileLog(state.project, "applemusic.log", msg);
        },
      });
    } catch (error) {
      const classified = classifyOsascriptError(error);
      addLog(state.db, classified.userMessage, "err", "Sync:", "applemusic");
      void appendFileLog(state.project, "applemusic.log", `handoff blocked (${classified.kind}): ${classified.userMessage}`);
      emit(state, { type: "logs", logs: listLogs(state.db) });
      send(res, req, allowedOrigins, 200, {
        blocked: true,
        kind: classified.kind,
        message: classified.userMessage,
        jobs: listJobs(state.db),
        logs: listLogs(state.db),
      });
      return;
    }

    const byId = new Map(outcome.results.map((result) => [result.id, result]));
    selected.forEach((job) => {
      const result = byId.get(job.id);
      if (!result) return;
      if (result.importStatus === "imported") {
        updateJob(state.db, job.id, {
          appleMusicImportStatus: "imported",
          appleMusicPlaylistStatus: "added",
          musicPersistentId: result.persistentId,
          readyForFinderSync: 1,
          syncState: "needs_manual",
          lastError: "",
        });
      } else {
        updateJob(state.db, job.id, {
          appleMusicImportStatus: "failed",
          lastError: result.reason || "Apple Music import failed.",
        });
      }
    });

    const imported = outcome.results.filter((result) => result.importStatus === "imported").length;
    addLog(state.db, `Apple Music: ${imported}/${selected.length} ready in "${MASTER_PLAYLIST}".`, "ok", "Sync:", "applemusic");
    emit(state, { type: "jobs", jobs: listJobs(state.db), logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, {
      folder: outcome.folder,
      master: outcome.master,
      playlists: outcome.playlists,
      results: outcome.results,
      jobs: listJobs(state.db),
      logs: listLogs(state.db),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/applemusic/cleanup") {
    try {
      const removed = await cleanupStaleIlistenPlaylists();
      addLog(state.db, `Apple Music cleanup removed ${removed.length} stale playlist${removed.length === 1 ? "" : "s"}.`, "ok", "Sync:", "applemusic");
      emit(state, { type: "logs", logs: listLogs(state.db) });
      send(res, req, allowedOrigins, 200, { removed, jobs: listJobs(state.db), logs: listLogs(state.db) });
    } catch (error) {
      const classified = classifyOsascriptError(error);
      addLog(state.db, classified.userMessage, "err", "Sync:", "applemusic");
      send(res, req, allowedOrigins, 200, { blocked: true, kind: classified.kind, message: classified.userMessage, jobs: listJobs(state.db), logs: listLogs(state.db) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/ipod/devices") {
    const detection = await detectIpods();
    setState(state.db, "ipod_detected", detection.connected ? "1" : "0");
    if (detection.device?.connected) {
      setState(state.db, "ipod_name", detection.device.name || "");
      setState(state.db, "ipod_free_space", String(detection.device.freeBytes || 0));
      setState(state.db, "ipod_capacity", String(detection.device.capacityBytes || 0));
      setState(state.db, "disk_use_enabled", detection.device.diskUseEnabled ? "1" : "0");
      setState(state.db, "can_sync_finder", detection.device.canSyncViaFinder ? "1" : "0");
    }
    void appendFileLog(state.project, "ipod.log", `devices: connected=${detection.connected} mounted=${detection.mounted.length} usb=${detection.usb.length}`);
    send(res, req, allowedOrigins, 200, { ...detection, selectedPath: getState(state.db, "ipod_volume_path", "") });
    return;
  }

  if (req.method === "POST" && url.pathname === "/ipod/select") {
    const body = await readJson(req);
    const verified = verifyIpodVolume(body.path);
    if (!verified.ok) {
      send(res, req, allowedOrigins, 400, { error: verified.error });
      return;
    }
    setState(state.db, "ipod_volume_path", verified.volumePath);
    addLog(state.db, `Selected iPod volume: ${verified.volumePath}`, "ok", "iPod:", "ipod");
    void appendFileLog(state.project, "ipod.log", `manual select: ${verified.volumePath}`);
    emit(state, { type: "logs", logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, { device: verified, jobs: listJobs(state.db), logs: listLogs(state.db) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/ipod/status") {
    const jobs = listJobs(state.db);
    const complete = jobs.filter((job) => job.status === "complete");
    const counts = {
      total: jobs.length,
      complete: complete.length,
      validated: complete.filter((job) => job.exportStatus === "validated").length,
      approved: complete.filter((job) => job.metadataReviewStatus === "approved").length,
      metadataComplete: complete.filter((job) => job.metadataStatus === "complete").length,
      artworkEmbedded: complete.filter((job) => job.artworkStatus === "embedded").length,
      imported: complete.filter((job) => job.appleMusicImportStatus === "imported").length,
      inPlaylist: complete.filter((job) => job.appleMusicPlaylistStatus === "added").length,
    };
    const device = {
      connected: getState(state.db, "ipod_detected", "0") === "1",
      name: getState(state.db, "ipod_name", ""),
      freeBytes: Number(getState(state.db, "ipod_free_space", "0")) || 0,
      capacityBytes: Number(getState(state.db, "ipod_capacity", "0")) || 0,
      diskUseEnabled: getState(state.db, "disk_use_enabled", "0") === "1",
      canSyncViaFinder: getState(state.db, "can_sync_finder", "0") === "1",
      volumePath: getState(state.db, "ipod_volume_path", ""),
    };
    send(res, req, allowedOrigins, 200, { counts, device, folder: ILISTEN_FOLDER, master: MASTER_PLAYLIST });
    return;
  }

  notFound(res, req, allowedOrigins);
}

export function createAppServer({ port = PORT, allowedOrigins = parseAllowedOrigins(), state = createAppState() } = {}) {
  const server = createServer((req, res) => {
    route(req, res, state, allowedOrigins).catch((error) => {
      send(res, req, allowedOrigins, 500, { error: error.message });
    });
  });

  return {
    server,
    state,
    listen(host = "127.0.0.1", callback) {
      return server.listen(port, host, callback);
    },
  };
}

function isHelperHealthPayload(payload) {
  return Boolean(
    payload
      && payload.ok === true
      && typeof payload.paired === "boolean"
      && Array.isArray(payload.jobs)
      && Array.isArray(payload.logs)
      && payload.tools
  );
}

export function probeRunningHelper({ host = "127.0.0.1", port = PORT, timeoutMs = 1000 } = {}, requestImpl = httpRequest) {
  return new Promise((resolve) => {
    const req = requestImpl({
      host,
      port,
      method: "GET",
      path: "/health",
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        try {
          const payload = JSON.parse(raw || "{}");
          resolve(isHelperHealthPayload(payload) ? payload : null);
        } catch {
          resolve(null);
        }
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error("Helper probe timed out.")));
    req.on("error", () => resolve(null));
    req.end();
  });
}

export function helperReuseMessage(health, host = "127.0.0.1", port = PORT) {
  const lines = [
    `iListen helper is already running at http://${host}:${port}.`,
    "Reusing the existing local helper instead of starting another one.",
  ];

  if (health?.project?.root) lines.push(`Current project: ${health.project.root}`);
  return lines.join("\n");
}

export function helperStartupMessage(error, host = "127.0.0.1", port = PORT) {
  if (error?.code === "EADDRINUSE") {
    return [
      `iListen helper could not start because ${host}:${port} is already in use.`,
      "Another iListen helper is probably already running.",
      `Use \`lsof -nP -iTCP:${port} -sTCP:LISTEN\` to see the active process, then stop it or reuse it.`,
    ].join("\n");
  }

  return error?.message || `Failed to start iListen helper on ${host}:${port}.`;
}

const state = createAppState();

async function startCli() {
  const app = createAppServer({ port: PORT, state });
  app.server.once("error", (error) => {
    void (async () => {
      if (error?.code === "EADDRINUSE") {
        const running = await probeRunningHelper({ host: "127.0.0.1", port: PORT });
        if (running) {
          console.log(helperReuseMessage(running, "127.0.0.1", PORT));
          process.exit(0);
          return;
        }
      }

      console.error(helperStartupMessage(error, "127.0.0.1", PORT));
      process.exit(1);
    })();
  });
  app.listen("127.0.0.1", () => {
    console.log(`iListen local helper listening on http://127.0.0.1:${PORT}`);
    console.log("Open the web app and pair it with this helper.");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void startCli();
}
