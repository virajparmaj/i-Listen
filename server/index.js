import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { addLog, createJobs, getJob, listJobs, listLogs, openDatabase, removeJob, updateJob } from "./lib/db.js";
import { JobRunner, writePlaylists } from "./lib/converter.js";
import { detectTools } from "./lib/tools.js";
import { DEFAULT_PROJECT_PATH, ensureProject } from "./lib/paths.js";
import { splitYoutubeUrls } from "./lib/youtube.js";

const PORT = Number(process.env.ILISTEN_PORT || 4317);
const allowedOrigins = new Set(String(process.env.ILISTEN_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean));

const state = {
  token: null,
  project: null,
  db: null,
  tools: detectTools(),
  runner: null,
  clients: new Set(),
};

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    "Access-Control-Allow-Headers": "content-type, x-ilisten-token",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    Vary: "Origin, Access-Control-Request-Private-Network",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin || "*";
    if (req.headers["access-control-request-private-network"] === "true") {
      headers["Access-Control-Allow-Private-Network"] = "true";
    }
  }
  return headers;
}

function send(res, req, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(req),
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function notFound(res, req) {
  send(res, req, 404, { error: "Not found" });
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function ensureToken() {
  if (!state.token) state.token = randomBytes(24).toString("hex");
  return state.token;
}

function authed(req) {
  if (!state.token) return false;
  const url = new URL(req.url, `http://${req.headers.host}`);
  return req.headers["x-ilisten-token"] === state.token || url.searchParams.get("token") === state.token;
}

function requireAuth(req, res) {
  if (authed(req)) return true;
  send(res, req, 401, { error: "Pair with the local helper first." });
  return false;
}

function requireProject(req, res) {
  if (state.db && state.project) return true;
  send(res, req, 409, { error: "Open a project folder first." });
  return false;
}

function emit(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  state.clients.forEach((client) => client.write(data));
}

function openProject(projectPath = DEFAULT_PROJECT_PATH) {
  state.project = ensureProject(projectPath);
  state.db = openDatabase(state.project.dbPath);
  state.tools = detectTools();
  state.runner = new JobRunner({
    db: state.db,
    project: state.project,
    tools: state.tools,
    emit,
  });
  addLog(state.db, `Opened ${state.project.root}`, "ok", "Project:");
  emit({ type: "project", project: state.project, tools: state.tools, jobs: listJobs(state.db), logs: listLogs(state.db) });
}

async function handleEvents(req, res) {
  if (!requireAuth(req, res)) return;
  res.writeHead(200, {
    ...corsHeaders(req),
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

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!isAllowedOrigin(req.headers.origin)) {
    send(res, req, 403, { error: "Origin is not allowed by this local helper." });
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    state.tools = detectTools();
    if (state.runner) state.runner.tools = state.tools;
    send(res, req, 200, {
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
    const token = ensureToken();
    send(res, req, 200, { token, helperUrl: `http://127.0.0.1:${PORT}` });
    return;
  }

  if (req.method === "GET" && url.pathname === "/events") {
    await handleEvents(req, res);
    return;
  }

  if (!requireAuth(req, res)) return;

  if (req.method === "POST" && url.pathname === "/projects/open") {
    const body = await readJson(req);
    openProject(body.path);
    send(res, req, 200, {
      project: state.project,
      tools: state.tools,
      jobs: listJobs(state.db),
      logs: listLogs(state.db),
    });
    return;
  }

  if (!requireProject(req, res)) return;

  if (req.method === "GET" && url.pathname === "/jobs") {
    send(res, req, 200, { jobs: listJobs(state.db), logs: listLogs(state.db) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/jobs") {
    const body = await readJson(req);
    const { accepted, rejected } = splitYoutubeUrls(Array.isArray(body.urls) ? body.urls.join("\n") : body.text);
    if (!accepted.length) {
      send(res, req, 400, { error: "Paste one or more valid YouTube links.", rejected });
      return;
    }
    const result = createJobs(state.db, accepted, body.outputOption || "best-youtube");
    addLog(state.db, `Added ${result.created.length} YouTube link${result.created.length === 1 ? "" : "s"}.`, null, "Queue:");
    if (rejected.length) addLog(state.db, `${rejected.length} non-YouTube link${rejected.length === 1 ? "" : "s"} rejected.`, "warn", "Queue:");
    emit({ type: "jobs", jobs: result.jobs, logs: listLogs(state.db) });
    send(res, req, 200, { ...result, rejected });
    return;
  }

  const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)(?:\/([^/]+))?$/);
  if (jobMatch) {
    const [, id, action] = jobMatch;

    if (req.method === "PATCH" && !action) {
      const body = await readJson(req);
      const job = updateJob(state.db, id, body);
      emit({ type: "jobs", jobs: listJobs(state.db) });
      send(res, req, 200, { job, jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "start") {
      const job = getJob(state.db, id);
      if (!job) {
        send(res, req, 404, { error: "Job not found" });
        return;
      }
      state.runner.startJob(id).catch((error) => {
        addLog(state.db, error.message, "err", "Failed:");
        emit({ type: "logs", logs: listLogs(state.db) });
      });
      send(res, req, 202, { job: getJob(state.db, id), jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "cancel") {
      const job = state.runner.cancelJob(id);
      emit({ type: "jobs", jobs: listJobs(state.db) });
      send(res, req, 200, { job, jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "retry") {
      const job = updateJob(state.db, id, { status: "queued", progress: 0, error: "", warning: "" });
      emit({ type: "jobs", jobs: listJobs(state.db) });
      send(res, req, 200, { job, jobs: listJobs(state.db) });
      return;
    }

    if (req.method === "POST" && action === "remove") {
      const job = removeJob(state.db, id);
      emit({ type: "jobs", jobs: listJobs(state.db) });
      send(res, req, 200, { job, jobs: listJobs(state.db) });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/exports/playlist") {
    const playlist = await writePlaylists(state.project, listJobs(state.db));
    addLog(state.db, `Wrote ${playlist.playlists.length} playlist${playlist.playlists.length === 1 ? "" : "s"} with ${playlist.count} converted track${playlist.count === 1 ? "" : "s"}.`, "ok", "Export:");
    emit({ type: "logs", logs: listLogs(state.db) });
    send(res, req, 200, { playlist, logs: listLogs(state.db) });
    return;
  }

  notFound(res, req);
}

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    send(res, req, 500, { error: error.message });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`iListen local helper listening on http://127.0.0.1:${PORT}`);
  console.log("Open the web app and pair it with this helper.");
});
