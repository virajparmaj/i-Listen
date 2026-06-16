# iListen Agent Handoff

This file is the durable context handoff for new Claude/Codex chats working in this repo. Read it before making changes, then update it before ending any substantial coding session.

## Current Repo State

- Project root: `/Users/veerr_89/Work/tools/i-Listen`.
- App: Vite + React frontend with a local Node helper.
- Helper command: `npm run helper`.
- Dev UI command: `npm run dev`.
- Default local project folder: `/Users/veerr_89/Music/iListen Project`.
- SQLite DB: `/Users/veerr_89/Music/iListen Project/ilisten.sqlite`.
- Clean music export root: `/Users/veerr_89/Music/iListen Project/exports/Music Library`.
- Apple Music folder used by iListen: `iListen`.
- Required Apple Music sync playlist name: `iPod Sync`.
- Finder/iPod sync happens through the device entry `Viraj Parmar's iPod`, not the plain mounted disk `/Volumes/iPod`.
- `/Volumes/iPod` is storage-only for loose files; copying files there does not update the iPod music database.

## Implemented Workflow

The intended workflow is:

1. Convert YouTube links.
2. Treat YouTube metadata as a rough first pass only.
3. Clean and approve metadata.
4. Move/rename files into the clean library structure.
5. Retag audio files.
6. Add approved tracks to Apple Music playlist `iPod Sync`.
7. Sync `iPod Sync` to the physical iPod in Finder.

Newly converted tracks should not go directly to Apple Music as final. They should pass through metadata review/approval first.
Apple Music handoff is incremental: once a track is already marked as added to `iPod Sync`, later handoffs skip it and process only newly approved or changed tracks. Metadata edits/re-approval reset the Apple Music status to pending so changed tracks can be re-added.

## Naming And Metadata Rules

- Songs should look like normal music-library entries.
- Do not use YouTube-derived terms as final user-facing metadata.
- Avoid final names/albums/playlists such as `YouTube imports`, `YouTube Converts`, `iPod - YouTube Converts`, or `iPod - Artist`.
- Do not auto-create `iPod - ...` playlists.
- If legacy `iPod - ...` playlist names are submitted, filter them before persistence/handoff.
- Keep one required sync playlist: `iPod Sync`.
- Custom playlists may be created only when the user explicitly assigns them.
- Use neutral music placeholders such as `Unknown Artist` / `Unknown Album` for unreviewed jobs; do not use source-site terms as album names.
- File paths after approval should be:

```text
Music Library/{Artist}/{Album}/{Track # - Title}.m4a
```

- Retag files whenever title, artist, album, album artist, year, track, disc, artwork, or output path changes.
- Keep DB `outputPath` in sync with any file move so preview, reports, and Apple Music handoff keep working.

## Current Live Library State

The original three-track cleanup has already been applied and handed off to Apple Music:

```text
Apocalypse | Cigarettes After Sex | Cigarettes After Sex
Cry | Cigarettes After Sex | Cry
Starboy | The Weeknd | Starboy
```

These three tracks are included in the live Apple Music playlist `iPod Sync`.

