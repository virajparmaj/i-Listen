# iListen

A retro iPod Classic-inspired web app for converting rights-cleared YouTube links into iPod-ready audio files through a local helper.

The browser UI can be hosted, but conversion runs on your Mac through `http://127.0.0.1:4317` because `yt-dlp`, FFmpeg, files, logs, and exports need local machine access.

## What It Does

- Paste YouTube links and queue conversion jobs.
- Pair the hosted/local React UI with a localhost helper token.
- Create a visible project folder with `staging/`, `exports/`, `artwork/`, `logs/`, and `ilisten.sqlite`.
- Detect `yt-dlp`, `ffmpeg`, and `ffprobe`.
- Download the best available YouTube audio with `yt-dlp`.
- Copy iPod-compatible AAC when possible; otherwise convert to ALAC `.m4a` by default to avoid another lossy encode.
- Keep Bass Safe AAC, MP3 V0, and AAC 256 as alternate output options.
- Embed metadata and YouTube thumbnail artwork with FFmpeg.
- Validate converted files with `ffprobe`.
- Keep converted tracks in metadata review until title, artist, album, artwork, and playlist assignments are approved.
- Move approved tracks into a clean `Music Library/{Artist}/{Album}/{Track # - Title}.m4a` structure and retag files before handoff.
- Add approved tracks to Apple Music's `iPod Sync` playlist for Finder/iPod sync.

Quality note: YouTube-only sources are already compressed. iListen preserves the best available source path it can, but it cannot restore original studio/master quality. If bass-heavy tracks crackle only on the iPod, try the Bass Safe preset; it transcodes to AAC 256 with extra headroom and a limiter so old iPod playback chains are less likely to clip.

## Run Locally

Install system tools:

```bash
brew install ffmpeg yt-dlp ollama
```

Optional fingerprint lookup for the AI metadata fixer:

```bash
brew install chromaprint
```

Prepare the local AI model:

```bash
ollama pull qwen:1.8b
ollama list
```

Install app dependencies:

```bash
npm install
```

Start the local helper:

```bash
npm run helper
```

Start the web UI in another terminal:

```bash
npm run dev
```

Open the app:

```text
http://127.0.0.1:5173/
```

By default the helper opens a project at:

```text
~/Music/iListen Project
```

Converted files land in:

```text
~/Music/iListen Project/exports/Music Library/
```

Each track keeps metadata review, approval, file path, and Apple Music handoff status in SQLite. YouTube metadata is only a first pass; final user-facing names should look like normal music-library entries. iListen uses one required Apple Music sync playlist named `iPod Sync` and does not auto-create `iPod - ...` playlists.

## Local AI Metadata Approval

iListen can run a local Ollama model over completed, unapproved tracks and approve them automatically through the normal organize/retag path.

Default AI settings:

```bash
ILISTEN_OLLAMA_URL=http://127.0.0.1:11434
ILISTEN_METADATA_MODEL=qwen:1.8b
ILISTEN_METADATA_TIMEOUT_MS=45000
```

`qwen:1.8b` is the default because it is small enough for an 8 GB M1 MacBook Pro and fast enough to process multiple songs without tying up the helper for minutes. If you want to experiment, other open model options to pull and set explicitly are `gemma3:1b`, `gemma3:4b`, or `qwen:4b`.

Optional AcoustID fingerprint lookup:

```bash
ILISTEN_ACOUSTID_CLIENT_KEY=your-acoustid-key
```

Typical local launch:

```bash
cd /Users/veerr_89/Work/tools/i-Listen
ILISTEN_METADATA_MODEL=qwen:1.8b npm run helper
```

In another terminal:

```bash
npm run dev
```

Then open `http://127.0.0.1:5173/`, go to `Sync`, and click `AI approve X unreviewed`. The app processes one completed/unapproved row at a time, shows a row-specific loading animation, moves/renames the file, retags it, and turns the row green only after approval succeeds.

The local model is a metadata chooser/normalizer, not the source of truth. iListen first checks compact evidence from current metadata, embedded tags, YouTube title/uploader/duration/date, top MusicBrainz candidates, Apple/iTunes Search candidates, optional AcoustID candidates, and relevant manual correction examples. When MusicBrainz, Apple/iTunes, or AcoustID evidence is strong enough, iListen can approve from that evidence without calling Ollama; ambiguous rows fall back to `qwen:1.8b`. Low-confidence proposals, unknown albums, and titles that do not match the supplied evidence stay in review instead of being auto-approved. The model should choose from supplied evidence when possible, preserve cleaned current metadata when evidence is weak, and avoid invented albums, years, track numbers, or playlists.

Future fine-tuning/evaluation data can be exported from stored manual edits and AI approvals:

```bash
npm run export:metadata-examples
```

The default export path is `~/Music/iListen Project/metadata-examples.jsonl`. Use `--project /path/to/project --output /path/to/examples.jsonl` after the npm script delimiter when needed:

```bash
npm run export:metadata-examples -- --output /tmp/metadata-examples.jsonl
```

Troubleshooting checks:

```bash
curl http://127.0.0.1:11434/api/tags
curl http://127.0.0.1:4317/health
which ffmpeg
which ffprobe
which yt-dlp
which ollama
ollama list
```

If a row or `/health` reports `Local metadata model qwen:1.8b is not installed`, run `ollama pull qwen:1.8b` and retry the AI approval. If you launched the helper with a different `ILISTEN_METADATA_MODEL`, pull that exact model or restart the helper with `ILISTEN_METADATA_MODEL=qwen:1.8b npm run helper`.

## Required Converter Tools

The helper detects tools from your `PATH` or these environment variables:

```bash
ILISTEN_YTDLP=/path/to/yt-dlp
ILISTEN_FFMPEG=/path/to/ffmpeg
ILISTEN_FFPROBE=/path/to/ffprobe
```

On macOS, one common setup is:

```bash
brew install ffmpeg yt-dlp
```

If a hosted frontend will connect to your helper, set the allowed origin before starting it:

```bash
ILISTEN_ALLOWED_ORIGINS=https://your-hosted-app.example npm run helper
```

Local Vite origins such as `http://localhost:5173` are allowed automatically.

## API Surface

- `GET /health` - helper status, tools, AI metadata readiness, project, jobs, logs.
- `POST /pair` - returns the browser pairing token.
- `POST /projects/open` - creates/opens the project folder.
- `POST /jobs` - adds YouTube URLs.
- `GET /jobs` - returns persisted queue state.
- `PATCH /jobs/:id` - updates metadata/output fields.
- `POST /jobs/:id/start` - starts conversion.
- `POST /jobs/:id/cancel` - cancels an active job.
- `POST /jobs/:id/retry` - requeues a failed/canceled job.
- `POST /jobs/:id/remove` - removes a job.
- `POST /jobs/:id/ai-approve` - proposes clean local-AI metadata, organizes, retags, and approves a completed track.
- `POST /jobs/organize` - applies approved metadata, moves/renames files, retags audio, and marks tracks approved.
- `GET /events` - streams logs and queue updates over SSE.
- `POST /applemusic/handoff` - adds approved tracks to Apple Music's `iPod Sync` playlist.
- `POST /applemusic/cleanup` - removes stale iListen-created playlists from older workflows.

## Verify

```bash
npm run test
npm run lint
npm run build
```
