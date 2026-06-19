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

## UI Design System (Apple-2010 restyle, 2026-06-16)

Styling is a hand-built CSS-variable system — **no Tailwind, no shadcn**. Tokens live in
`src/styles/tokens.css`, layout in `src/styles/global.css`, custom UI kit in
`src/components/ui/`. Aesthetic target: authentic early-2010s Apple (iTunes 10 / iPod
Classic / Aqua skeuomorphism).

- **Type:** one Apple sans stack (`Lucida Grande, Helvetica Neue, ...`) drives all UI. The
  former decorative aliases (`--font-display/-deco/-script/-typewriter`) now all point at
  `--font-ui`, so class/inline usages inherit it without per-component edits. `--font-lcd`
  (VT323) is kept **only** for the iPod LCD readout; `--font-terminal` for the logs panel.
  `index.html` now loads only VT323 from Google Fonts.
- **Aqua gel:** `--grad-primary`/`--grad-select` + `--gloss-aqua` give glassy blue buttons;
  primary/danger buttons are pill-shaped (`Button.jsx` per-variant `radius`). Badges are
  glossy lozenges (`Badge.jsx`). Chrome/graphite gradients refined to brushed metal.
- **App-shell scroll model (important):** `.il-desktop` is capped to the viewport
  (`height:100dvh; overflow:hidden`); `main.il-app-main` is the scroll container
  (`overflow-y:auto`, themed via `il-scroll`). The Convert queue scrolls **inside its card**
  (`.il-queue-list { min-height:0; overflow-y:auto }` + `il-scroll`) instead of growing the
  page. The side-rail no longer stretches (`align-self:flex-start`, Export card is
  content-sized). `--topbar-h` (56px) anchors sticky/fixed offsets.
- **Wide-monitor layout pass (same day):** added `--content-wide` (1600px); the Convert
  grid, Library grid, and Sync view are centered at that width (`margin-inline:auto`) so big
  monitors look intentional instead of edge-to-edge stretched. **Sync's old hard
  `maxWidth:1080` cap was removed** (it wasted half a wide screen) — it now uses
  `--content-wide`. Long lists are bounded scroll boxes (`il-scroll` + `max-height`): the
  Library folder/playlist trees (`LibraryView.jsx`) and the Sync Tracks list
  (`SyncView.jsx`); the Library sidebar is sticky. No new sidebars were added — the existing
  Convert right-rail and Library sidebar already cover that need.
- **Link-chips input + crush fix (same day):** the Convert "Import YouTube links" card was
  collapsing to thin strips with a full queue — `.il-import-card` has `overflow:hidden`, so
  its flex auto-min hit 0 and the tall queue crushed it. Fixed with `.il-import-card { flex: 0
  0 auto }` (it keeps its natural height; the queue section absorbs/scrolls). The paste
  textarea was replaced by a compact chip field: `src/components/LinkChipsInput.jsx` (paste →
  one removable pill per link, ✕ to remove, dedupe, internal scroll) backed by
  `src/utils/links.js` (`extractYouTubeLinks`/`isYouTubeUrl`/`mergeLinks`/`linkLabel`, tested
  in `links.test.js`). `PastePanel` now holds `links` as a `string[]` and calls
  `onAdd(links.join("\n"))`. The quality preset is now 2-up (compact) so the card stays short.
  Verified against the live 140-track queue: card stays full-height, queue scrolls internally.
- **Sync declutter + 2-col tracks (same day):** trimmed the Sync prose to minimal essentials —
  the "How songs reach your iPod" explainer is now two one-line chips (`IpodExplainer.jsx`),
  the device-panel instructions are shortened and the redundant disk-warning box removed
  (`IpodDevicePanel.jsx`), the playlist hint is one line (`PlaylistStructurePanel.jsx`), and
  the Finder checklist is 3 terse steps instead of 7 (`SyncView.jsx`). The "Tracks" list is
  now a 2-column grid (`.il-track-grid` in `global.css`, collapses to 1 col under 860px) for
  denser viewing. No facts dropped — the iPod-vs-disk distinction and the Erase-and-Sync
  warning are preserved in minimal form.
- **Per-track delete controls (2026-06-18):** faulty conversions can now be deleted from both
  surfaces the user actually works from: the Convert queue and the Sync "Tracks" grid. Queue
  rows now show a trash action for completed/queued/failed/skipped/canceled jobs
  (`QueueRow.jsx`), and Sync rows have a visible `Delete` button (`SyncView.jsx`). The app
  confirms before destructive deletes (`App.jsx`), and helper-backed deletion now removes the
  DB row plus any local export/staging/artwork files tied to that job (`server/index.js`).
  This is intentionally local-project cleanup only; if a track was already handed off to Apple
  Music, the UI warns that Apple Music cleanup may still be manual.
- **Queue control sizing follow-up (2026-06-18):** the first delete-controls pass made the
  Convert queue action cluster too cramped on desktop because the row still reserved only
  `150px` for actions. `QueueRow.jsx` now uses compact square icon buttons for art/edit/delete
  and lets the actions column size to `max-content`, which restores the earlier spacing without
  changing behavior.
- **Sync top explainer removed (2026-06-18):** the two-chip banner at the top of Sync
  (`IpodExplainer`) is no longer rendered in `SyncView.jsx`; the page now opens directly on
  the device/playlists controls.
- **Finder checklist moved up (2026-06-18):** `Finish in Finder` now sits in the top-right
  Sync column directly under `Apple Music playlists` instead of as a full-width card lower on
  the page. This uses the empty space beside the iPod device card and keeps the main handoff
  section tighter.
