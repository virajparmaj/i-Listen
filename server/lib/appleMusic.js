import { spawn } from "node:child_process";
import { customPlaylists, isAutoPlaylistName } from "./metadata.js";

export const ILISTEN_FOLDER = "iListen";
export const MASTER_PLAYLIST = "iPod Sync";

const OSASCRIPT = "/usr/bin/osascript";

/**
 * AppleScript run once per target playlist. argv[0] is the playlist name; the
 * remaining argv entries are POSIX file paths added in order. File paths arrive
 * as `on run argv` (never interpolated into the script) so there is no shell or
 * AppleScript injection surface. Emits one tab-separated line per file:
 *   STATUS<TAB>PATH<TAB>PERSISTENT_ID<TAB>REASON
 */
const ADD_TO_PLAYLIST_SCRIPT = `on run argv
  set plName to item 1 of argv
  if (count of argv) < 2 then return ""
  set paths to rest of argv
  set outLines to {}
  tell application "Music"
    if not (exists folder playlist "${ILISTEN_FOLDER}") then
      make new folder playlist with properties {name:"${ILISTEN_FOLDER}"}
    end if
    set iFolder to folder playlist "${ILISTEN_FOLDER}"
    if not (exists user playlist plName) then
      set newPl to make new user playlist with properties {name:plName}
      try
        move newPl to iFolder
      end try
    end if
    set pl to user playlist plName
    set existing to {}
    try
      repeat with t in (every track of pl)
        set loc to (location of t)
        if loc is not missing value then set end of existing to (POSIX path of loc)
      end repeat
    end try
    repeat with raw in paths
      set p to raw as text
      set statusText to "FAILED"
      set pid to ""
      set rsn to ""
      try
        if existing contains p then
          set statusText to "SKIPPED"
          set rsn to "duplicate"
        else
          set addedTrack to (add (POSIX file p) to pl)
          set statusText to "ADDED"
          set end of existing to p
          try
            set pid to (get persistent ID of addedTrack)
          end try
        end if
      on error e number n
        set rsn to (e & " [" & n & "]")
      end try
      set end of outLines to (statusText & tab & p & tab & pid & tab & rsn)
    end repeat
  end tell
  set AppleScript's text item delimiters to linefeed
  return outLines as text
end run`;

/**
 * Read a lightweight summary of the iListen Apple Music structure (whether the
 * folder/master playlist exist and how many tracks the master holds). Tab line:
 *   FOLDER_EXISTS<TAB>MASTER_EXISTS<TAB>MASTER_COUNT
 */
const STATUS_SCRIPT = `tell application "Music"
  set folderExists to (exists folder playlist "${ILISTEN_FOLDER}")
  set masterExists to (exists user playlist "${MASTER_PLAYLIST}")
  set masterCount to 0
  if masterExists then set masterCount to (count of tracks of user playlist "${MASTER_PLAYLIST}")
  return (folderExists as text) & tab & (masterExists as text) & tab & (masterCount as text)
end tell`;

const CLEAN_STALE_PLAYLISTS_SCRIPT = `tell application "Music"
  set staleNames to {}
  repeat with p in (every user playlist whose name starts with "iPod -")
    set end of staleNames to (name of p as text)
  end repeat
  set removedNames to {}
  repeat with playlistName in staleNames
    try
      delete user playlist (playlistName as text)
      set end of removedNames to (playlistName as text)
    end try
  end repeat
  set AppleScript's text item delimiters to linefeed
  return removedNames as text
end tell`;

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

function parseResultLines(stdout) {
  const map = new Map();
  stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [status, path, persistentId = "", reason = ""] = line.split("\t");
      if (!path) return;
      map.set(path, { status: String(status || "").toLowerCase(), persistentId, reason });
    });
  return map;
}

/**
 * Add ordered file paths to a single playlist inside the iListen folder.
 * @param {string} playlistName
 * @param {string[]} paths POSIX paths in desired order
 * @returns {Promise<Map<string, { status: string, persistentId: string, reason: string }>>}
 */
