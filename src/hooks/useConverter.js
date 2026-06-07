import { useState, useRef, useCallback, useEffect } from "react";
import {
  DEFAULT_SETTINGS,
  IN_FLIGHT,
  makeTrack,
  applyOutputFields,
  outputFor,
  presetFor,
} from "../data/mockData.js";
import {
  addJobs,
  audioUrlForJob,
  cancelJob,
  connectEvents,
  coverArtUrlForJob,
  createPlaylist,
  helperBaseUrl,
  helperHealth,
  helperSetupCommand,
  openProject,
  pairHelper,
  removeJob,
  retryJob,
  startJob,
  updateJob,
} from "../utils/localHelper.js";

function ts() {
  const d = new Date();
  return `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}]`;
}

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "Pending";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "After conversion";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

function assetVersionForJob(job) {
  return job.updatedAt || job.createdAt || "";
}

export function mapJob(job, index = 0) {
  const output = outputFor(job.outputOption);
  const assetVersion = assetVersionForJob(job);
  const coverArt = job.coverPath ? coverArtUrlForJob(job.id, assetVersion) : null;
  const audioUrl = job.outputPath ? audioUrlForJob(job.id, assetVersion) : null;
  return {
    id: job.id,
    url: job.url,
    videoTitle: job.url,
    thumbColor: ["#3E6F9E", "#7AA874", "#C89B3C", "#8FB7D9", "#2C2C2E", "#B75D5D", "#5B8CBE"][index % 7],
    title: job.title,
    artist: job.artist,
    album: job.album,
    albumArtist: job.albumArtist,
    year: job.year,
    genre: job.genre,
    track: job.track,
    composer: job.composer,
    producer: "",
    comment: job.comment,
    thumbnailUrl: job.thumbnailUrl || "",
    playlists: job.playlists || [],
    playlistText: (job.playlists || []).join(", "),
    versionLabel: "",
    durationSec: job.durationSec,
    duration: fmtDuration(job.durationSec),
    preset: output.value === "best-youtube" ? "best" : output.value === "alac" ? "alac" : output.value === "mp3-v0" ? "mp3" : "apple",
    outputOption: output.value,
    format: output.format,
    ext: output.ext,
    encoder: output.encoder,
    qualityLabel: job.selectedOutput || output.shortLabel,
    compatibility: output.compatibility,
    size: fmtSize(job.sizeBytes),
    coverPath: job.coverPath,
    outputPath: job.outputPath,
    audioUrl,
    sourcePath: job.sourcePath,
    sourceCodec: job.sourceCodec,
    coverArt,
    assetVersion,
    progress: job.progress,
    status: job.status,
    warning: job.warning || null,
    error: job.error || null,
    updatedAt: job.updatedAt,
    createdAt: job.createdAt,
  };
}

export function mapJobs(jobs = []) {
  return jobs.map(mapJob);
}