- **Finder checklist sizing follow-up (2026-06-18):** removed the yellow `If Finder asks to
  Erase and Sync...` warning strip from `Finish in Finder`, and the top Sync two-column layout
  now stretches so the combined height of the right stack matches the left `Connected iPod`
  card. `SyncView.jsx` does this by making the right column a full-height `auto + 1fr` stack.
- Verified after the restyle + layout + chips + Sync-declutter passes: `npm run lint` clean,
  `npm test` 15 files / 88 pass, `npm run build` ok (~258 kB JS / ~75 kB gzip). No
  server/DB/Apple-Music code touched.
- `.claude/launch.json` added for the Claude preview tool (Vite dev on port 5173).

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

Local AI metadata auto-approval:

- `server/lib/metadataAi.js`: builds compact evidence-first metadata context, calls local Ollama structured JSON, sanitizes/falls back proposals.
- `server/lib/musicBrainz.js`: polite MusicBrainz recording search/ranking (1 request/sec default, meaningful User-Agent).
- `server/lib/itunes.js`: Apple/iTunes Search lookup/ranking for catalog title/artist/album/year/track/genre evidence; supports fallback queries for noisy YouTube titles.
- `server/lib/acoustid.js`: optional `fpcalc` + AcoustID lookup when `ILISTEN_ACOUSTID_CLIENT_KEY` is set.
- `server/lib/db.js`: AI metadata run fields plus `metadata_examples` correction store for later fine-tuning.
- `server/lib/metadataExamples.js` + `server/scripts/export-metadata-examples.js`: JSONL export of correction examples for later fine-tuning/evaluation.
- `server/index.js`: `POST /jobs/:id/ai-approve`; injectable `state.proposeAiMetadata`/`state.organizeExport` for tests.
- `src/components/SyncView.jsx`: `AI approve ... unreviewed` batch button and per-row working animation/state.

Convert-with-XML feature (Apple Music library import):

- `server/lib/libraryXml.js`: parses an Apple Music `Library.xml` (plist) into `{ playlists, tracksById }`; mirrors vault-verse's `LibraryXMLParser.swift` (skips `Master`/`Distinguished Kind` playlists, 200 MB cap, friendly errors). Uses the `plist` npm package.
- `server/lib/youtubeSearch.js`: `searchTracks`/`searchTrack` resolve a song into real YouTube videos via `yt-dlp "ytsearchN:<query>" --dump-single-json --skip-download` (no API key); ranks candidates with a duration+title confidence score and flags weak matches.
- `server/lib/db.js`: `createJobsFromMatches` seeds jobs from approved matches (clean metadata + playlist assignment + `sourceBatch`); `existingTrackKeys`/`trackKey` for dedup.
- `src/hooks/useXmlImport.js`: XML-import state machine (upload → select → review) + pure helpers.
- `src/components/xml/`: `XmlImportView` (orchestrator), `LibraryUpload`, `PlaylistPicker`, `TrackSelectList`, `MatchReview`.
- Top bar `Import` tab labeled "Convert with XML" (`src/components/TopBar.jsx`, `src/App.jsx`).

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
- Added "Convert with XML" mode (`Import` tab). New endpoints: `POST /library/parse` (upload `Library.xml` → playlists + tracks, each annotated `existing` for dedup), `POST /library/search` (YouTube search per track → ranked candidates + confidence; injectable via `state.searchTracks` for tests), `POST /library/import` (create jobs from approved matches seeded with clean XML metadata + playlist names, then auto-start conversion through a 2-wide pool unless `autoStart:false`). XML metadata wins over YouTube-inferred metadata because the conversion pipeline only overwrites placeholder fields. Each selected XML playlist becomes a `job.playlists` entry, so the existing Apple Music handoff recreates it under the `iListen` folder + `iPod Sync`. Imported tracks still pass through the normal `needs_review → approved` organize step before handoff.
- Added local AI metadata approval (`POST /jobs/:id/ai-approve`). It requires a completed export, generates a local Ollama metadata proposal, optionally uses MusicBrainz/AcoustID candidates, then reuses `organizeExport` so approval only turns green after move + retag + validation. Failure leaves the row unapproved with `lastError`.
- AI metadata is evidence-first: strong MusicBrainz, Apple/iTunes, or AcoustID evidence can approve through an `evidence-only` shortcut without calling Ollama; ambiguous rows use compact current metadata/tags, YouTube title/uploader/duration/date, top 3 MusicBrainz candidates, top 3 Apple/iTunes candidates, top 3 AcoustID candidates, and relevant manual correction examples with the local model. It should choose/normalize from evidence instead of inventing album/year/track values. Low-confidence proposals, unresolved albums, and titles unsupported by source/catalog evidence stay in `needs_review`.
- AI metadata env vars: `ILISTEN_OLLAMA_URL` (default `http://127.0.0.1:11434`), `ILISTEN_METADATA_MODEL` (default `qwen:1.8b`), `ILISTEN_METADATA_TIMEOUT_MS` (default `45000`), optional `ILISTEN_ACOUSTID_CLIENT_KEY`, plus optional tool overrides `ILISTEN_OLLAMA` and `ILISTEN_FPCALC`.
- `/health` includes cached `aiMetadata` readiness (`ok`, model, error, approval timeout, 5000 ms preflight timeout). Timeout failures show `Local metadata model timed out. Try qwen:1.8b or restart Ollama.` and keep the row in `needs_review`.
- Metadata examples can be exported for later model work with `npm run export:metadata-examples`; default output is `~/Music/iListen Project/metadata-examples.jsonl`.

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

