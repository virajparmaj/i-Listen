import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createJobs, openDatabase, updateJob } from "./lib/db.js";
import { createAppState, helperReuseMessage, helperStartupMessage, probeRunningHelper, route } from "./index.js";

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
});
