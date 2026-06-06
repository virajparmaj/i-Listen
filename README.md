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
- Write `.m3u` playlist/export handoffs for Apple Music/Finder sync.
- Guess clean metadata from common `Artist - Title` YouTube titles, then let you edit title, artist, album, genre, year, and playlist names before exporting.

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

Converted files and playlists land in:

```text
~/Music/iListen Project/exports/Music Library/
~/Music/iListen Project/exports/Playlists/
```

Each track keeps playlist names in SQLite. New jobs start with `iPod - YouTube Converts`; after YouTube analysis, iListen also adds an artist playlist such as `iPod - Cigarettes After Sex` when it can infer the artist.

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
- `GET /events` - streams logs and queue updates over SSE.
- `POST /exports/playlist` - writes an iPod import playlist.

## Verify

```bash
npm run test
npm run lint
npm run build
```