After the Convert-with-XML feature (2026-06-16):

```text
14 test files passed
77 tests passed
lint passed
build passed (dist ~257 kB, gzip ~75 kB)
```

After the delete-controls + artifact-cleanup pass (2026-06-18):

```text
20 test files passed
123 tests passed
lint passed
build passed (dist ~262 kB, gzip ~76 kB)
browser verified on local dev server (http://127.0.0.1:4173) with no error overlay or console errors
```

After the Local AI Metadata Auto-Approval feature (2026-06-18):

```text
npm test → 17 test files passed / 99 tests passed
npm run lint → passed
npm run build → passed (dist JS ~260 kB / gzip ~75.6 kB)
```

No live library, Apple Music, or iPod state was changed during the 2026-06-18 code implementation.

Later on 2026-06-18, local launch/setup docs were added to `README.md` and then updated for the small-model AI reviewer:

```text
Run Locally now includes brew installs, Ollama `qwen:1.8b` setup, helper/UI launch, AI metadata env vars, optional AcoustID setup, troubleshooting curls, `POST /jobs/:id/ai-approve`, and JSONL metadata-example export.
Verified local services:
- Ollama API: http://127.0.0.1:11434/api/tags was reachable during the earlier launch check; current recommended model is `qwen:1.8b`
- Helper: http://127.0.0.1:4317/health, tools ready except optional fpcalc missing
- Vite UI: http://127.0.0.1:5173/ returned 200 OK
Commands run: `npm install`, `npm run helper`, `npm run dev -- --host 127.0.0.1`.
Detached local processes left running after launch: helper PID 19890 (`/tmp/ilisten-helper.log`), Vite PID 20969 (`/tmp/ilisten-vite.log`).
No live library, Apple Music, or iPod handoff state was intentionally changed; helper startup only opened the existing project.
```

Later on 2026-06-18, Convert and Sync track ordering was changed so the UI surfaces current work instead of the oldest catalog rows:

```text
src/utils/trackOrdering.js sorts Convert rows by active conversion → queued → failed/canceled → needs review → pending handoff → skipped → finished, newest additions first inside each group.
src/components/Queue.jsx uses that ordering for the Conversion queue only; backend `listJobs` still returns stable oldest-first data.
src/components/SyncView.jsx uses Sync ordering: AI-running/needs-review rows, pending Apple Music handoff, then Finder-sync rows, newest first. Batch AI approval and the Apple Music handoff button follow the visible order.
server/index.js preserves explicit `/ipod/handoff` id order, so latest-first Sync handoffs are not snapped back to DB order.
npm test → 18 test files passed / 103 tests passed
npm run lint → passed
npm run build → passed (dist JS 260.96 kB / gzip 75.93 kB)
No live library, Apple Music, or iPod state was changed during this code implementation.
```

Later on 2026-06-18, the local AI metadata reviewer was changed for the 8 GB M1 MacBook Pro path:

```text
Default model changed from llama3:latest to qwen:1.8b; ILISTEN_METADATA_MODEL still overrides it.
Added ILISTEN_METADATA_TIMEOUT_MS (default 45000) and a short cached /health AI preflight.
Ollama timeouts now show: "Local metadata model timed out. Try qwen:1.8b or restart Ollama."
AI context is compact/evidence-first: current metadata, embedded tags, compact YouTube facts, top 3 MusicBrainz, top 3 AcoustID, 5 correction examples.
Added an evidence-only shortcut: complete high-scoring MusicBrainz/AcoustID candidates skip Ollama entirely, preserving playlists and returning model=evidence-only.
Correction examples are selected per track from a larger recent pool by title/artist/album overlap, then newest fallback, so prompts train on task-relevant edits instead of arbitrary recent rows.
AI approvals now store the compact evidence snapshot in metadata_examples.
Added `npm run export:metadata-examples` to export metadata_examples JSONL for later fine-tuning/evaluation; no training is run in-app.
npm test -> 19 test files passed / 112 tests passed
npm run lint -> passed
npm run build -> passed (dist JS 260.96 kB / gzip 75.93 kB)
`npm run export:metadata-examples -- --project /tmp/.../project --output /tmp/.../examples.jsonl` -> passed against an isolated temp project (0 examples, empty file)
No live library, Apple Music, or iPod state was changed during this code implementation.
Known follow-up: pull `qwen:1.8b` locally with `ollama pull qwen:1.8b`, then try a small AI-approval batch and inspect the exported examples before any future fine-tuning.
```

Later on 2026-06-18, the local 404 failure from the AI metadata reviewer was fixed:

```text
Observed live failure: Ollama returned 404 for model=qwen:1.8b because the model had not been installed locally.
Ran `ollama pull qwen:1.8b`; `ollama list` now includes qwen:1.8b (about 1.1 GB).
Verified a direct local Ollama `qwen:1.8b` API call returned successfully; no live AI approvals were triggered during verification.
Model-missing 404s now surface as: "Local metadata model qwen:1.8b is not installed. Run: ollama pull qwen:1.8b" instead of the generic "Ollama returned 404" wrapper.
The cached /health AI preflight timeout was raised from 750 ms to 5000 ms because qwen:1.8b can take a few seconds to answer even when installed.
README troubleshooting now includes the exact missing-model recovery step.
npm test -> 19 test files passed / 115 tests passed
npm run lint -> passed
npm run build -> passed (dist JS 260.96 kB / gzip 75.93 kB)
No live library, Apple Music, or iPod state was intentionally changed during this fix.
```

