import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createJobs, openDatabase, updateJob } from "./lib/db.js";
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