export function useConverter() {
  const [tracks, setTracks] = useState([]);
  const [logs, setLogs] = useState([
    { t: ts(), kind: null, msg: "iListen ready. Start the local helper, then paste YouTube links." },
  ]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [globalCover, setGlobalCover] = useState(null);
  const [helper, setHelper] = useState({
    checked: false,
    connected: false,
    pairing: false,
    error: null,
    project: null,
    tools: null,
    helperUrl: helperBaseUrl,
    setupCommand: helperSetupCommand(),
  });

  const tracksRef = useRef(tracks);
  const settingsRef = useRef(settings);
  const helperRef = useRef(helper);
  tracksRef.current = tracks;
  settingsRef.current = settings;
  helperRef.current = helper;

  const pushLog = useCallback((msg, kind = null, label = null) => {
    if (!settingsRef.current.generateLogs) return;
    setLogs((prev) => [...prev, { t: ts(), kind, label, msg }]);
  }, []);

  const applyPayload = useCallback((payload) => {
    if (payload.jobs) setTracks(mapJobs(payload.jobs));
    if (payload.logs) setLogs(payload.logs.map((l) => ({ ...l, t: l.t.startsWith("[") ? l.t : `[${l.t}]` })));
    if (payload.project || payload.tools) {
      setHelper((prev) => ({
        ...prev,
        checked: true,
        connected: true,
        error: null,
        project: payload.project || prev.project,
        tools: payload.tools || prev.tools,
      }));
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let events = null;

    async function connect() {
      try {
        setHelper((prev) => ({ ...prev, pairing: true, error: null }));
        await helperHealth();
        const paired = await pairHelper();
        const projectState = await openProject();
        if (disposed) return;
        applyPayload(projectState);
        setHelper((prev) => ({
          ...prev,
          checked: true,
          connected: true,
          pairing: false,
          helperUrl: paired.helperUrl || helperBaseUrl,
        }));
        pushLog("Local helper connected.", "ok", "Helper:");
        events = connectEvents((payload) => {
          if (disposed) return;
          applyPayload(payload);
          if (payload.log) setLogs((prev) => [...prev, { ...payload.log, t: `[${payload.log.t}]` }]);
        }, () => {
          if (!disposed) {
            setHelper((prev) => ({ ...prev, connected: false, error: "Lost connection to the local helper." }));
          }
        });
      } catch (error) {
        if (disposed) return;
        setHelper((prev) => ({
          ...prev,
          checked: true,
          pairing: false,
          connected: false,
          error: error.message,
        }));
        pushLog(`Local helper not connected. Run ${helperSetupCommand()} and reload.`, "warn", "Helper:");
      }
    }

    connect();
    return () => {
      disposed = true;
      events?.close();
    };
  }, [applyPayload, pushLog]);

  const refreshFromResult = useCallback((result) => {
    applyPayload(result);
    return result;
  }, [applyPayload]);

  const start = useCallback(async () => {
    if (!helperRef.current.connected) {
      pushLog("Local helper is not connected. Conversion cannot start.", "warn", "Helper:");
      return false;
    }

    const queued = tracksRef.current.filter((track) => ["queued", "failed", "canceled"].includes(track.status));
    if (!queued.length) {
      pushLog("No queued YouTube links to convert.", null, "Queue:");
      return false;
    }

    pushLog(`Starting ${queued.length} conversion job${queued.length === 1 ? "" : "s"}.`, null, "Convert:");
    await Promise.all(queued.map((track) => startJob(track.id).then(refreshFromResult)));
    return true;
  }, [pushLog, refreshFromResult]);

  const pause = useCallback(async (id = null) => {
    const active = tracksRef.current.filter((track) => IN_FLIGHT.includes(track.status) && (!id || track.id === id));
    await Promise.all(active.map((track) => cancelJob(track.id).then(refreshFromResult)));
    pushLog(active.length ? `Canceled ${active.length} active job${active.length === 1 ? "" : "s"}.` : "No active conversion job is running.", null, "Cancel:");
  }, [pushLog, refreshFromResult]);

  const addFromLinks = useCallback(async (text) => {
    const urls = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (!urls.length) return 0;

    if (!helperRef.current.connected) {
      const fresh = urls.map((url, index) => applyOutputFields(makeTrack({
        url,
        videoTitle: url,
        title: `Offline YouTube link ${tracksRef.current.length + index + 1}`,
        index: tracksRef.current.length + index,
      }), settingsRef.current.defaultOutput));
      setTracks((prev) => [...prev, ...fresh]);
      pushLog("Queued locally, but conversion needs the local helper.", "warn", "Helper:");
      return fresh.length;
    }

    const result = await addJobs(text, settingsRef.current.defaultOutput);
    refreshFromResult(result);
    if (result.rejected?.length) {
      pushLog(`${result.rejected.length} non-YouTube link${result.rejected.length === 1 ? "" : "s"} rejected.`, "warn", "Queue:");
    }
    return result.created?.length || 0;
  }, [pushLog, refreshFromResult]);

  const updateTrack = useCallback(async (id, patch) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...patch } : track)));
    if (!helperRef.current.connected) return;
    let nextPatch = { ...patch };
    if (patch.preset && !patch.outputOption) {
      nextPatch.outputOption = presetFor(patch.preset).outputOption;
    }
    const result = await updateJob(id, nextPatch);
    refreshFromResult(result);
  }, [refreshFromResult]);

  const applyToAll = useCallback(async (patch) => {
    setTracks((prev) => prev.map((track) => {
      let merged = { ...track, ...patch };
      if (patch.preset && !patch.outputOption) {
        merged = { ...merged, outputOption: presetFor(patch.preset).outputOption };
      }
      return applyOutputFields(merged, merged.outputOption);
    }));
    if (!helperRef.current.connected) return;
    const nextPatch = { ...patch };
    if (patch.preset && !patch.outputOption) nextPatch.outputOption = presetFor(patch.preset).outputOption;
    await Promise.all(tracksRef.current.map((track) => updateJob(track.id, nextPatch).then(refreshFromResult)));
  }, [refreshFromResult]);

  const removeTrack = useCallback(async (id) => {
    setTracks((prev) => prev.filter((track) => track.id !== id));
    if (helperRef.current.connected) await removeJob(id).then(refreshFromResult);
  }, [refreshFromResult]);

  const retry = useCallback(async (id) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, status: "queued", progress: 0, error: null, warning: null } : track)));
    if (helperRef.current.connected) await retryJob(id).then(refreshFromResult);
    pushLog("Re-queued conversion job.", null, "Queue:");
  }, [pushLog, refreshFromResult]);

  const clearCompleted = useCallback(async () => {
    const done = tracksRef.current.filter((track) => ["complete", "skipped", "canceled"].includes(track.status));
    setTracks((prev) => prev.filter((track) => !["complete", "skipped", "canceled"].includes(track.status)));
    if (helperRef.current.connected) {
      await Promise.all(done.map((track) => removeJob(track.id).then(refreshFromResult)));
    }
  }, [refreshFromResult]);

  const resetAll = useCallback(() => {
    setTracks((prev) => prev.map((track) => ({ ...track, status: "queued", progress: 0, error: null, warning: null })));
    pushLog("Queue reset.", null, "Queue:");
  }, [pushLog]);

  const applyGlobalCover = useCallback((dataUrl) => {
    setGlobalCover(dataUrl);
    setTracks((prev) => prev.map((track) => ({ ...track, coverArt: dataUrl })));
    pushLog("Applied cover art in the UI. The local helper uses YouTube thumbnails for embedded artwork in v1.", "warn", "Artwork:");
  }, [pushLog]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const exportPlaylist = useCallback(async () => {
    if (!helperRef.current.connected) throw new Error("Local helper is not connected.");
    const result = await createPlaylist();
    refreshFromResult(result);
    return result.playlist;
  }, [refreshFromResult]);

  return {
    tracks,
    logs,
    settings,
    isProcessing: tracks.some((track) => IN_FLIGHT.includes(track.status)),
    globalCover,
    helper,
    actions: {
      start, pause, addFromLinks, updateTrack, applyToAll, removeTrack,
      retry, clearCompleted, resetAll, applyGlobalCover, updateSettings,
      setGlobalCover, pushLog, exportPlaylist,
    },
  };
}