Later on 2026-06-18, the AI metadata quality gate was hardened after three rows were auto-approved with copied/wrong metadata:

```text
Observed problem: Aasa Kooda and Ik Kudi were approved as "Lyrical: Labon Ko"; Labon Ko itself was left as T-Series / Unknown Album / track 141. Bad AI approvals were being stored as correction examples and then reused in the prompt.
Added Apple/iTunes Search evidence (`server/lib/itunes.js`) with fallback queries for noisy YouTube titles; MusicBrainz artist-credit join phrases now preserve separators.
AI prompt examples now use only relevant `manual_edit` examples. Prior `ai_approval` examples remain exportable for evaluation/fine-tuning, but are not fed back into the prompt.
AI auto-approval now blocks low confidence (<65%), unresolved/Unknown Album results, and titles not supported by YouTube/catalog evidence. AI-proposed playlists are ignored; existing source-comment playlists are filtered out.
Repaired and retagged the three corrupted live rows:
- Ik Kudi | wolf.cryman & Arpit Bala | Dil Fenk Ke Marunga 2 | 2023 | track 13
- Aasa Kooda | Sai Abhyankkar & Sai Smriti | Aasa Kooda (From "Think Indie") - Single | 2024 | track 1
- Labon Ko | Pritam & KK | Bhool Bhulaiyaa (Original Motion Picture Soundtrack) | 2007 | track 2
The three repaired rows were reset to Apple Music handoff pending so the corrected files can be re-added to `iPod Sync`.
npm test -> 20 test files passed / 122 tests passed
npm run lint -> passed
npm run build -> passed (dist JS 260.96 kB / gzip 75.93 kB)
```

End-to-end verified on 2026-06-16 against the real running helper (isolated temp port 4319 + temp project, live project untouched, autoStart:false so nothing downloaded):