export async function addToPlaylist(playlistName, paths) {
  if (!paths.length) return new Map();
  const { stdout } = await runOsascript(ADD_TO_PLAYLIST_SCRIPT, [playlistName, ...paths]);
  return parseResultLines(stdout);
}

export async function cleanupStaleIlistenPlaylists() {
  const { stdout } = await runOsascript(CLEAN_STALE_PLAYLISTS_SCRIPT, []);
  return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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

/**
 * Hand off exported tracks to Apple Music: ensure the "iListen" folder, recreate
 * each source playlist (preserving names + track order), add every track to the
 * master "iPod Sync" playlist, and report per-track outcomes.
 *
 * @param {Array<object>} jobs complete jobs with outputPath set
 * @param {{ onLog?: (msg: string, kind?: string) => void }} [opts]
 * @returns {Promise<{ folder: string, master: string, playlists: Array<{ name: string, count: number }>,
 *   results: Array<{ id: string, path: string, importStatus: string, playlistStatus: string,
 *   persistentId: string, reason: string }> }>}
 */
export async function handoffToAppleMusic(jobs, { onLog } = {}) {
  const usable = jobs.filter((job) => job.outputPath).sort(compareJobs);
  const log = (msg, kind) => onLog?.(msg, kind);

  // Group jobs by their source playlist names (preserve the source structure).
  const groups = new Map();
  usable.forEach((job) => {
    customPlaylists(job.playlists || []).forEach((name) => {
      const clean = String(name || "").trim();
      if (!clean || clean === MASTER_PLAYLIST || isAutoPlaylistName(clean)) return;
      if (!groups.has(clean)) groups.set(clean, []);
      groups.get(clean).push(job);
    });
  });

  const playlistSummaries = [];

  // Recreate each source playlist under the iListen folder, in track order.
  for (const [name, items] of groups.entries()) {
    const ordered = [...items].sort(compareJobs);
    const result = await addToPlaylist(name, ordered.map((job) => job.outputPath));
    const added = [...result.values()].filter((r) => r.status === "added").length;
    playlistSummaries.push({ name, count: ordered.length });
    log(`Playlist "${name}": ${added} added, ${ordered.length - added} already present.`, "ok");
  }

  // Master playlist gets every selected track (authoritative import signal).
  const masterResult = await addToPlaylist(MASTER_PLAYLIST, usable.map((job) => job.outputPath));
  const masterAdded = [...masterResult.values()].filter((r) => r.status === "added").length;
  playlistSummaries.push({ name: MASTER_PLAYLIST, count: usable.length });
  log(`Master "${MASTER_PLAYLIST}": ${masterAdded} added, ${usable.length - masterAdded} already present.`, "ok");

  const results = usable.map((job) => {
    const r = masterResult.get(job.outputPath) || { status: "failed", persistentId: "", reason: "No result from Music." };
    const inLibrary = r.status === "added" || r.status === "skipped";
    return {
      id: job.id,
      path: job.outputPath,
      importStatus: inLibrary ? "imported" : "failed",
      playlistStatus: inLibrary ? "added" : "pending",
      persistentId: r.persistentId || "",
      reason: r.reason || "",
    };
  });

  return { folder: ILISTEN_FOLDER, master: MASTER_PLAYLIST, playlists: playlistSummaries, results };
}

/**
 * Probe whether the iListen folder/master playlist exist and the master's track
 * count. Throws (classify with classifyOsascriptError) if Music can't be reached.
 * @returns {Promise<{ available: boolean, folderExists: boolean, masterExists: boolean, masterCount: number }>}
 */
export async function appleMusicStatus() {
  const { stdout } = await runOsascript(STATUS_SCRIPT, []);
  const [folder = "false", master = "false", count = "0"] = stdout.split("\t");
  return {
    available: true,
    folderExists: folder.trim() === "true",
    masterExists: master.trim() === "true",
    masterCount: Number(count.trim()) || 0,
  };
}

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
