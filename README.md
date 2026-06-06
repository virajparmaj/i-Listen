# iListen — Converter (frontend)

A retro iPod Classic–inspired web app for converting your **own, rights-cleared** YouTube
releases into clean, iPod-ready audio files. Built with **Vite + React**. Frontend only —
conversion is **mocked** with simulated processing states. No real downloading happens.

> *Modern conversion. Classic playback.*

> **Folder name:** this project lives in `_ilisten-app/`. The leading underscore just keeps it
> out of the parent design-system's compiler — it has no effect on the app. Rename the folder to
> anything you like (e.g. `ilisten`) after downloading; Vite doesn't care.

## Run locally

```bash
npm install
npm run dev      # start the dev server (opens http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview the production build
```

> No-build peek: `preview.html` in this folder is a single-file, CDN-based render of the same
> app (open it directly in a browser). It's only for a quick look — do your real work via `npm run dev`.

## What's here

```
_ilisten-app/
  index.html              Vite entry (loads Google Fonts + /src/main.jsx)
  vite.config.js
  package.json
  src/
    main.jsx              React root
    App.jsx              Composition: screens, modals, wiring
    styles.css           @imports tokens + global
    styles/
      tokens.css         Design-system tokens (color, type, spacing, radius, shadow, gradients)
      global.css         Resets, scrollbars, slider, pinstripe desktop, animations
    data/
      mockData.js        Seed tracks, presets, options, status map, settings defaults
    hooks/
      useConverter.js    The mock processing engine (queue state machine + logs)
    utils/
      download.js        Real CSV / logs / library-manifest exports + filename patterns
    components/
      ui/                Design-system primitives (Button, Card, Input, Select, Checkbox,
                         Badge, ProgressBar, Switch, Slider, Modal, Icon)
      TopBar, NoticeBar, PastePanel, OutputControls, ExportBar,
      Queue, QueueRow, LogsPanel, IpodPreview, CoverArtUploader,
      MetadataEditor, SettingsModal, CoverArtModal, LibraryView
```

## Features (all interactive)

- **Convert screen** — hero, paste-links area, **required rights-confirmation gate** (Start is disabled until checked).
- **Quality presets** — iPod Balanced, Maximum MP3, Apple Native, Archive Mode. Output format + filename pattern. "Apply to all".
- **Batch queue** — per-track thumbnail, title/artist, progress bar, live status (Queued → Downloading → Extracting → Converting → Embedding metadata → Embedding artwork → Complete), plus **Failed** and **Skipped** states with warning/error messaging.
- **Mock processing engine** — respects the *Parallel jobs* setting; advances tracks through stages with simulated progress; one track fails, one is skipped (already converted), and appends real log lines.
- **Metadata editor** — full ID3 field set (Title, Artist, Album, Album Artist, Year, Genre, Track #, Composer, Producer, Comment, Version label) with per-track cover art.
- **Cover art uploader** — drag & drop, real **center-crop + resize** to square and **PNG→JPEG** re-encode via canvas; per-track or global.
- **Logs terminal** — graphite SF-Mono panel, auto-scrolls, color-coded.
- **iPod preview** — Now Playing LCD + click wheel.
- **Settings modal** — parallel jobs slider (1–8), default format, tag version, filename pattern, and toggles (skip converted, avoid overwrite, generate logs, resize artwork).
- **Library screen** — converted-track grid + folder-structure preview.
- **Exports** — CSV report, logs, and library manifest are **real downloads**. "Download all as ZIP" / per-track "Save" are mocked (toast), since there's no backend yet.

## Where to plug in a real backend

`src/hooks/useConverter.js` is the only place that simulates work. Replace the `setInterval`
tick with real job events (WebSocket / SSE / polling) and keep the same track shape, and the
whole UI keeps working. `src/utils/download.js` already produces real files from track data.

## Notes

- Fonts (`DM Serif Display`, `Limelight`, `Kaushan Script`, `Special Elite`, `VT323`) load from
  Google Fonts. Body/UI text uses the native Apple system stack. For offline use, self-host these.
- This is a UI prototype: **do not** use it to download content you don't own or have rights to.