```text
/library/parse  → skips Master playlist, extracts tracks w/ duration+year, flags existing
/library/search → real yt-dlp: Apocalypse 100% Δ0s, Starboy 100% Δ1s, 5 candidates each, none flagged
/library/import → 2 jobs created w/ seeded metadata + playlist "Late Night"; re-import dedups (skipped); non-YouTube URL → 400
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

Current live-library verification after that single-track cleanup, plus a manual Apple Music cleanup on 2026-06-16:

```text
15 complete / 15 approved / 15 validated
15 tracks in Apple Music iPod Sync
0 tracks still marked Needs review
iPod Sync was deduped from 29 rows to 15 unique clean tracks
Removed stale Apple Music library records: Apocalypse - Cigarettes After Sex (2 old YouTube-import rows), myinstants
Sync tab should show: Nothing new to add; sync in Finder
```

Later on 2026-06-16, a larger `Needs review` batch was cleaned and approved in place. Twelve tracks were normalized, re-tagged, and moved into clean library paths:

```text
Dhundhala | Yashraj, Dropped Out & Talwiinder | Dhundhala - Single | 2022 | track 1
Kangna | Dr Zeus, Master Rakesh, Shortie & Deepti | Unda Da Influence | 2003 | track 2
Kangana Tera Ni | Abeer Arora | Kangana Tera Ni - Single | 2017 | track 1
Mi Amor | Sharn & THE Paul | Mi Amor - Single | 2022 | track 1
Wishes (Remake) | Talwiinder | Wishes (Remake) - Single | 2025 | track 1
Hurt You | The Weeknd & Gesaffelstein | My Dear Melancholy, | 2018 | track 5
In Your Eyes | The Weeknd | After Hours | 2020 | track 10
Secrets | The Weeknd | Starboy | 2016 | track 6
Moth To A Flame | Swedish House Mafia & The Weeknd | Moth To A Flame - Single | 2021 | track 1
Sofia | Clairo | Immunity | 2019 | track 7
Back and Forth | SEBASTIAN PAUL | Back and Forth - Single | 2020 | track 1
Where's My Love | SYML | Hurt for Me - EP | 2016 | track 2
```

One duplicate review row was removed instead of approved:

```text
Starboy | The Weeknd · Daft Punk | Starboy
```

Current verification after that review cleanup:

```text
0 tracks still marked Needs review
12 approved tracks pending Apple Music handoff
15 tracks already added to Apple Music iPod Sync
Next Sync tab step should be: Add 12 new/changed to Apple Music
```

Later on 2026-06-16, five additional `Needs review` tracks were cleaned, re-tagged, organized into final library paths, and approved:

```text
Lucky Man | The Verve | Urban Hymns (Remastered 2016) | 1997 | track 9
Make You Mine | PUBLIC | Make You Mine - Single | 2019 | track 2
Take a Picture | Filter | Title Of Record | 1999 | track 6
Butterflies | Fiji Blue | Butterflies - Single | 2020 | track 1
Here I Am | Dubble Trubble | A Tribute to Bryan Adams - With Love | 2010 | track 1
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Verve/Urban Hymns (Remastered 2016)/09 - Lucky Man.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/PUBLIC/Make You Mine - Single/02 - Make You Mine.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Filter/Title Of Record/06 - Take a Picture.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Fiji Blue/Butterflies - Single/01 - Butterflies.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Dubble Trubble/A Tribute to Bryan Adams - With Love/01 - Here I Am.m4a
```

Current verification after this additional review cleanup:

```text
0 tracks still marked Needs review
17 approved tracks pending Apple Music handoff
15 tracks already added to Apple Music iPod Sync
Next Sync tab step should be: Add 17 new/changed to Apple Music
```

Later on 2026-06-16, another five `Needs review` tracks were cleaned, re-tagged, organized into final library paths, and approved:

```text
Robbers | The 1975 | The 1975 | 2013 | track 10
TOOTIMETOOTIMETOOTIME | The 1975 | A Brief Inquiry Into Online Relationships | 2018 | track 3
Love It If We Made It | The 1975 | A Brief Inquiry Into Online Relationships | 2018 | track 5
It's Not Living (If It's Not With You) | The 1975 | A Brief Inquiry Into Online Relationships | 2018 | track 11
Narcissist | No Rome | RIP Indo Hisashi - EP | 2018 | track 3
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/The 1975/The 1975/10 - Robbers.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The 1975/A Brief Inquiry Into Online Relationships/03 - TOOTIMETOOTIMETOOTIME.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The 1975/A Brief Inquiry Into Online Relationships/05 - Love It If We Made It.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The 1975/A Brief Inquiry Into Online Relationships/11 - It's Not Living (If It's Not With You).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/No Rome/RIP Indo Hisashi - EP/03 - Narcissist.m4a
```

Later on 2026-06-16, a follow-up seven-track batch was also cleaned, re-tagged, organized into final library paths, and approved:

```text
Remember When | Wallows | Nothing Happens | 2019 | track 9
Hurts Me | Wallows | Tell Me That It's Over | 2022 | track 8
These Days | Wallows | Spring - EP | 2018 | track 4
Wake Me | Bleachers | Strange Desire | 2014 | track 5
Rollercoaster | Bleachers | Strange Desire | 2014 | track 2
Don't Take the Money | Bleachers | Gone Now | 2017 | track 4
Close to You | Dayglow | Harmony House | 2021 | track 5
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/Wallows/Nothing Happens/09 - Remember When.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Wallows/Tell Me That It's Over/08 - Hurts Me.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Wallows/Spring - EP/04 - These Days.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Bleachers/Strange Desire/05 - Wake Me.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Bleachers/Strange Desire/02 - Rollercoaster.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Bleachers/Gone Now/04 - Don't Take the Money.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Dayglow/Harmony House/05 - Close to You.m4a
```

Current verification after both of those review cleanups:

```text
0 tracks still marked Needs review
29 approved tracks pending Apple Music handoff
15 tracks already added to Apple Music iPod Sync
Next Sync tab step should be: Add 29 new/changed to Apple Music
```

Session note for this live-library cleanup on 2026-06-16:

- Used `sqlite3` to inspect queue state before and after each batch.
- Used `yt-dlp`, iTunes Search, MusicBrainz, and Cover Art Archive lookups to normalize metadata and artwork.
- Used one-off `node` scripts that call `server/lib/organize.js` and `server/lib/db.js` helpers to move files, retag them, and mark jobs approved.
- Used `ffprobe` to confirm embedded tags on the cleaned exports.
- Did not rerun `npm test`, `npm run lint`, or `npm run build` because no repo code changed in this session.

Later on 2026-06-16, before the next cleanup pass started, the prior 29-track Apple Music handoff backlog had already been cleared outside this session:

```text
0 approved tracks pending Apple Music handoff at session start
44 approved tracks already marked imported in Apple Music
```

During the next live-library cleanup pass on 2026-06-16, seven new `Needs review` tracks were cleaned, re-tagged, organized into final library paths, and approved:

```text
The Adults Are Talking | The Strokes | The New Abnormal | 2020 | track 1
This Year's Love | David Gray | White Ladder | 1998 | track 8
After Dark | Mr.Kitty | Time | 2014 | track 9
Take Care | Beach House | Teen Dream (Bonus Track Version) | 2010 | track 10
i hate u, i love u (feat. Olivia O'Brien) | gnash | us | 2016 | track 6
intimate moments | Isaac Dunbar | evil twin | 2021 | track 4
Cruel (feat. ZAYN) | Snakehips | Cruel - Single | 2016 | track 1
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Strokes/The New Abnormal/01 - The Adults Are Talking.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/David Gray/White Ladder/08 - This Year's Love.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Mr.Kitty/Time/09 - After Dark.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Beach House/Teen Dream (Bonus Track Version)/10 - Take Care.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/gnash/us/06 - i hate u, i love u (feat. Olivia O'Brien).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Isaac Dunbar/evil twin/04 - intimate moments.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Snakehips/Cruel - Single/01 - Cruel (feat. ZAYN).m4a
```

In the same session, three additional `Needs review` tracks arrived and were also cleaned, re-tagged, organized into final library paths, and approved:

```text
Breaking Free | Night Riots | Love Gloom | 2016 | track 8
Out of My League | Fitz and The Tantrums | More Than Just a Dream | 2013 | track 1
Love Like Ghosts | Lord Huron | Strange Trails | 2015 | track 1
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/Night Riots/Love Gloom/08 - Breaking Free.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Fitz and The Tantrums/More Than Just a Dream/01 - Out of My League.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Lord Huron/Strange Trails/01 - Love Like Ghosts.m4a
```

Current verification after those two additional cleanup batches:

```text
0 tracks still marked Needs review
10 approved tracks pending Apple Music handoff
44 approved tracks already marked imported in Apple Music
Next Sync tab step should be: Add 10 new/changed to Apple Music
```

Session note for the later 2026-06-16 cleanup pass:

- Used `sqlite3` to confirm the Apple Music handoff backlog had already been cleared before new review work began.
- Used `yt-dlp`, iTunes Search, MusicBrainz, and Cover Art Archive lookups to normalize metadata and artwork.
- Used one-off `node` scripts that call `server/lib/organize.js` and `server/lib/db.js` helpers to move files, retag them, and mark jobs approved.
- Used `ffprobe` to confirm embedded tags on the cleaned exports.
- Did not rerun `npm test`, `npm run lint`, or `npm run build` because no repo code changed in this session.

Later on 2026-06-16, another ZAYN batch was cleaned, re-tagged, organized into final library paths, and approved:

```text
Dusk Till Dawn (feat. Sia) | ZAYN | Dusk Till Dawn (Radio Edit) [feat. Sia] - Single | 2017 | track 1
iT's YoU | ZAYN | Mind Of Mine (Deluxe Edition) | 2016 | track 3
I Don't Wanna Live Forever (Fifty Shades Darker) | ZAYN & Taylor Swift | Fifty Shades Darker (Original Motion Picture Soundtrack) | 2016 | track 1
Imprint | ZAYN | Icarus Falls | 2018 | track 5
There You Are | ZAYN | Icarus Falls | 2018 | track 11
Entertainer | ZAYN | Icarus Falls | 2018 | track 19
Fingers | ZAYN | Icarus Falls | 2018 | track 26
rEaR vIeW | ZAYN | Mind Of Mine (Deluxe Edition) | 2016 | track 8
Vibez | ZAYN | Nobody Is Listening | 2021 | track 4
Tightrope | ZAYN | Nobody Is Listening | 2021 | track 10
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Dusk Till Dawn (Radio Edit) [feat. Sia] - Single/01 - Dusk Till Dawn (feat. Sia).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Mind Of Mine (Deluxe Edition)/03 - iT's YoU.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN & Taylor Swift/Fifty Shades Darker (Original Motion Picture Soundtrack)/01 - I Don't Wanna Live Forever (Fifty Shades Darker).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Icarus Falls/05 - Imprint.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Icarus Falls/11 - There You Are.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Icarus Falls/19 - Entertainer.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Icarus Falls/26 - Fingers.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Mind Of Mine (Deluxe Edition)/08 - rEaR vIeW.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Nobody Is Listening/04 - Vibez.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/ZAYN/Nobody Is Listening/10 - Tightrope.m4a
```

After that, another five-track Cigarettes After Sex batch was cleaned, re-tagged, organized into final library paths, and approved:

```text
Dreaming of You | Cigarettes After Sex | I. - EP | 2012 | track 3
Stop Waiting | Cigarettes After Sex | Bubblegum - Single | 2023 | track 2
Dark Vacay | Cigarettes After Sex | X's | 2024 | track 6
Silver Sable | Cigarettes After Sex | X's | 2024 | track 3
Ambien Slide | Cigarettes After Sex | X's | 2024 | track 10
```

Clean exported file paths for this batch:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/I. - EP/03 - Dreaming of You.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/Bubblegum - Single/02 - Stop Waiting.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/X's/06 - Dark Vacay.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/X's/03 - Silver Sable.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Cigarettes After Sex/X's/10 - Ambien Slide.m4a
```

