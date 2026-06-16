import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { customPlaylists, normalizePlaylists } from "./metadata.js";

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
  customCoverPath: "custom_cover_path",
  durationSec: "duration_sec",
  sizeBytes: "size_bytes",
  playlists: "playlists",
  disc: "disc",
  conversionStatus: "conversion_status",
  metadataStatus: "metadata_status",
  artworkStatus: "artwork_status",
  exportStatus: "export_status",
  appleMusicImportStatus: "apple_music_import_status",
  appleMusicPlaylistStatus: "apple_music_playlist_status",
  readyForFinderSync: "ready_for_finder_sync",
  syncState: "synced_or_needs_manual_sync",
  lastError: "last_error",
  musicPersistentId: "music_persistent_id",
  sourceBatch: "source_batch",
  metadataReviewStatus: "metadata_review_status",
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

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
}

function addColumnIfMissing(db, table, name, definition) {
  if (columnNames(db, table).has(name)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

function migrateSchema(db) {
  addColumnIfMissing(db, "jobs", "playlists", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, "jobs", "custom_cover_path", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "disc", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "conversion_status", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "metadata_status", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "artwork_status", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "export_status", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "apple_music_import_status", "TEXT NOT NULL DEFAULT 'pending'");
  addColumnIfMissing(db, "jobs", "apple_music_playlist_status", "TEXT NOT NULL DEFAULT 'pending'");
  addColumnIfMissing(db, "jobs", "ready_for_finder_sync", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "jobs", "synced_or_needs_manual_sync", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "last_error", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "music_persistent_id", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "source_batch", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, "jobs", "metadata_review_status", "TEXT NOT NULL DEFAULT 'pending'");
  addColumnIfMissing(db, "logs", "category", "TEXT NOT NULL DEFAULT 'general'");
}

function backfillPlaylists(db) {
  const rows = db.prepare("SELECT id, playlists FROM jobs").all();
  const update = db.prepare("UPDATE jobs SET playlists = ?, updated_at = ? WHERE id = ?");
  rows.forEach((row) => {
    const names = parsePlaylists(row.playlists);
    if (JSON.stringify(names) === String(row.playlists || "[]")) return;
    update.run(JSON.stringify(names), now(), row.id);
  });
}

/**
 * Tracks converted before the iPod-sync pipeline existed have no export/metadata
 * status. Trust the prior conversion: mark complete jobs that produced an output
 * file as validated so they become eligible for Apple Music handoff.
 */
function backfillStatuses(db) {
  const rows = db.prepare(
    "SELECT id, output_path, title, artist, album, cover_path, custom_cover_path FROM jobs WHERE status = 'complete' AND export_status = '' AND output_path != ''"
  ).all();
  const update = db.prepare(
    "UPDATE jobs SET conversion_status = 'complete', export_status = 'validated', metadata_status = ?, artwork_status = ? WHERE id = ?"
  );
  rows.forEach((row) => {
    const metadataStatus = row.title && row.artist && row.album ? "complete" : "incomplete";
    const artworkStatus = row.custom_cover_path || row.cover_path ? "embedded" : "missing";
    update.run(metadataStatus, artworkStatus, row.id);
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

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);
  migrateSchema(db);
  backfillPlaylists(db);
  backfillStatuses(db);
  return db;
}

export function getState(db, key, fallback = null) {
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setState(db, key, value) {
  const next = value == null ? "" : String(value);
  db.prepare(
    "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, next);
  return next;
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
    customCoverPath: row.custom_cover_path || "",
    playlists: parsePlaylists(row.playlists),
    disc: row.disc || "",
    durationSec: row.duration_sec,
    sizeBytes: row.size_bytes,
    conversionStatus: row.conversion_status || "",
    metadataStatus: row.metadata_status || "",
    artworkStatus: row.artwork_status || "",
    exportStatus: row.export_status || "",
    appleMusicImportStatus: row.apple_music_import_status || "pending",
    appleMusicPlaylistStatus: row.apple_music_playlist_status || "pending",
    readyForFinderSync: Number(row.ready_for_finder_sync || 0),
    syncState: row.synced_or_needs_manual_sync || "",
    lastError: row.last_error || "",
    musicPersistentId: row.music_persistent_id || "",
    sourceBatch: row.source_batch || "",
    metadataReviewStatus: row.metadata_review_status || "pending",
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
      comment, output_option, playlists, metadata_review_status, created_at, updated_at
    ) VALUES (?, ?, 'queued', 0, ?, 'Unknown Artist', 'Unknown Album',
      'Unknown Artist', ?, ?, ?, ?, 'pending', ?, ?)
  `);

  const created = [];
  const skipped = [];
  urls.forEach((url, index) => {
    const id = randomUUID();
    const createdAt = now();
    const trackNumber = String(count + index + 1);
    const title = `YouTube link ${trackNumber}`;
    const comment = "Source=YouTube; best available from YouTube. This cannot restore YouTube compression.";
    const playlists = JSON.stringify([]);
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
    if (key === "playlists") return JSON.stringify(customPlaylists(value));
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

export function addLog(db, msg, kind = null, label = null, category = "general") {
  const log = { t: new Date().toLocaleTimeString("en-US", { hour12: false }), kind, label, msg, category };
  db.prepare("INSERT INTO logs (t, kind, label, msg, category) VALUES (?, ?, ?, ?, ?)").run(
    log.t,
    kind,
    label,
    msg,
    category
  );
  return log;
}

export function listLogs(db, limit = 250) {
  return db.prepare("SELECT t, kind, label, msg, category FROM logs ORDER BY id DESC LIMIT ?").all(limit).reverse();
}
