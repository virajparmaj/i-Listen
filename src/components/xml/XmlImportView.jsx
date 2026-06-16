import React from "react";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { ProgressBar } from "../ui/ProgressBar.jsx";
import { LibraryUpload } from "./LibraryUpload.jsx";
import { PlaylistPicker } from "./PlaylistPicker.jsx";
import { TrackSelectList } from "./TrackSelectList.jsx";
import { MatchReview } from "./MatchReview.jsx";
import { useXmlImport } from "../../hooks/useXmlImport.js";

/** Ordered, de-duplicated tracks across the selected playlists (for the checklist). */
function unionTracks(library, selectedPlaylistIds) {
  if (!library) return [];
  const seen = new Set();
  const tracks = [];
  library.playlists
    .filter((playlist) => selectedPlaylistIds.has(playlist.id))
    .forEach((playlist) => {
      playlist.trackIds.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        const track = library.tracksById[String(id)];
        if (track) tracks.push(track);
      });
    });
  return tracks;
}

const StepHeader = ({ title, subtitle, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
    <div>
      <h2 style={{ margin: 0, fontSize: "var(--text-h3)", color: "var(--text-primary)" }}>{title}</h2>
      {subtitle && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

export function XmlImportView({ helper, onImported, onLog }) {
  const xml = useXmlImport({
    onImported: (result) => onImported?.(result),
    onLog,
  });
  const { step, library, selectedPlaylistIds, excludedIds, matches, progress, busy, error, importCount, actions } = xml;
  const connected = Boolean(helper?.connected);

  const tracks = React.useMemo(
    () => unionTracks(library, selectedPlaylistIds),
    [library, selectedPlaylistIds],
  );
  const selectableCount = tracks.filter((track) => !excludedIds.has(track.id)).length;

  const reviewEntries = React.useMemo(() => {
    if (!library) return [];
    return tracks
      .map((track) => (matches[track.id] ? { match: matches[track.id], track } : null))
      .filter(Boolean);
  }, [library, tracks, matches]);

  return (
    <div className="il-fade-in" style={{ maxWidth: 940, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <Card variant="recessed" padding={12} style={{ borderLeft: "3px solid var(--status-error)" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-error)" }}>{error}</span>
        </Card>
      )}

      {step === "upload" && (
        <>
          <StepHeader
            title="Build a playlist from your Apple Music library"
            subtitle="Upload a Library.xml, pick playlists, review the YouTube matches, then convert and sync to your iPod."
          />
          <LibraryUpload onFile={actions.parseFile} busy={busy} error="" disabled={!connected} />
        </>
      )}

      {step === "select" && (
        <>
          <StepHeader
            title="Choose playlists and songs"
            subtitle="Every song is selected by default. Uncheck anything you don't want. Songs already in your library start off."
            right={(
              <Button
                variant="primary"
                disabled={busy || selectableCount === 0}
                onClick={actions.runSearch}
              >
                {busy ? "Searching…" : `Search ${selectableCount} on YouTube`}
              </Button>
            )}
          />
          {busy && progress && (
            <Card variant="panel" padding={14}>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 8 }}>
                Searching YouTube… {progress.done}/{progress.total}
              </div>
              <ProgressBar value={progress.total ? (progress.done / progress.total) * 100 : 0} showLabel />
            </Card>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: 14, alignItems: "start" }}>
            <PlaylistPicker
              playlists={library?.playlists || []}
              selectedIds={selectedPlaylistIds}
              onToggle={actions.togglePlaylist}
            />
            <TrackSelectList
              tracks={tracks}
              excludedIds={excludedIds}
              onToggle={actions.toggleTrack}
            />
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={actions.reset}>← Start over</Button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <StepHeader
            title="Review YouTube matches"
            subtitle="Flagged rows had a weak match — swap the candidate or paste a link before importing. Importing downloads and converts."
            right={(
              <Button variant="primary" disabled={busy || importCount === 0} onClick={actions.runImport}>
                {busy ? "Importing…" : `Import ${importCount} track${importCount === 1 ? "" : "s"}`}
              </Button>
            )}
          />
          <MatchReview entries={reviewEntries} actions={actions} />
          <div>
            <Button variant="ghost" size="sm" onClick={actions.reset}>← Start over</Button>
          </div>
        </>
      )}
    </div>
  );
}