Current verification after these later cleanup batches:

```text
0 tracks still marked Needs review
19 approved tracks pending Apple Music handoff
54 approved tracks already marked imported in Apple Music
Next Sync tab step should be: Add 19 new/changed to Apple Music
```

Later on 2026-06-16, another rolling live-review pass cleaned, re-tagged, organized, and approved twenty-one additional tracks in four consecutive batches while new rows were still arriving:

```text
No Love | Shubh | No Love - Single | 2022 | track 1
One Love | Shubh | One Love - Single | 2023 | track 1
Yours | maye | Yours - Single | 2021 | track 1
Summertime in Paris (feat. Willow) | Jaden | ERYS | 2019 | track 11
Funkin Fun | Scotty Sire | What's Going On | 2019 | track 7
The Less I Know the Better | Tame Impala | Currents | 2015 | track 7
We Don't Talk Anymore (feat. Selena Gomez) | Charlie Puth | Nine Track Mind | 2016 | track 5
We Don't Talk Anymore (feat. Selena Gomez) [Mr. Collipark Remix] | Charlie Puth | We Don't Talk Anymore (feat. Selena Gomez) [Remixes] - EP | 2016 | track 1
Stitches | Shawn Mendes | Handwritten (Revisited) | 2015 | track 2
In the Name of Love | Martin Garrix & Bebe Rexha | In The Name Of Love - Single | 2016 | track 1
Drag Me Down | One Direction | Made In The A.M. (Deluxe Edition) | 2015 | track 2
Cold Water (feat. Justin Bieber & MØ) | Major Lazer | Cold Water (feat. Justin Bieber & MØ) - Single | 2016 | track 1
Hands to Myself | Selena Gomez | Revival | 2015 | track 3
Closer (feat. Halsey) | The Chainsmokers | Collage - EP | 2016 | track 3
Take You | Justin Bieber | Believe | 2012 | track 5
Beauty and a Beat (feat. Nicki Minaj) | Justin Bieber | Believe | 2012 | track 10
A Sky Full of Stars | Coldplay | Ghost Stories | 2014 | track 8
Animals | Maroon 5 | V | 2014 | track 2
All We Know (feat. Phoebe Ryan) | The Chainsmokers | Collage - EP | 2016 | track 2
Something Just Like This | The Chainsmokers & Coldplay | Memories...Do Not Open | 2017 | track 5
Paris | The Chainsmokers | Memories...Do Not Open | 2017 | track 8
```

