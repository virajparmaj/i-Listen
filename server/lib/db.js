import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { normalizePlaylists } from "./metadata.js";

const JOB_FIELDS = {
  url: "url",
  status: "status",
  progress: "progress",
  title: "title",
  artist: "artist",
  album: "album",
  albumArtist: "album_artist",
  year: "year",
  genre: "genre",
  track: "track",
  composer: "composer",
  comment: "comment",
  outputOption: "output_option",
  outputPath: "output_path",
  sourcePath: "source_path",
  sourceCodec: "source_codec",
  sourceContainer: "source_container",
  selectedOutput: "selected_output",
  error: "error",
  warning: "warning",
  thumbnailUrl: "thumbnail_url",
  coverPath: "cover_path",
  durationSec: "duration_sec",
  sizeBytes: "size_bytes",
  playlists: "playlists",
};

function now() {
  return new Date().toISOString();
}

function parsePlaylists(value) {
  try {
    return normalizePlaylists(JSON.parse(value || "[]"));
  } catch {
    return normalizePlaylists(value);
  }
}

function backfillPlaylists(db) {
  const rows = db.prepare("SELECT id, artist, playlists FROM jobs").all();
  const update = db.prepare("UPDATE jobs SET playlists = ?, updated_at = ? WHERE id = ?");
  rows.forEach((row) => {
    if (parsePlaylists(row.playlists).length) return;
    const names = normalizePlaylists([
      "iPod - YouTube Converts",
      row.artist && row.artist !== "Unknown Artist" ? `iPod - ${row.artist}` : "",
    ]);
    update.run(JSON.stringify(names), now(), row.id);
  });
}

export function openDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      album_artist TEXT NOT NULL,
      year TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '',
      track TEXT NOT NULL DEFAULT '',
      composer TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL DEFAULT '',
      output_option TEXT NOT NULL DEFAULT 'best-youtube',
      output_path TEXT NOT NULL DEFAULT '',
      source_path TEXT NOT NULL DEFAULT '',
      source_codec TEXT NOT NULL DEFAULT '',
      source_container TEXT NOT NULL DEFAULT '',
      selected_output TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      warning TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      cover_path TEXT NOT NULL DEFAULT '',
      playlists TEXT NOT NULL DEFAULT '[]',
      duration_sec REAL,
      size_bytes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      t TEXT NOT NULL,
      kind TEXT,
      label TEXT,
      msg TEXT NOT NULL
    );
  `);
  try {
    db.exec("ALTER TABLE jobs ADD COLUMN playlists TEXT NOT NULL DEFAULT '[]'");
  } catch (error) {
    if (!String(error.message).includes("duplicate column")) throw error;
  }
  backfillPlaylists(db);
  return db;
}

export function jobFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    progress: row.progress,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtist: row.album_artist,
    year: row.year,
    genre: row.genre,
    track: row.track,
    composer: row.composer,
    comment: row.comment,
    outputOption: row.output_option,
    outputPath: row.output_path,
    sourcePath: row.source_path,
    sourceCodec: row.source_codec,
    sourceContainer: row.source_container,
    selectedOutput: row.selected_output,
    error: row.error,
    warning: row.warning,
    thumbnailUrl: row.thumbnail_url,
    coverPath: row.cover_path,
    playlists: parsePlaylists(row.playlists),
    durationSec: row.duration_sec,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listJobs(db) {
  return db.prepare("SELECT * FROM jobs ORDER BY created_at, rowid").all().map(jobFromRow);
}

export function getJob(db, id) {
  return jobFromRow(db.prepare("SELECT * FROM jobs WHERE id = ?").get(id));
}

export function createJobs(db, urls, outputOption = "best-youtube") {
  const count = db.prepare("SELECT COUNT(*) AS count FROM jobs").get().count;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO jobs (
      id, url, status, progress, title, artist, album, album_artist, track,
      comment, output_option, playlists, created_at, updated_at
    ) VALUES (?, ?, 'queued', 0, ?, 'Unknown Artist', 'YouTube imports',
      'Unknown Artist', ?, ?, ?, ?, ?, ?)
  `);

  const created = [];
  const skipped = [];
  urls.forEach((url, index) => {
    const id = randomUUID();
    const createdAt = now();
    const trackNumber = String(count + index + 1);
    const title = `YouTube link ${trackNumber}`;
    const comment = "Source=YouTube; best available from YouTube. This cannot restore YouTube compression.";
    const playlists = JSON.stringify(["iPod - YouTube Converts"]);
    const result = insert.run(id, url, title, trackNumber, comment, outputOption, playlists, createdAt, createdAt);
    if (result.changes) created.push(getJob(db, id));
    else skipped.push(url);
  });

  return { created, skipped, jobs: listJobs(db) };
}

export function updateJob(db, id, patch) {
  const entries = Object.entries(patch).filter(([key]) => JOB_FIELDS[key]);
  if (!entries.length) return getJob(db, id);

  const assignments = entries.map(([key]) => `${JOB_FIELDS[key]} = ?`);
  const values = entries.map(([key, value]) => {
    if (key === "playlists") return JSON.stringify(normalizePlaylists(value));
    return value ?? "";
  });
  assignments.push("updated_at = ?");
  values.push(now(), id);

  db.prepare(`UPDATE jobs SET ${assignments.join(", ")} WHERE id = ?`).run(...values);
  return getJob(db, id);
}

export function removeJob(db, id) {
  const job = getJob(db, id);
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  return job;
}

export function addLog(db, msg, kind = null, label = null) {
  const log = { t: new Date().toLocaleTimeString("en-US", { hour12: false }), kind, label, msg };
  db.prepare("INSERT INTO logs (t, kind, label, msg) VALUES (?, ?, ?, ?)").run(log.t, kind, label, msg);
  return log;
}

export function listLogs(db, limit = 250) {
  return db.prepare("SELECT t, kind, label, msg FROM logs ORDER BY id DESC LIMIT ?").all(limit).reverse();
}
