import React from "react";
import { useConverter } from "./hooks/useConverter.js";
import { TERMINAL } from "./data/mockData.js";
import { TopBar } from "./components/TopBar.jsx";
import { NoticeBar } from "./components/NoticeBar.jsx";
import { PastePanel } from "./components/PastePanel.jsx";
import { OutputControls } from "./components/OutputControls.jsx";
import { Queue } from "./components/Queue.jsx";
import { LogsPanel } from "./components/LogsPanel.jsx";
import { IpodPreview } from "./components/IpodPreview.jsx";
import { ExportBar } from "./components/ExportBar.jsx";
import { LibraryView } from "./components/LibraryView.jsx";
import { MetadataEditor } from "./components/MetadataEditor.jsx";
import { CoverArtModal } from "./components/CoverArtModal.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { exportCSV, exportLogs, exportLibraryManifest, filenameFor } from "./utils/download.js";

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="il-fade-in" style={{
      position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 200,
      background: "var(--grad-graphite)", color: "var(--text-on-dark)", padding: "10px 18px",
      borderRadius: "var(--radius-pill)", border: "1px solid #1c1c1e",
      boxShadow: "var(--shadow-float), var(--gloss-top-dark)", fontSize: "var(--text-sm)",
    }}>
      {msg}
    </div>
  );
}

export default function App() {
  const { tracks, logs, settings, isProcessing, globalCover, actions } = useConverter();
  const [tab, setTab] = React.useState("Convert");
  const [agreed, setAgreed] = React.useState(false);
  const [preset, setPreset] = React.useState("balanced");
  const [format, setFormat] = React.useState("mp3");

  const [editTrack, setEditTrack] = React.useState(null);
  const [artTarget, setArtTarget] = React.useState(null); // 'all' | trackId | null
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [toast, setToast] = React.useState("");

  const toastRef = React.useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 2600);
  };

  const completed = tracks.filter((t) => t.status === "complete");
  const nowPlaying = completed[completed.length - 1] || tracks.find((t) => !TERMINAL.includes(t.status)) || tracks[0];
  const pattern = settings.filenamePattern;

  // ---- export handlers ----
  const onZip = () => { exportLibraryManifest(tracks, pattern); actions.pushLog("Packaged library as ZIP (mock manifest).", "ok", "Export:"); showToast("Downloaded library manifest (.txt) — ZIP is mocked in this build."); };
  const onLibrary = () => { exportLibraryManifest(tracks, pattern); showToast("Downloaded organized-library manifest."); };
  const onSelected = () => { exportLibraryManifest(completed, pattern); showToast(`${completed.length} track(s) — manifest downloaded (mock).`); };
  const onCSV = () => { exportCSV(tracks); actions.pushLog("Exported CSV report.", null, "Export:"); showToast("CSV report downloaded."); };
  const onLogs = () => { exportLogs(logs); showToast("Logs exported."); };
  const onDownloadOne = (t) => showToast(`"${filenameFor(t, pattern)}" would download here (mock build).`);

  const applyArt = (art) => {
    if (artTarget === "all") actions.applyGlobalCover(art);
    else if (artTarget) actions.updateTrack(artTarget, { coverArt: art });
    setArtTarget(null);
  };

  const jobInfo = `${settings.parallelJobs} jobs · ${format.toUpperCase()}`;

  return (
    <div className="il-desktop">
      <TopBar tab={tab} setTab={setTab} onOpenSettings={() => setSettingsOpen(true)} jobInfo={jobInfo} />

      <main style={{ maxWidth: "var(--container-max)", width: "100%", margin: "0 auto", padding: "22px 22px 48px", boxSizing: "border-box" }}>
        {tab === "Convert" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
              <NoticeBar />
              <PastePanel
                agreed={agreed}
                setAgreed={setAgreed}
                isProcessing={isProcessing}
                onStart={actions.start}
                onPause={actions.pause}
                onAdd={(text) => { const n = actions.addFromLinks(text); if (n) showToast(`Added ${n} track(s).`); else showToast("No new links to add."); return n; }}
              />
              <div id="queue">
                <Queue
                  tracks={tracks}
                  onEdit={setEditTrack}
                  onArt={(t) => setArtTarget(t.id)}
                  onDownload={onDownloadOne}
                  onRetry={(t) => actions.retry(t.id)}
                  onRemove={(t) => actions.removeTrack(t.id)}
                  onClear={actions.clearCompleted}
                />
              </div>
              <LogsPanel lines={logs} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 78 }}>
              <ExportBar
                completeCount={completed.length}
                totalCount={tracks.length}
                onZip={onZip}
                onLibrary={onLibrary}
                onCSV={onCSV}
                onLogs={onLogs}
                onSelected={onSelected}
              />
              <OutputControls
                preset={preset}
                setPreset={(p) => { setPreset(p); }}
                format={format}
                setFormat={(f) => { setFormat(f); }}
                pattern={pattern}
                setPattern={(p) => actions.updateSettings({ filenamePattern: p })}
                onApplyAll={() => { actions.applyToAll({ preset, format }); showToast("Applied preset & format to all tracks."); }}
              />
              <button
                onClick={() => setArtTarget("all")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 36,
                  borderRadius: "var(--radius-sm)", cursor: "pointer", fontFamily: "var(--font-ui)",
                  fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)",
                  background: "var(--grad-chrome)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card), var(--gloss-top)",
                }}
              >
                Cover art for all tracks…
              </button>
              <IpodPreview track={nowPlaying} />
            </div>
          </div>
        ) : (
          <LibraryView tracks={tracks} pattern={pattern} onZip={onLibrary} onCSV={onCSV} />
        )}
      </main>

      <MetadataEditor open={!!editTrack} track={editTrack} onClose={() => setEditTrack(null)} onSave={(id, patch) => { actions.updateTrack(id, patch); setEditTrack(null); showToast("Metadata saved."); }} />
      <CoverArtModal open={!!artTarget} value={artTarget === "all" ? globalCover : (tracks.find((t) => t.id === artTarget)?.coverArt || null)} onClose={() => setArtTarget(null)} onApply={applyArt} />
      <SettingsModal open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onChange={actions.updateSettings} />

      <Toast msg={toast} />
    </div>
  );
}
