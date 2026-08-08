import { spawn } from "node:child_process";
import {
  ADD_TO_PLAYLIST_SCRIPT,
  CLEAN_STALE_PLAYLISTS_SCRIPT,
  FIELD_SEP,
  ILISTEN_FOLDER,
  LIST_PLAYLIST_SCRIPT,
  PREFLIGHT_SCRIPT,
  RECONCILE_PLAYLIST_SCRIPT,
  REFRESH_TRACK_SCRIPT,
} from "./appleMusicScripts.js";
import { customPlaylists, isAutoPlaylistName } from "./metadata.js";
import { buildIndex, chunk, classifyJob, tagVersion } from "./musicIndex.js";

export { ILISTEN_FOLDER };
export const MASTER_PLAYLIST = "iPod Sync";

const OSASCRIPT = "/usr/bin/osascript";

/** Files handed to Music per osascript spawn, so a timeout kills at most this many. */
const ADD_CHUNK_SIZE = 25;

/**
 * Run an AppleScript source via osascript, reading the script from stdin and
 * passing args as `on run argv`. Resolves with trimmed stdout on success.
 */
function runOsascript(scriptSource, args = [], { timeoutMs = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(OSASCRIPT, ["-", ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: stdout.trim(), stderr });
      else reject(Object.assign(new Error(stderr.trim() || `osascript exited with code ${code}`), { code, stderr }));
    });

    child.stdin.write(scriptSource);
    child.stdin.end();
  });
}

/**
 * Parse the six-field result lines emitted by the add/refresh scripts:
 *   STATUS ␟ REQUESTED_PATH ␟ DATABASE_ID ␟ PERSISTENT_ID ␟ ACTUAL_PATH ␟ REASON
 * Keyed by the requested path so callers can match results back to jobs.
 */
export function parseResultLines(stdout) {
  const map = new Map();
  String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [status, path, databaseId = "", persistentId = "", locationPath = "", reason = ""] = line.split(FIELD_SEP);
      if (!path) return;
      map.set(path, {
        status: String(status || "").toLowerCase(),
        databaseId,
        persistentId,
        locationPath,
        reason,
      });
    });
  return map;
}

/**
 * Parse a playlist snapshot into index entries:
 *   DATABASE_ID ␟ PERSISTENT_ID ␟ PATH ␟ TITLE ␟ ARTIST ␟ ALBUM
 */
export function parsePlaylistLines(stdout) {
  if (String(stdout || "").trim() === "NO_PLAYLIST") return [];
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [databaseId = "", persistentId = "", path = "", title = "", artist = "", album = ""] = line.split(FIELD_SEP);
      return { databaseId, persistentId, path, title, artist, album };
    });
}

/** Snapshot one playlist for identity matching. Returns [] when it does not exist. */
export async function readPlaylistEntries(playlistName) {
  const { stdout } = await runOsascript(LIST_PLAYLIST_SCRIPT, [playlistName]);
  return parsePlaylistLines(stdout);
}

/**
 * Parse the playlist inventory:
 *   NAME ␟ PARENT ␟ SPECIAL_KIND ␟ SMART ␟ TRACK_COUNT ␟ NON_FILE_COUNT
 */
export function parsePreflightLines(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", parent = "", specialKind = "", smart = "false", trackCount = "0", nonFileCount = "0"] = line.split(FIELD_SEP);
      return {
        name,
        parent,
        specialKind,
        smart: smart.trim() === "true",
        trackCount: Number(trackCount) || 0,
        nonFileCount: Number(nonFileCount) || 0,
      };
    })
    .filter((row) => row.name);
}

/** Inventory every user playlist (read-only). */
export async function readPlaylistInventory() {
  const { stdout } = await runOsascript(PREFLIGHT_SCRIPT, []);
  return parsePreflightLines(stdout);
}

/**
 * Remove playlist entries by 1-based index. Indices are sorted descending here
 * so callers cannot get the shifting-index bug wrong.
 * @returns {{ ok: boolean, removed: number, reason: string }}
 */
export async function reconcilePlaylist(playlistName, removeIndices = []) {
  if (!removeIndices.length) return { ok: true, removed: 0, reason: "" };
  const descending = [...removeIndices].sort((a, b) => b - a).map(String);
  const { stdout } = await runOsascript(RECONCILE_PLAYLIST_SCRIPT, [playlistName, ...descending]);
  const [status = "", detail = ""] = String(stdout || "").trim().split(FIELD_SEP);
  if (status === "OK") return { ok: true, removed: Number(detail) || 0, reason: "" };
  return { ok: false, removed: 0, reason: detail || "Reconcile aborted." };
}

