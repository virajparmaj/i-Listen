#!/usr/bin/env node
/**
 * Back-fill Music identity columns for existing jobs.
 *
 * Rows created before the identity layer have no music_database_id, and the
 * music_persistent_id they do have came from `add ... to playlist` — that is the
 * playlist ENTRY's id, not the library track's, so it can never be looked up.
 * This resolves each approved job to its live playlist row and records the real
 * database ID, the path Music actually stores, and the current tag version.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npm run repair:music-ids
 *   npm run repair:music-ids -- --apply
 *   npm run repair:music-ids -- --apply --playlist "iPhone Sync"
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { MASTER_PLAYLIST, readPlaylistEntries } from "../lib/appleMusic.js";
import { listJobs, openDatabase, updateJob } from "../lib/db.js";
import { buildIndex, resolvePresence } from "../lib/musicIndex.js";

function parseArgs(argv) {
  const args = { apply: false, playlist: MASTER_PLAYLIST, project: join(homedir(), "Music", "iListen Project") };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") args.apply = true;
    else if (argv[i] === "--playlist") args.playlist = argv[++i];
    else if (argv[i] === "--project") args.project = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openDatabase(join(args.project, "ilisten.sqlite"));

  const approved = listJobs(db).filter((job) =>
    job.status === "complete" && job.outputPath && job.exportStatus !== "invalid" && job.metadataReviewStatus === "approved");

  const entries = await readPlaylistEntries(args.playlist);
  const index = buildIndex(entries);

  console.log(`Playlist "${args.playlist}": ${entries.length} rows`);
  console.log(`Approved jobs: ${approved.length}`);
  console.log(args.apply ? "\nMode: APPLY\n" : "\nMode: dry run (pass --apply to write)\n");

  let matched = 0;
  let unmatched = 0;
  const patches = [];

  for (const job of approved) {
    const entry = resolvePresence(job, index);
    if (!entry?.databaseId) {
      unmatched += 1;
      console.log(`  MISS  ${job.artist} — ${job.title}`);
      continue;
    }
    matched += 1;
    patches.push([job, {
      musicDatabaseId: entry.databaseId,
      musicPersistentId: entry.persistentId || job.musicPersistentId || "",
      musicLocationPath: entry.path || "",
      // Deliberately NOT setting musicTagVersion: we cannot prove Music's tags
      // match the file, so leave it empty and let the next handoff refresh once.
      musicTagVersion: "",
    }]);
  }

  if (args.apply) {
    for (const [job, patch] of patches) updateJob(db, job.id, patch);
    console.log(`\nWrote identity for ${patches.length} job${patches.length === 1 ? "" : "s"}.`);
  }

  console.log(`\nmatched: ${matched}  unmatched: ${unmatched}`);
  const inMedia = patches.filter(([, p]) => p.musicLocationPath.includes("/Music/Music/Media")).length;
  if (inMedia) {
    console.log(`${inMedia} track${inMedia === 1 ? " is" : "s are"} stored inside Music's Media folder, not the iListen exports folder.`);
    console.log('Turn off Music > Settings > Files > "Copy files to Music Media folder when adding to library" to stop new copies.');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
