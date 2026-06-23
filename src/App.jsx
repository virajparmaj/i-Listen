import React from "react";
import { useConverter } from "./hooks/useConverter.js";
import { outputFor, presetFor } from "./data/mockData.js";
import { TopBar } from "./components/TopBar.jsx";
import { PastePanel } from "./components/PastePanel.jsx";
import { OutputControls } from "./components/OutputControls.jsx";
import { Queue } from "./components/Queue.jsx";
import { LogsPanel } from "./components/LogsPanel.jsx";
import { IpodPreview } from "./components/IpodPreview.jsx";
import { ExportBar } from "./components/ExportBar.jsx";
import { LibraryView } from "./components/LibraryView.jsx";
import { SyncView } from "./components/SyncView.jsx";
import { XmlImportView } from "./components/xml/XmlImportView.jsx";
import { MetadataEditor } from "./components/MetadataEditor.jsx";
import { CoverArtModal } from "./components/CoverArtModal.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { LocalHelperPanel } from "./components/LocalHelperPanel.jsx";
import { ReconvertModal } from "./components/ReconvertModal.jsx";
import { AudioIssuesModal } from "./components/AudioIssuesModal.jsx";
import { Modal } from "./components/ui/Modal.jsx";
import { ProgressBar } from "./components/ui/ProgressBar.jsx";
import { exportBackendManifest, exportCSV, exportLibraryManifest, filenameFor } from "./utils/download.js";
import { defaultAudioRepairPreset } from "./utils/audioRepair.js";

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="il-fade-in" style={{
      position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 200,
      background: "var(--grad-graphite)", color: "var(--text-on-dark)", padding: "10px 18px",
      borderRadius: "var(--radius-pill)", border: "1px solid var(--border-graphite)",
      boxShadow: "var(--shadow-float), var(--gloss-top-dark)", fontSize: "var(--text-sm)",
    }}>
      {msg}
    </div>
  );
}

function reconvertStats(progress, tracks) {
  if (!progress) return null;
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const items = progress.ids.map((id) => ({ id, track: byId.get(id) })).filter((item) => item.track);
  const total = progress.ids.length;
  const isActive = (track) => track.status === "converting" || track.conversionStatus === "converting";
  const isQueued = (track) => track.conversionStatus === "reconvert_queued";
  const changed = (id, track) => (track.updatedAt || "") !== (progress.baseline?.[id] || "");
  const done = items.filter(({ id, track }) => changed(id, track) && !isActive(track) && !isQueued(track)).length;
  const failed = items.filter(({ id, track }) => changed(id, track) && track.conversionStatus === "failed").length;
  const active = items.find(({ track }) => isActive(track))?.track || null;
  const queued = items.filter(({ track }) => isQueued(track)).length;
  return { total, done, failed, active, queued, pct: total ? (done / total) * 100 : 0, complete: total > 0 && done >= total };
}

