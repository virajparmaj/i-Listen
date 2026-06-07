import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { randomBytes } from "node:crypto";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { addLog, createJobs, getJob, listJobs, listLogs, openDatabase, removeJob, updateJob } from "./lib/db.js";
import { JobRunner, writePlaylists } from "./lib/converter.js";
import { detectTools } from "./lib/tools.js";
import { DEFAULT_PROJECT_PATH, ensureProject } from "./lib/paths.js";
import { splitYoutubeUrls } from "./lib/youtube.js";

const PORT = Number(process.env.ILISTEN_PORT || 4317);

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
    send(res, req, allowedOrigins, 200, {
      ok: true,
      paired: Boolean(state.token),
      project: state.project,
      tools: state.tools,
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
      await serveJobAsset(req, res, state, allowedOrigins, job, job?.coverPath, "cover");
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

  if (jobMatch) {
    const [, id, action] = jobMatch;
    const job = getJob(state.db, id);

    if (req.method === "PATCH" && !action) {
      const body = await readJson(req);
      const job = updateJob(state.db, id, body);
      emit(state, { type: "jobs", jobs: listJobs(state.db) });
      send(res, req, allowedOrigins, 200, { job, jobs: listJobs(state.db) });
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
      const job = removeJob(state.db, id);
      emit(state, { type: "jobs", jobs: listJobs(state.db) });
      send(res, req, allowedOrigins, 200, { job, jobs: listJobs(state.db) });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/exports/playlist") {
    const playlist = await writePlaylists(state.project, listJobs(state.db));
    addLog(state.db, `Wrote ${playlist.playlists.length} playlist${playlist.playlists.length === 1 ? "" : "s"} with ${playlist.count} converted track${playlist.count === 1 ? "" : "s"}.`, "ok", "Export:");
    emit(state, { type: "logs", logs: listLogs(state.db) });
    send(res, req, allowedOrigins, 200, { playlist, logs: listLogs(state.db) });
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