Clean exported file paths:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/Cigarettes After Sex/04 - Apocalypse.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/Cry/07 - Cry.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Weeknd/Starboy/01 - Starboy.m4a
```

On 2026-06-15, the user-added `Needs review` batch was cleaned, organized, retagged with clean artwork, approved, and added to Apple Music. During verification, Apple Music initially showed 13 rows with duplicates of older tracks and four missing new tracks; the `iPod Sync` playlist was rebuilt from the 14 approved export files. The live Apple Music playlist now contains 14 tracks exactly once:

```text
Somebody Else | The 1975 | I like it when you sleep, for you are so beautiful yet so unaware of it | 2016 | track 10
Be My Mistake | The 1975 | A Brief Inquiry Into Online Relationships | 2018 | track 6
Sadi Gali | Lehmber Hussainpuri | Tanu Weds Manu (Original Motion Picture Soundtrack) | 2011 | track 1
Wo Ajnabee | Mithoon & Shilpa Rao | The Train (Original Motion Picture Soundtrack) | 2007 | track 1
Try Me | The Weeknd | My Dear Melancholy, | 2018 | track 2
Baby (feat. Ludacris) | Justin Bieber | My World 2.0 | 2010 | track 1
Mystery of Love | Sufjan Stevens | Call Me by Your Name (Original Motion Picture Soundtrack) | 2017 | track 13
The Night We Met | Lord Huron | Strange Trails | 2015 | track 14
Teri Tasveer | Bayaan | Suno | 2020 | track 6
Can I Call You Tonight? | Dayglow | Fuzzybrain | 2018 | track 2
Gallan 4 | Talwiinder | Gallan 4 - Single | 2020 | track 1
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/The 1975/I like it when you sleep, for you are so beautiful yet so unaware of it/10 - Somebody Else.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The 1975/A Brief Inquiry Into Online Relationships/06 - Be My Mistake.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Lehmber Hussainpuri/Tanu Weds Manu (Original Motion Picture Soundtrack)/01 - Sadi Gali.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Mithoon & Shilpa Rao/The Train (Original Motion Picture Soundtrack)/01 - Wo Ajnabee.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Weeknd/My Dear Melancholy,/02 - Try Me.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Justin Bieber/My World 2.0/01 - Baby (feat. Ludacris).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Sufjan Stevens/Call Me by Your Name (Original Motion Picture Soundtrack)/13 - Mystery of Love.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Lord Huron/Strange Trails/14 - The Night We Met.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Bayaan/Suno/06 - Teri Tasveer.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Dayglow/Fuzzybrain/02 - Can I Call You Tonight.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Talwiinder/Gallan 4 - Single/01 - Gallan 4.m4a
```

## Important Code Areas

- `server/lib/metadata.js`: YouTube metadata inference and cleanup rules.
- `server/lib/organize.js`: batch organize, path rename/move, retag, approval state.
- `server/lib/retag.js`: FFmpeg retagging helper.
- `server/lib/appleMusic.js`: Apple Music folder/playlist automation. `MASTER_PLAYLIST` must stay `iPod Sync` unless the user changes the sync playlist name again.
- `server/lib/db.js`: persisted job fields including metadata review/approval and Apple Music status.
- `server/index.js`: helper API endpoints including organize and Apple Music handoff/cleanup.
- `src/components/SyncView.jsx`: sync workflow UI.
- `src/components/SyncStatusBadge.jsx`: track status labels.
- `src/components/PlaylistStructurePanel.jsx`: playlist preview.
- `src/hooks/useConverter.js`: frontend helper actions.
- `src/utils/localHelper.js`: HTTP client for local helper endpoints.

## API/Behavior Added

- Added metadata review states:
  - `needs_review`
  - `approved`
- Converted tracks become review candidates instead of final Apple Music imports.
- Apple Music handoff only accepts approved tracks.
- Added batch organize endpoint support for cleaned metadata and playlist assignments.
- Added Apple Music stale playlist cleanup support.
- Removed default auto playlist generation for `iPod - YouTube Converts` and `iPod - Artist`.
- Replaced the old source-site album placeholder with `Unknown Album`.
- DB/job updates now filter legacy `iPod - ...` playlist names instead of storing them.
- Apple Music automation now handles imported-track persistent ID lookup defensively so a successful import does not become a false failure.
- Apple Music handoff now defaults to pending/new-or-changed approved tracks only; if everything approved is already in `iPod Sync`, `/ipod/handoff` returns a successful no-op with `message: "Nothing new to add; sync in Finder."`.
- The Sync tab now separates pending Apple Music handoff from tracks already ready for Finder sync and shows a compact Finder checklist once tracks are in `iPod Sync`.

## Verification Baseline

Last verified after incremental Apple Music handoff + Sync tab Finder guidance:

```bash
npm test
npm run lint
npm run build
```

Expected baseline:

```text
11 test files passed
52 tests passed
lint passed
build passed
```

Live-library verification on 2026-06-15 after the 11-track cleanup and Apple Music playlist repair:

```text
14 complete / 14 approved / 14 validated / 14 artwork embedded
14 tracks imported / 14 tracks in Apple Music iPod Sync
Apple Music user playlist iPod Sync count: 14
0 tracks still marked Needs review
Sync tab should show: Nothing new to add; sync in Finder
```

Later on 2026-06-15, one newly added `Needs review` track was cleaned, organized, retagged with clean soundtrack artwork, and approved:

```text
Yahan Ke Hum Sikandar | Udit Narayan, Sadhana Sargam & Jatin-Lalit | Jo Jeeta Wohi Sikandar (Original Motion Picture Soundtrack) | 1992 | track 6
```

Clean exported file path:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/Udit Narayan, Sadhana Sargam & Jatin-Lalit/Jo Jeeta Wohi Sikandar (Original Motion Picture Soundtrack)/06 - Yahan Ke Hum Sikandar.m4a
```

Current live-library verification after that single-track cleanup:

```text
15 complete / 15 approved / 15 validated
14 tracks already added to Apple Music iPod Sync
1 approved track pending Apple Music handoff: Yahan Ke Hum Sikandar
0 tracks still marked Needs review
Sync tab should show: Add 1 new/changed to Apple Music
```

## Current User-Facing Next Step

There is currently 1 newly approved track pending Apple Music handoff. Use the Sync tab button `Add 1 new/changed to Apple Music`, then sync `iPod Sync` in Finder. Do not just unplug the iPod from the Apple Music playlist view. After Finder finishes syncing, eject the iPod.

To hear songs on the iPod, the user should:

1. Open Finder.
2. Select `Viraj Parmar's iPod` in the sidebar.
3. Open the Music tab.
4. Sync selected playlists.
5. Select `iPod Sync`.
6. Click Apply/Sync.
7. Eject the iPod and play `Music > Playlists > iPod Sync`.

If Finder asks to `Erase and Sync`, pause and confirm with the user before proceeding because the iPod may be linked to another library.

## Maintenance Rule For Future Agents

Before ending any substantial session, update this file with:

- What changed in code behavior.
- Any live local/Apple Music/iPod state that was changed manually.
- Any commands/tests run and their result.
- Any known broken/stale docs or follow-up work.
- The exact next step a new chat should take.

Keep this file factual, current, and short enough that a new coding chat can read it before touching the repo.