Clean exported file paths for these four batches:

```text
/Users/veerr_89/Music/iListen Project/exports/Music Library/Shubh/No Love - Single/01 - No Love.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Shubh/One Love - Single/01 - One Love.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/maye/Yours - Single/01 - Yours.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Jaden/ERYS/11 - Summertime in Paris (feat. Willow).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Scotty Sire/What's Going On/07 - Funkin Fun.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Tame Impala/Currents/07 - The Less I Know the Better.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Charlie Puth/Nine Track Mind/05 - We Don't Talk Anymore (feat. Selena Gomez).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Charlie Puth/We Don't Talk Anymore (feat. Selena Gomez) [Remixes] - EP/01 - We Don't Talk Anymore (feat. Selena Gomez) [Mr. Collipark Remix].m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Shawn Mendes/Handwritten (Revisited)/02 - Stitches.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Martin Garrix & Bebe Rexha/In The Name Of Love - Single/01 - In the Name of Love.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/One Direction/Made In The A.M. (Deluxe Edition)/02 - Drag Me Down.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Major Lazer/Cold Water (feat. Justin Bieber & MØ) - Single/01 - Cold Water (feat. Justin Bieber & MØ).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Selena Gomez/Revival/03 - Hands to Myself.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Chainsmokers/Collage - EP/03 - Closer (feat. Halsey).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Justin Bieber/Believe/05 - Take You.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Justin Bieber/Believe/10 - Beauty and a Beat (feat. Nicki Minaj).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Coldplay/Ghost Stories/08 - A Sky Full of Stars.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/Maroon 5/V/02 - Animals.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Chainsmokers/Collage - EP/02 - All We Know (feat. Phoebe Ryan).m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Chainsmokers & Coldplay/Memories...Do Not Open/05 - Something Just Like This.m4a
/Users/veerr_89/Music/iListen Project/exports/Music Library/The Chainsmokers/Memories...Do Not Open/08 - Paris.m4a
```

Current verification after that rolling review cleanup:

```text
0 tracks still marked Needs review
40 approved tracks pending Apple Music handoff
54 approved tracks already marked imported in Apple Music
Next Sync tab step should be: Add 40 new/changed to Apple Music
```

Session note for this later 2026-06-16 rolling cleanup pass:

- Used `sqlite3` repeatedly because new `Needs review` rows were arriving while existing ones were being cleaned.
- Used iTunes Search for canonical album/track metadata and official artwork, plus MusicBrainz/Cover Art Archive for the `Currents` release-group art fallback.
- Used one-off `node` scripts that call `server/lib/organize.js` and `server/lib/db.js` helpers to move files, retag them, and mark jobs approved.
- Used `ffprobe` spot checks to confirm embedded tags after retagging.
- Did not rerun `npm test`, `npm run lint`, or `npm run build` because no repo code changed in this pass.

Later on 2026-06-16, another live-review pass cleaned, re-tagged, organized, and approved thirty additional tracks across several mini-batches while new rows continued arriving:

```text
What Makes You Beautiful | One Direction | Up All Night | 2011 | track 1
Story of My Life | One Direction | Midnight Memories | 2013 | track 2
Steal My Girl | One Direction | FOUR | 2014 | track 1
Best Song Ever | One Direction | Midnight Memories | 2013 | track 1
Night Changes | One Direction | FOUR | 2014 | track 7
Passionfruit | Drake | More Life | 2017 | track 3
I'll Show You | Justin Bieber | Purpose | 2015 | track 2
Love Yourself | Justin Bieber | Purpose | 2015 | track 5
What Do You Mean? | Justin Bieber | Purpose | 2015 | track 3
The Feeling (feat. Halsey) | Justin Bieber | Purpose | 2015 | track 9
Treat You Better | Shawn Mendes | Illuminate | 2016 | track 4
There's Nothing Holdin' Me Back | Shawn Mendes | Illuminate (Deluxe) | 2016 | track 1
2002 | Anne-Marie | Speak Your Mind (Deluxe) | 2018 | track 10
Scared to Be Lonely | Martin Garrix & Dua Lipa | Scared To Be Lonely - Single | 2017 | track 1
We Will Rock You | Queen | News of the World | 1977 | track 1
Summer of '69 | Bryan Adams | Reckless | 1984 | track 6
Numb | Linkin Park | Meteora | 2003 | track 13
Escape (The Pina Colada Song) | Rupert Holmes | Partners In Crime | 1979 | track 1
Escape | Enrique Iglesias | Escape | 2001 | track 1
Cheerleader (Felix Jaehn Remix) [Radio Edit] | Omi | Me 4 U | 2015 | track 1
All Rise | Blue | All Rise | 2001 | track 1
Right Now (Na Na Na) | Akon | Freedom | 2008 | track 1
Wavin' Flag | K'naan | Troubadour | 2009 | track 7
Titanium (feat. Sia) | David Guetta | Nothing But the Beat | 2011 | track 13
Middle (feat. Bipolar Sunshine) | DJ Snake | Encore | 2016 | track 2
Can't Stop the Feeling! | Justin Timberlake | TROLLS (Original Motion Picture Soundtrack) | 2016 | track 2
Hips Don't Lie (feat. Wyclef Jean) | Shakira | Oral Fixation, Vol. 2 | 2005 | track 3
Barbie Girl | Aqua | Aquarium | 1997 | track 3
Waiting for Tonight | Jennifer Lopez | On The 6 | 1999 | track 8
Stereo Love (Radio Edit) | Edward Maya & Vika Jigulina | Stereo Love - EP | 2009 | track 1
```