/**
 * Add ordered file paths to a single playlist inside the iListen folder.
 * Spawns one osascript per ADD_CHUNK_SIZE paths so a timeout cannot discard the
 * whole batch, and calls onChunk after each so callers can persist incrementally.
 * @param {string} playlistName
 * @param {string[]} paths POSIX paths in desired order
 * @param {{ onChunk?: (results: Map<string, object>) => void }} [opts]
 */
export async function addToPlaylist(playlistName, paths, { onChunk } = {}) {
  const merged = new Map();
  if (!paths.length) return merged;
  for (const group of chunk(paths, ADD_CHUNK_SIZE)) {
    const { stdout } = await runOsascript(ADD_TO_PLAYLIST_SCRIPT, [playlistName, ...group]);
    const results = parseResultLines(stdout);
    results.forEach((value, key) => merged.set(key, value));
    onChunk?.(results);
  }
  return merged;
}

export async function cleanupStaleIlistenPlaylists() {
  const { stdout } = await runOsascript(CLEAN_STALE_PLAYLISTS_SCRIPT, []);
  return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function firstNumber(value) {
  const n = parseInt(String(value || "").split("/")[0], 10);
  return Number.isFinite(n) ? String(n) : "";
}

/**
 * Push a job's current tags/artwork onto its existing Music track.
 * @param {object} job
 * @param {{ artworkPath?: string, relinkPath?: string }} [opts]
 */
export async function refreshAppleMusicTrack(job, { artworkPath = job.customCoverPath || "", relinkPath = "" } = {}) {
  const { stdout } = await runOsascript(REFRESH_TRACK_SCRIPT, [
    job.outputPath || "",
    job.musicDatabaseId || "",
    job.musicPersistentId || "",
    job.title || "",
    job.artist || "",
    job.album || "",
    job.albumArtist || job.artist || "",
    firstNumber(job.year),
    firstNumber(job.track),
    firstNumber(job.disc),
    artworkPath || "",
    relinkPath || "",
    job.musicLocationPath || "",
  ]);
  return parseResultLines(stdout).get(job.outputPath) || {
    status: "failed",
    databaseId: job.musicDatabaseId || "",
    persistentId: job.musicPersistentId || "",
    locationPath: "",
    reason: "No result from Music.",
  };
}

export async function refreshAppleMusicTracks(jobs) {
  const results = [];
  for (const job of jobs) {
    const result = await refreshAppleMusicTrack(job);
    results.push({ id: job.id, path: job.outputPath, ...result });
  }
  return results;
}

function sortKey(job) {
  const num = (value) => {
    const n = parseInt(String(value || "").split("/")[0], 10);
    return Number.isFinite(n) ? n : 0;
  };
  return [
    String(job.artist || "").toLowerCase(),
    String(job.album || "").toLowerCase(),
    num(job.disc),
    num(job.track),
    String(job.title || "").toLowerCase(),
  ];
}

function compareJobs(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

function resultFor(job, { status, databaseId, persistentId, locationPath, reason, version }) {
  const inLibrary = status === "added" || status === "skipped" || status === "updated" || status === "current";
  return {
    id: job.id,
    path: job.outputPath,
    status,
    importStatus: inLibrary ? "imported" : "failed",
    playlistStatus: inLibrary ? "added" : "pending",
    databaseId: databaseId || "",
    persistentId: persistentId || "",
    locationPath: locationPath || "",
    tagVersion: inLibrary ? version : "",
    reason: reason || "",
  };
}

/**
 * Hand off exported tracks to Apple Music.
 *
 * Flow is classify -> add -> refresh, not blind append. The old version added
 * everything and let the AppleScript dedupe on the export path, which stops
 * matching the moment Music copies a file into its own Media folder — so every
 * handoff after a metadata edit or reconvert appended the entire library again.
 *
 * @param {Array<object>} jobs complete jobs with outputPath set
 * @param {{ onLog?: Function, onResults?: Function, playlistName?: string }} [opts]
 */
export async function handoffToAppleMusic(jobs, { onLog, onResults, playlistName = MASTER_PLAYLIST } = {}) {
  const usable = jobs.filter((job) => job.outputPath).sort(compareJobs);
  const log = (msg, kind) => onLog?.(msg, kind);
  if (!usable.length) {
    return { folder: ILISTEN_FOLDER, master: playlistName, playlists: [], results: [] };
  }

  // Recreate each source playlist under the iListen folder, in track order.
  const groups = new Map();
  usable.forEach((job) => {
    customPlaylists(job.playlists || []).forEach((name) => {
      const clean = String(name || "").trim();
      if (!clean || clean === playlistName || isAutoPlaylistName(clean)) return;
      if (!groups.has(clean)) groups.set(clean, []);
      groups.get(clean).push(job);
    });
  });

  const playlistSummaries = [];
  for (const [name, items] of groups.entries()) {
    const ordered = [...items].sort(compareJobs);
    const result = await addToPlaylist(name, ordered.map((job) => job.outputPath));
    const added = [...result.values()].filter((r) => r.status === "added").length;
    playlistSummaries.push({ name, count: ordered.length });
    log(`Playlist "${name}": ${added} added, ${ordered.length - added} already present.`, "ok");
  }

  // Classify against the live playlist before touching anything.
  const index = buildIndex(await readPlaylistEntries(playlistName));
  const plans = usable.map((job) => ({ job, ...classifyJob(job, index) }));
  const toAdd = plans.filter((p) => p.action === "add");
  const toRefresh = plans.filter((p) => p.action === "refresh");
  const current = plans.filter((p) => p.action === "current");
  log(`"${playlistName}": ${toAdd.length} to add, ${toRefresh.length} to refresh, ${current.length} already current.`, "ok");

  const results = [];
  const emit = (entry) => {
    results.push(entry);
    onResults?.([entry]);
  };

  current.forEach(({ job, entry, tagVersion: version }) => emit(resultFor(job, {
    status: "current",
    databaseId: entry?.databaseId,
    persistentId: entry?.persistentId,
    locationPath: entry?.path,
    version,
  })));

  if (toAdd.length) {
    const byPath = new Map(toAdd.map((p) => [p.job.outputPath, p]));
    const addResults = await addToPlaylist(playlistName, toAdd.map((p) => p.job.outputPath), {
      onChunk: (partial) => {
        const batch = [];
        partial.forEach((r, path) => {
          const plan = byPath.get(path);
          if (plan) batch.push(resultFor(plan.job, { ...r, version: plan.tagVersion }));
        });
        onResults?.(batch);
      },
    });
    toAdd.forEach((plan) => {
      const r = addResults.get(plan.job.outputPath) || { status: "failed", reason: "No result from Music." };
      results.push(resultFor(plan.job, { ...r, version: plan.tagVersion }));
    });
    log(`"${playlistName}": ${[...addResults.values()].filter((r) => r.status === "added").length} added.`, "ok");
  }

  for (const plan of toRefresh) {
    const { job, entry, tagVersion: version } = plan;
    const seeded = { ...job, musicDatabaseId: job.musicDatabaseId || entry?.databaseId || "" };
    const r = await refreshAppleMusicTrack(seeded);
    emit(resultFor(job, { ...r, version }));
  }
  if (toRefresh.length) log(`"${playlistName}": ${toRefresh.length} refreshed with current tags/artwork.`, "ok");

  playlistSummaries.push({ name: playlistName, count: usable.length });
  return { folder: ILISTEN_FOLDER, master: playlistName, playlists: playlistSummaries, results };
}

export { tagVersion };

/**
 * Map an osascript failure to a user-facing reason. Never throws.
 * @param {unknown} error
 * @returns {{ kind: "tcc-denied" | "music-not-running" | "unknown", userMessage: string }}
 */
export function classifyOsascriptError(error) {
  const msg = String(error?.stderr || error?.message || "");
  if (/-1743|-1744|not authoriz|not allowed to send Apple events/i.test(msg)) {
    return {
      kind: "tcc-denied",
      userMessage:
        "macOS blocked iListen from controlling Music. Approve it under System Settings → " +
        "Privacy & Security → Automation → (your terminal / node) → Music, then retry. " +
        "You can also import the exports folder into Music manually.",
    };
  }
  if (/-600|-609|Application is(n.t| not) running/i.test(msg)) {
    return { kind: "music-not-running", userMessage: "The Music app could not be launched. Open Music and retry." };
  }
  return { kind: "unknown", userMessage: msg.slice(0, 300) || "Unknown Apple Music error." };
}
