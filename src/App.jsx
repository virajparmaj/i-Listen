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
import { Modal } from "./components/ui/Modal.jsx";
import { exportBackendManifest, exportCSV, exportLibraryManifest, filenameFor } from "./utils/download.js";

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

export default function App() {
  const { tracks, logs, settings, globalCover, helper, ipod, actions } = useConverter();
  const [tab, setTab] = React.useState("Convert");
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());

  const [editTrack, setEditTrack] = React.useState(null);
  const [artTarget, setArtTarget] = React.useState(null); // 'all' | trackId | null
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);
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
  const preset = outputOption === "best-youtube" ? "best" : outputOption === "mp3-v0" ? "mp3" : null;
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

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

      <main className="il-app-main">
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
                  onRemove={(t) => actions.removeTrack(t.id)}
                  onClear={actions.clearCompleted}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelected}
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
      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title={`Logs · ${logs.length} lines`} width={860}>
        <LogsPanel lines={logs} showHeader={false} height="min(58vh, 520px)" />
      </Modal>

      <Toast msg={toast} />
    </div>
  );
}
