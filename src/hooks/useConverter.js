import { useState, useRef, useEffect, useCallback } from "react";
import {
  SEED_TRACKS, DEFAULT_SETTINGS, PRESETS, STATUS, TERMINAL, IN_FLIGHT,
  makeTrack, estimateSize,
} from "../data/mockData.js";

function ts() {
  const d = new Date();
  return `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}]`;
}

function stageFor(p) {
  if (p <= 0) return "queued";
  if (p < 12) return "downloading";
  if (p < 30) return "extracting";
  if (p < 82) return "converting";
  if (p < 92) return "metadata";
  if (p < 100) return "artwork";
  return "complete";
}

// Naive "parse" of a YouTube-style title into artist / song.
function parseTitle(raw) {
  let t = raw.replace(/\((official|lyric|audio|visualizer|video|demo)[^)]*\)/gi, "")
             .replace(/\[[^\]]*\]/g, "").trim();
  const parts = t.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts[1].trim() };
  return { artist: "Unknown Artist", title: t || "Untitled" };
}

export function useConverter() {
  const [tracks, setTracks] = useState(SEED_TRACKS);
  const [logs, setLogs] = useState([
    { t: ts(), kind: null, msg: "iListen ready · paste rights-cleared links to begin." },
  ]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalCover, setGlobalCover] = useState(null);

  const tracksRef = useRef(tracks);
  const settingsRef = useRef(settings);
  const processingRef = useRef(isProcessing);
  tracksRef.current = tracks;
  settingsRef.current = settings;
  processingRef.current = isProcessing;

  const pushLog = useCallback((msg, kind = null, label = null) => {
    if (!settingsRef.current.generateLogs) return;
    setLogs((prev) => [...prev, { t: ts(), kind, label, msg }]);
  }, []);

  const presetKbps = (preset, format) => {
    const p = PRESETS.find((x) => x.id === preset);
    let kbps = p ? p.kbps : 245;
    if (format === "aac" && preset !== "archive") kbps = 256;
    return kbps;
  };

  // ---- the simulation tick ----
  useEffect(() => {
    const iv = setInterval(() => {
      if (!processingRef.current) return;
      const cur = tracksRef.current;
      const pending = [];

      let inFlight = cur.filter((t) => IN_FLIGHT.includes(t.status)).length;
      const limit = settingsRef.current.parallelJobs;

      const next = cur.map((t) => {
        if (TERMINAL.includes(t.status)) return t;

        // promote queued -> downloading if there's a free slot
        if (t.status === "queued") {
          if (inFlight < limit) {
            inFlight++;
            pending.push(() => pushLog(`Downloading source — ${t.title}`));
            return { ...t, status: "downloading", progress: 2 };
          }
          return t;
        }

        // skip fate: bail immediately on first touch
        if (t._fate === "skip") {
          pending.push(() => pushLog(`Skipped (already converted) — ${t.title}`, "warn", "Skipped:"));
          return { ...t, status: "skipped", progress: 0 };
        }

        const inc = 4 + Math.random() * 8;
        let progress = Math.min(100, t.progress + inc);

        // fail fate: fail partway through converting
        if (t._fate === "fail" && progress >= 58) {
          pending.push(() => pushLog(`Source unavailable / blocked — ${t.title}`, "err", "Failed:"));
          return { ...t, status: "failed", progress: t.progress, error: "Source unavailable in your region." };
        }

        const prevStage = t.status;
        const stage = stageFor(progress);
        let warning = t.warning;

        if (stage !== prevStage) {
          if (stage === "extracting") pending.push(() => pushLog(`Extracting audio — ${t.title}`));
          if (stage === "converting") pending.push(() => pushLog(`Converting → ${t.format.toUpperCase()} — ${t.title}`));
          if (stage === "metadata") pending.push(() => pushLog(`Embedding metadata (${settingsRef.current.tagVersion.toUpperCase().replace("ID3V", "ID3v")}) — ${t.title}`));
          if (stage === "artwork") pending.push(() => pushLog(`Embedding artwork — ${t.title}`));
          if (stage === "converting" && t._fate === "warn" && !t.warning) {
            warning = "YouTube source is already lossy.";
            pending.push(() => pushLog(`YouTube source is already lossy — ${t.title}`, "warn", "Warning:"));
          }
          if (stage === "complete") {
            const fname = t.title;
            pending.push(() => pushLog(`${fname}.${t.format === "aac" ? "m4a" : "mp3"}`, "ok", "Complete:"));
          }
        }

        return { ...t, progress, status: stage, warning };
      });

      setTracks(next);
      pending.forEach((fn) => fn());

      // stop when nothing left to process
      const stillGoing = next.some((t) => !TERMINAL.includes(t.status));
      if (!stillGoing) {
        processingRef.current = false;
        setIsProcessing(false);
        pushLog("All jobs finished.", "ok", "Done:");
      }
    }, 420);
    return () => clearInterval(iv);
  }, [pushLog]);

  // ---- actions ----
  const start = useCallback(() => {
    const hasWork = tracksRef.current.some((t) => !TERMINAL.includes(t.status));
    if (!hasWork) return;
    const n = tracksRef.current.filter((t) => t.status === "queued").length;
    pushLog(`Starting ${Math.min(settingsRef.current.parallelJobs, n || 1)} parallel jobs · preset varies by track`, null);
    setIsProcessing(true);
  }, [pushLog]);

  const pause = useCallback(() => {
    setIsProcessing(false);
    pushLog("Paused.", null);
  }, [pushLog]);

  const addFromLinks = useCallback((text) => {
    const urls = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (!urls.length) return 0;
    const existing = new Set(tracksRef.current.map((t) => t.url));
    const fresh = [];
    urls.forEach((url, i) => {
      if (settingsRef.current.skipConverted && existing.has(url)) return;
      const guess = parseTitle(url.includes("watch") ? `Imported Track ${tracksRef.current.length + i + 1}` : url);
      fresh.push(makeTrack({
        url,
        videoTitle: url,
        artist: guess.artist,
        title: guess.title,
        album: "Imported",
        year: new Date().getFullYear(),
        durationSec: 150 + Math.floor(Math.random() * 140),
        fate: "ok",
        index: tracksRef.current.length + i,
      }));
    });
    if (fresh.length) {
      setTracks((prev) => [...prev, ...fresh]);
      pushLog(`Added ${fresh.length} track${fresh.length > 1 ? "s" : ""} to the queue.`);
    }
    return fresh.length;
  }, [pushLog]);

  const updateTrack = useCallback((id, patch) => {
    setTracks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const merged = { ...t, ...patch };
      if (patch.format || patch.preset) {
        merged.size = estimateSize(merged.durationSec, presetKbps(merged.preset, merged.format));
      }
      return merged;
    }));
  }, []);

  const applyToAll = useCallback((patch) => {
    setTracks((prev) => prev.map((t) => {
      const merged = { ...t, ...patch };
      merged.size = estimateSize(merged.durationSec, presetKbps(merged.preset, merged.format));
      return merged;
    }));
  }, []);

  const removeTrack = useCallback((id) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const retry = useCallback((id) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "queued", progress: 0, error: null, _fate: "ok" } : t)));
    pushLog("Re-queued failed track.");
  }, [pushLog]);

  const clearCompleted = useCallback(() => {
    setTracks((prev) => prev.filter((t) => !["complete", "skipped"].includes(t.status)));
  }, []);

  const resetAll = useCallback(() => {
    setIsProcessing(false);
    setTracks((prev) => prev.map((t) => ({ ...t, status: "queued", progress: 0, error: null, warning: null })));
    pushLog("Queue reset.");
  }, [pushLog]);

  const applyGlobalCover = useCallback((dataUrl) => {
    setGlobalCover(dataUrl);
    setTracks((prev) => prev.map((t) => ({ ...t, coverArt: dataUrl })));
    pushLog("Applied cover art to all tracks.");
  }, [pushLog]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    tracks, logs, settings, isProcessing, globalCover,
    actions: {
      start, pause, addFromLinks, updateTrack, applyToAll, removeTrack,
      retry, clearCompleted, resetAll, applyGlobalCover, updateSettings,
      setGlobalCover, pushLog,
    },
  };
}