Current verification after this later cleanup pass:

```text
124 complete / 124 approved / 124 validated
0 tracks still marked Needs review
70 approved tracks pending Apple Music handoff
54 approved tracks already marked imported in Apple Music
SQLite backup created before this pass: /Users/veerr_89/Music/iListen Project/backups/ilisten-2026-06-16-needs-review-before-approval.sqlite
ffprobe tag spot checks passed for:
- The Feeling (feat. Halsey) | Justin Bieber | Purpose | 2015 | track 9
- Stereo Love (Radio Edit) | Edward Maya & Vika Jigulina | Stereo Love - EP | 2009 | track 1
```

Session note for this later 2026-06-16 live-review pass:

- Used `sqlite3` to keep checking the live queue because new `Needs review` rows were still arriving during cleanup.
- Used iTunes Search for canonical album metadata and clean artwork for all thirty approved tracks.
- Used one-off `node --input-type=module` scripts that call `server/lib/organize.js` and `server/lib/db.js` helpers to move files, re-tag them, and mark jobs approved.
- Used `ffprobe` spot checks on approved exports after retagging.
- Did not rerun `npm test`, `npm run lint`, or `npm run build` because no repo code changed in this pass.

Later on 2026-06-16, a Kanye / KIDS SEE GHOSTS cleanup pass normalized, re-tagged, organized, and approved fourteen additional tracks:

```text
Runaway (feat. Pusha T) | Kanye West | My Beautiful Dark Twisted Fantasy | 2010 | track 9
Jesus Walks | Kanye West | The College Dropout | 2004 | track 7
Devil In a New Dress (feat. Rick Ross) | Kanye West | My Beautiful Dark Twisted Fantasy | 2010 | track 8
All Falls Down (feat. Syleena Johnson) | Kanye West | The College Dropout | 2004 | track 4
Flashing Lights | Kanye West | Graduation | 2007 | track 9
Good Morning | Kanye West | Graduation | 2007 | track 1
Jesus Lord pt 2 | Kanye West | Donda | 2021 | track 27
Follow God | Kanye West | JESUS IS KING | 2019 | track 3
Gorgeous (feat. Kid Cudi & Raekwon) | Kanye West | My Beautiful Dark Twisted Fantasy | 2010 | track 2
Wolves | Kanye West | The Life of Pablo | 2016 | track 13
I Wonder | Kanye West | Graduation | 2007 | track 4
4th Dimension (feat. Louis Prima) | KIDS SEE GHOSTS | KIDS SEE GHOSTS | 2018 | track 3
Bound 2 | Kanye West | Yeezus | 2013 | track 10
Kids See Ghosts (feat. Yasiin Bey) | KIDS SEE GHOSTS | KIDS SEE GHOSTS | 2018 | track 6
```

Current verification after that Kanye / KIDS SEE GHOSTS cleanup pass:

```text
138 complete / 138 approved / 138 validated
0 tracks still marked Needs review
0 Kanye or KIDS SEE GHOSTS tracks still marked Needs review
14 approved tracks pending Apple Music handoff
124 approved tracks already marked imported in Apple Music
ffprobe tag spot checks passed for:
- Bound 2 | Kanye West | Yeezus | 2013 | track 10
- Kids See Ghosts (feat. Yasiin Bey) | KIDS SEE GHOSTS | KIDS SEE GHOSTS | 2018 | track 6
```

Session note for this later 2026-06-16 Kanye / KIDS SEE GHOSTS cleanup pass:

- Used `sqlite3` to identify the live Kanye review queue before and after cleanup.
- Used Apple iTunes Search/Lookup plus one MusicBrainz lookup to resolve canonical album metadata.
- Used one-off `node --input-type=module` scripts that call `server/lib/organize.js` and `server/lib/db.js` helpers to move files, re-tag them, and mark jobs approved.
- Used the stored artwork already attached to the `Bound 2` row when Apple search would not return the `Yeezus` track cleanly.
- Used `ffprobe` spot checks after retagging.
- Did not rerun `npm test`, `npm run lint`, or `npm run build` because no repo code changed in this pass.

Later on 2026-06-18, the Vite dev-server invalid React hook crash was fixed:

```text
Observed browser failure: "Invalid hook call" / "Cannot read properties of null (reading 'useState')" at useConverter.js, with Vite HMR WebSocket fallback noise.
Root cause was two concurrent Vite servers sharing port 5173 across address families: one served 127.0.0.1 with one optimized React cache hash, another served ::1/localhost with another. Browser requests could mix main/App/hook modules from both servers, creating two React module identities.
vite.config.js now binds dev and preview to host 127.0.0.1, port 5173, strictPort:true, HMR host 127.0.0.1, and resolve.dedupe ["react", "react-dom"].
Stopped the stale duplicate dev processes once they exited, then started one clean `npm run dev` server. Vite now advertises only http://127.0.0.1:5173/.
npm test -> 20 test files passed / 122 tests passed
npm run lint -> passed
npm run build -> passed (dist JS 260.96 kB / gzip 75.93 kB)
No live library, Apple Music, or iPod state was changed during this fix.
```

## Current User-Facing Next Step

There are now 14 newly approved tracks ready for Apple Music. Use the Sync tab button `Add 14 new/changed to Apple Music`, then sync `iPod Sync` in Finder to apply the expanded playlist to the physical iPod. Do not just unplug the iPod from the Apple Music playlist view. After Finder finishes syncing, eject the iPod.

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