function ReconvertProgressPopup({ progress, tracks }) {
  const stats = reconvertStats(progress, tracks);
  if (!progress || !stats) return null;
  const activeLabel = stats.active
    ? `${stats.active.artist} — ${stats.active.title}`
    : stats.complete
      ? "Ready for Apple Music handoff"
      : stats.queued
        ? `${stats.queued} waiting`
        : "Starting...";

  return (
    <div className="il-fade-in" style={{
      position: "fixed",
      top: "calc(var(--topbar-h) + 12px)",
      right: 18,
      zIndex: 220,
      width: 340,
      maxWidth: "calc(100vw - 36px)",
      padding: 14,
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border-strong)",
      background: "linear-gradient(180deg, #F8F8F5 0%, #E7E7E1 100%)",
      boxShadow: "var(--shadow-float), var(--gloss-top)",
      color: "var(--text-primary)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: stats.complete ? "var(--status-success)" : "var(--accent-primary)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(0,0,0,0.18)",
          flex: "none",
        }} />
        <strong style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)" }}>
          {stats.complete ? "Rebuild complete" : "Rebuilding files"}
        </strong>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-lcd)", fontSize: 18, color: "var(--text-lcd)", lineHeight: 1 }}>
          {stats.done}/{stats.total}
        </span>
      </div>
      <ProgressBar value={stats.pct} height={9} showLabel={false} label="Rebuild progress" />
      <div style={{
        marginTop: 8,
        fontFamily: "var(--font-typewriter)",
        fontSize: "var(--text-xs)",
        color: "var(--text-secondary)",
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {activeLabel}
      </div>
      {stats.failed > 0 && (
        <div style={{ marginTop: 5, fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--status-error)" }}>
          {stats.failed} failed. Check Logs.
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { tracks, logs, settings, globalCover, helper, ipod, actions } = useConverter();
  const [tab, setTab] = React.useState("Convert");
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());

  const [editTrack, setEditTrack] = React.useState(null);
  const [artTarget, setArtTarget] = React.useState(null); // 'all' | trackId | null
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [reconvertRequest, setReconvertRequest] = React.useState(null);
  const [reconvertBusy, setReconvertBusy] = React.useState(false);
  const [reconvertProgress, setReconvertProgress] = React.useState(null);
  const [audioIssueTarget, setAudioIssueTarget] = React.useState(null);
  const [audioIssueBusy, setAudioIssueBusy] = React.useState(false);
  const [audioIssueFilter, setAudioIssueFilter] = React.useState({});
  const [toast, setToast] = React.useState("");

  const toastRef = React.useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 2600);
  };

  const completed = tracks.filter((t) => t.status === "complete");
  const selectedCompleted = completed.filter((t) => selectedIds.has(t.id));
  const nowPlaying = completed[completed.length - 1] || null;
  const pattern = settings.filenamePattern;
  const outputOption = settings.defaultOutput;
  const preset = outputOption === "best-youtube"
    ? "best"
    : outputOption === "ipod-safe-aac"
      ? "ipodSafe"
      : outputOption === "mp3-v0"
        ? "mp3"
        : null;
  const exportOptions = { avoidOverwrite: settings.avoidOverwrite };

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const existing = new Set(tracks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => existing.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tracks]);

  const setPresetAndOutput = (id) => {
    const nextPreset = presetFor(id);
    actions.updateSettings({ defaultOutput: nextPreset.outputOption });
  };

  const handleRemoveTrack = async (track) => {
    const alreadyAdded = track.appleMusicPlaylistStatus === "added";
    const message = [
      `Delete "${track.title}" by ${track.artist}?`,
      track.status === "complete"
        ? "This removes the converted file from your iListen project."
        : "This removes the queued conversion from your iListen project.",
      alreadyAdded
        ? `It may still exist in Apple Music under "${track.playlists?.[0] || "iPod Sync"}" and would need manual cleanup there.`
        : "",
    ].filter(Boolean).join("\n\n");
    if (!window.confirm(message)) return false;

    await actions.removeTrack(track.id);
    showToast(`Deleted ${track.artist} — ${track.title}.`);
    return true;
  };

  const openReconvert = (target, defaultOutputOption = "ipod-safe-aac") => {
    const list = (Array.isArray(target) ? target : [target]).filter(Boolean);
    if (!list.length) {
      showToast("Select one or more completed tracks to reconvert.");
      return;
    }
    setReconvertRequest({ tracks: list, defaultOutputOption });
  };

  const currentReconvertStats = reconvertStats(reconvertProgress, tracks);

  React.useEffect(() => {
    if (!currentReconvertStats?.complete) return undefined;
    const timer = setTimeout(() => setReconvertProgress(null), 3200);
    return () => clearTimeout(timer);
  }, [currentReconvertStats?.complete]);

  const confirmReconvert = (nextOutputOption) => {
    const request = reconvertRequest;
    const targets = request?.tracks || [];
    if (!targets.length) return;
    const ids = targets.map((track) => track.id);
    const baseline = Object.fromEntries(targets.map((track) => [track.id, track.updatedAt || ""]));

    setReconvertBusy(true);
    setReconvertProgress({ ids, baseline, outputOption: nextOutputOption, startedAt: Date.now() });
    setReconvertRequest(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    showToast(`Rebuild started for ${ids.length} track${ids.length === 1 ? "" : "s"}.`);

    const requestPromise = ids.length === 1
      ? actions.reconvertTrack(ids[0], { outputOption: nextOutputOption, replaceExisting: true })
      : actions.reconvertTracks(ids, { outputOption: nextOutputOption, replaceExisting: true });

    requestPromise.then((result) => {
      const results = result.results || (result.result ? [result.result] : []);
      const accepted = results.filter((item) => item.accepted || item.ok).length;
      const failed = results.filter((item) => !item.accepted && !item.ok);
      if (!accepted) {
        setReconvertProgress(null);
        showToast(failed[0]?.error || "Reconvert failed.");
      }
    }).catch((error) => {
      setReconvertProgress(null);
      showToast(error.message);
    }).finally(() => {
      setReconvertBusy(false);
    });
  };

  const saveAudioIssues = async (track, payload = {}) => {
    if (!helper.connected) {
      showToast("Connect the local helper first.");
      return null;
    }
    setAudioIssueBusy(true);
    try {
      const result = await actions.updateTrackAudioIssues(track, {
        audioIssueTags: payload.audioIssueTags || [],
        audioRepairNotes: payload.audioRepairNotes || track.audioRepairNotes || "",
      });
      showToast("Audio flags saved.");
      return result;
    } catch (error) {
      showToast(error.message);
      return null;
    } finally {
      setAudioIssueBusy(false);
    }
  };

  const clearAudioIssues = async (track) => {
    if (!helper.connected) {
      showToast("Connect the local helper first.");
      return;
    }
    setAudioIssueBusy(true);
    try {
      await actions.updateTrackAudioIssues(track, { cleared: true, audioIssueTags: [] });
      setAudioIssueTarget(null);
      showToast("Audio issue cleared.");
    } catch (error) {
      showToast(error.message);
    } finally {
      setAudioIssueBusy(false);
    }
  };

  const analyzeAudioTracks = async (target, payload = null) => {
    if (!helper.connected) {
      showToast("Connect the local helper first.");
      return;
    }
    const list = (Array.isArray(target) ? target : [target]).filter(Boolean);
    if (!list.length) {
      showToast("Select one or more tracks to analyze.");
      return;
    }
    setAudioIssueBusy(true);
    try {
      if (payload && list.length === 1) {
        await actions.updateTrackAudioIssues(list[0], { audioIssueTags: payload.audioIssueTags || [] });
      }
      const ids = list.map((track) => track.id);
      const result = ids.length === 1
        ? await actions.repairAudioTrack(ids[0], { analyzeOnly: true })
        : await actions.repairAudioTracks(ids, { analyzeOnly: true });
      const results = result.results || (result.result ? [result.result] : []);
      const ok = results.filter((item) => item.ok).length || (result.result?.ok ? 1 : 0);
      showToast(ok ? `Analyzed ${ok} track${ok === 1 ? "" : "s"}.` : "Audio analysis failed.");
    } catch (error) {
      showToast(error.message);
    } finally {
      setAudioIssueBusy(false);
    }
  };

  const repairAudioTracks = async (target, presetOrPayload = null) => {
    if (!helper.connected) {
      showToast("Connect the local helper first.");
      return;
    }
    const list = (Array.isArray(target) ? target : [target]).filter(Boolean);
    if (!list.length) {
      showToast("Select one or more tracks to repair.");
      return;
    }
    const payload = presetOrPayload && typeof presetOrPayload === "object" ? presetOrPayload : null;
    const preset = typeof presetOrPayload === "string"
      ? presetOrPayload
      : payload?.preset || defaultAudioRepairPreset(list[0]);
    const ids = list.map((track) => track.id);
    const baseline = Object.fromEntries(list.map((track) => [track.id, track.updatedAt || ""]));

    setAudioIssueBusy(true);
    setReconvertProgress({ ids, baseline, outputOption: preset, startedAt: Date.now() });
    setAudioIssueTarget(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    try {
      if (payload && list.length === 1) {
        await actions.updateTrackAudioIssues(list[0], { audioIssueTags: payload.audioIssueTags || [] });
      }
      const result = ids.length === 1
        ? await actions.repairAudioTrack(ids[0], { preset, replaceExisting: true })
        : await actions.repairAudioTracks(ids, { preset, replaceExisting: true });
      const results = result.results || (result.result ? [result.result] : []);
      const accepted = results.filter((item) => item.accepted || item.ok).length;
      if (!accepted) {
        setReconvertProgress(null);
        showToast(results.find((item) => item.error)?.error || "Audio repair failed.");
      } else {
        showToast(`Audio repair started for ${accepted} track${accepted === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      setReconvertProgress(null);
      showToast(error.message);
    } finally {
      setAudioIssueBusy(false);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSelectedTracks = (ids = []) => {
    setSelectedIds(new Set(ids));
  };

  // ---- export handlers ----
  const onZip = async () => {
    if (helper.connected) {
      try {
        const playlist = await actions.exportPlaylist();
        showToast(`Wrote ${playlist.playlists?.length || 0} playlist(s) in ${playlist.all?.path || "exports/Playlists"}`);
        return;
      } catch (error) {
        showToast(error.message);
      }
    }
    exportBackendManifest(tracks, pattern, exportOptions);
    actions.pushLog("Exported conversion plan. Start the local helper for real file output.", null, "Export:");
    showToast("Downloaded conversion plan. Real file export needs the local helper.");
  };
  const onLibrary = () => { exportLibraryManifest(completed, pattern, exportOptions); showToast("Downloaded organized-library report for converted tracks."); };
  const onSelected = () => {
    exportBackendManifest(tracks, pattern, exportOptions);
    showToast("Conversion plan downloaded.");
  };
  const onCSV = () => { exportCSV(tracks); actions.pushLog("Exported CSV report.", null, "Export:"); showToast("CSV report downloaded."); };
  const onDownloadOne = (t) => showToast(t.outputPath ? `"${t.title}" is ready at ${t.outputPath}` : `"${filenameFor(t, pattern)}" is a planned filename until conversion completes.`);

  const applyArt = (art) => {
    if (artTarget === "all") actions.applyGlobalCover(art);
    else if (artTarget) actions.updateTrack(artTarget, { coverArt: art });
    setArtTarget(null);
  };

  const helperState = helper.connected ? (helper.tools?.ready ? "helper ready" : "helper needs tools") : "local helper not connected";
  const jobInfo = `${tracks.length} queued · ${helperState} · ${outputFor(outputOption).shortLabel}`;

  return (
    <div className="il-desktop">
      <TopBar
        tab={tab}
        setTab={setTab}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenLogs={() => setLogsOpen(true)}
        logCount={logs.length}
        jobInfo={jobInfo}
      />
      <LocalHelperPanel helper={helper} />

      <main className="il-app-main il-scroll">
        {tab === "Convert" && (
          <div className="il-convert-grid">
            <div className="il-convert-main">
              <PastePanel
                onAdd={async (text) => {
                  try {
                    const n = await actions.addFromLinks(text);
                    if (n) showToast(`Added ${n} YouTube link${n === 1 ? "" : "s"}.`);
                    else showToast("No new YouTube links to add.");
                    return n;
                  } catch (error) {
                    showToast(error.message);
                    return 0;
                  }
                }}
                onConvert={async () => {
                  try {
                    const started = await actions.start();
                    showToast(started ? "Conversion started in the local helper." : "Nothing ready to convert.");
                  } catch (error) {
                    showToast(error.message);
                  }
                }}
                queueCount={tracks.filter((t) => ["queued", "failed", "canceled"].includes(t.status)).length}
                helper={helper}
                outputControls={(
                  <OutputControls
                    compact
                    preset={preset}
                    setPreset={setPresetAndOutput}
                  />
                )}
              />
              <div id="queue" className="il-queue-section">
                <Queue
                  tracks={tracks}
                  onEdit={setEditTrack}
                  onArt={(t) => setArtTarget(t.id)}
                  onDownload={onDownloadOne}
                  onRetry={(t) => actions.retry(t.id)}
                  onCancel={(t) => actions.pause(t.id)}
                  onRemove={handleRemoveTrack}
                  onReconvert={(track) => openReconvert(track, "ipod-safe-aac")}
                  onAudioIssues={setAudioIssueTarget}
                  onAudioRepair={repairAudioTracks}
                  onClear={actions.clearCompleted}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelected}
                  audioIssueFilter={audioIssueFilter}
                  onAudioIssueFilterChange={setAudioIssueFilter}
                />
              </div>
            </div>

            <div className="il-side-rail-shell">
              <div className="il-side-rail">
                <div className="il-side-rail-preview">
                  <IpodPreview track={nowPlaying} />
                </div>
                <div className="il-side-rail-export">
                  <ExportBar
                    completeCount={completed.length}
                    totalCount={tracks.length}
                    selectedCount={selectedCompleted.length}
                    onZip={onZip}
                    onLibrary={onLibrary}
                    onCSV={onCSV}
                    onSelected={onSelected}
                    helperConnected={helper.connected}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "Library" && (
          <LibraryView
            tracks={tracks}
            pattern={pattern}
            avoidOverwrite={settings.avoidOverwrite}
            onZip={onZip}
            onCSV={onCSV}
            helperConnected={helper.connected}
            onAudioIssues={setAudioIssueTarget}
            onAudioRepair={repairAudioTracks}
            audioIssueFilter={audioIssueFilter}
            onAudioIssueFilterChange={setAudioIssueFilter}
          />
        )}

        {tab === "Sync" && (
          <SyncView
            tracks={tracks}
            helper={helper}
            ipod={ipod}
            actions={actions}
            onShowToast={showToast}
            onEdit={setEditTrack}
            onRemove={handleRemoveTrack}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onSelectTracks={setSelectedTracks}
            onReconvert={(items) => openReconvert(items, "ipod-safe-aac")}
            onAudioIssues={setAudioIssueTarget}
            onAudioRepair={repairAudioTracks}
            onAudioAnalyze={analyzeAudioTracks}
            audioIssueFilter={audioIssueFilter}
            onAudioIssueFilterChange={setAudioIssueFilter}
          />
        )}

        {tab === "Import" && (
          <XmlImportView
            helper={helper}
            onLog={actions.pushLog}
            onImported={(result) => {
              const count = result?.created?.length || 0;
              showToast(count
                ? `Importing ${count} track${count === 1 ? "" : "s"} — converting now. Review and approve in Sync.`
                : "No new tracks to import.");
              if (count) setTab("Sync");
            }}
          />
        )}
      </main>

      <MetadataEditor open={!!editTrack} track={editTrack} resizeArtwork={settings.resizeArtwork} onClose={() => setEditTrack(null)} onSave={(id, patch) => { actions.updateTrack(id, patch); setEditTrack(null); showToast("Metadata saved."); }} />
      <CoverArtModal open={!!artTarget} value={artTarget === "all" ? globalCover : (tracks.find((t) => t.id === artTarget)?.coverArt || null)} resizeArtwork={settings.resizeArtwork} onClose={() => setArtTarget(null)} onApply={applyArt} />
      <SettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onChange={actions.updateSettings} />
      <ReconvertModal
        open={!!reconvertRequest}
        tracks={reconvertRequest?.tracks || []}
        defaultOutputOption={reconvertRequest?.defaultOutputOption || "ipod-safe-aac"}
        busy={reconvertBusy}
        onClose={() => setReconvertRequest(null)}
        onConfirm={confirmReconvert}
      />
      <AudioIssuesModal
        open={!!audioIssueTarget}
        track={audioIssueTarget}
        busy={audioIssueBusy}
        onClose={() => setAudioIssueTarget(null)}
        onSave={async (track, payload) => {
          const result = await saveAudioIssues(track, payload);
          if (result) setAudioIssueTarget(null);
        }}
        onAnalyze={analyzeAudioTracks}
        onRepair={repairAudioTracks}
        onClear={clearAudioIssues}
      />
      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title={`Logs · ${logs.length} lines`} width={860}>
        <LogsPanel lines={logs} showHeader={false} height="min(58vh, 520px)" />
      </Modal>

      <ReconvertProgressPopup progress={reconvertProgress} tracks={tracks} />
      <Toast msg={toast} />
    </div>
  );
}
