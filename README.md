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
- Keep MP3 V0 and AAC 256 as advanced output options.
- Embed metadata and YouTube thumbnail artwork with FFmpeg.
- Validate converted files with `ffprobe`.
- Keep converted tracks in metadata review until title, artist, album, artwork, and playlist assignments are approved.
- Move approved tracks into a clean `Music Library/{Artist}/{Album}/{Track # - Title}.m4a` structure and retag files before handoff.
- Add approved tracks to Apple Music's `iPod Sync` playlist for Finder/iPod sync.

Quality note: YouTube-only sources are already compressed. iListen preserves the best available source path it can, but it cannot restore original studio/master quality.

## Run Locally

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

By default the helper opens a project at:

```text
~/Music/iListen Project
```

Converted files land in:

```text
~/Music/iListen Project/exports/Music Library/
```

Each track keeps metadata review, approval, file path, and Apple Music handoff status in SQLite. YouTube metadata is only a first pass; final user-facing names should look like normal music-library entries. iListen uses one required Apple Music sync playlist named `iPod Sync` and does not auto-create `iPod - ...` playlists.

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

- `GET /health` - helper status, tools, project, jobs, logs.
- `POST /pair` - returns the browser pairing token.
- `POST /projects/open` - creates/opens the project folder.
- `POST /jobs` - adds YouTube URLs.
- `GET /jobs` - returns persisted queue state.
- `PATCH /jobs/:id` - updates metadata/output fields.
- `POST /jobs/:id/start` - starts conversion.
- `POST /jobs/:id/cancel` - cancels an active job.
- `POST /jobs/:id/retry` - requeues a failed/canceled job.
- `POST /jobs/:id/remove` - removes a job.
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
