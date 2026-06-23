import React from "react";
import { Card } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Badge } from "./ui/Badge.jsx";
import { Icon } from "./ui/Icon.jsx";
import { ArtworkThumb } from "./ArtworkThumb.jsx";
import { libraryEntries } from "../utils/download.js";
import { AudioIssueFilters } from "./AudioIssueFilters.jsx";
import { audioIssueLabels, filterByAudioIssues, hasAudioIssue, needsAudioRepair } from "../utils/audioRepair.js";

function CoverTile({ track, playable, selected, playing, onSelect, onAudioIssues, onAudioRepair }) {
  const issueLabels = audioIssueLabels(track);
  const repairNeeded = needsAudioRepair(track);
  return (
    <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <button
        type="button"
        disabled={!playable}
        onClick={() => onSelect(track)}
        style={{
          width: "100%",
          padding: 0,
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: playable ? "pointer" : "default",
          opacity: playable ? 1 : 0.78,
        }}
      >
        <div style={{
          position: "relative",
          aspectRatio: "1 / 1",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-card)",
          outline: selected ? "2px solid var(--accent-primary)" : "none",
          outlineOffset: selected ? "-2px" : "0",
        }}>
          <ArtworkThumb
            primarySrc={track.coverArt}
            fallbackSrc={track.thumbnailUrl}
            thumbColor={track.thumbColor}
            alt={`${track.title} cover`}
            iconSize={30}
            style={{ width: "100%", height: "100%" }}
          />
          {playable && (
            <div style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(17, 24, 39, 0.78)",
              border: "1px solid rgba(255,255,255,0.24)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Icon name={selected && playing ? "pause" : "play"} size={12} color="#F9FAFB" emboss={false} />
            </div>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
        <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.artist} · {track.qualityLabel || track.format.toUpperCase()}</div>
        <div style={{ marginTop: 4, fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: playable ? "var(--accent-primary)" : "var(--text-secondary)" }}>
          {!playable ? "Preview unavailable" : selected ? (playing ? "Pause preview" : "Play preview") : "Play preview"}
        </div>
      </button>
      {issueLabels.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", minHeight: 18 }}>
          {issueLabels.map((label) => <Badge key={label} tone="warning">{label}</Badge>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" onClick={() => onAudioIssues?.(track)}>Flag issue</Button>
        {repairNeeded && <Button size="sm" variant="secondary" onClick={() => onAudioRepair?.([track])}>Repair</Button>}
      </div>
    </div>
  );
}

function FolderTree({ tracks, pattern, avoidOverwrite }) {
  const byArtist = {};
  libraryEntries(tracks, pattern, { avoidOverwrite }).forEach((entry) => {
    byArtist[entry.artist] = byArtist[entry.artist] || {};
    byArtist[entry.artist][entry.album] = byArtist[entry.artist][entry.album] || [];
    byArtist[entry.artist][entry.album].push(entry);
  });
  return (
    <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
      <div style={{ color: "var(--text-primary)" }}>Music Library/</div>
      {Object.entries(byArtist).map(([artist, albums]) => (
        <div key={artist}>
          <div style={{ paddingLeft: 16 }}>{artist}/</div>
          {Object.entries(albums).map(([album, items]) => (
            <div key={album}>
              <div style={{ paddingLeft: 32 }}>{album}/</div>
              {items.map((entry) => (
                <div key={entry.track.id} style={{ paddingLeft: 48 }}>{entry.filename}</div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PlaylistTree({ tracks }) {
  const groups = {};
  tracks.forEach((track) => {
    const names = (track.playlists || []).filter((name) => !/^ipod\s*-/i.test(String(name || "").trim()));
    names.forEach((name) => {
      groups[name] = groups[name] || [];
      groups[name].push(track);
    });
  });
  const entries = Object.entries(groups);

  return (
    <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
      {entries.length ? entries.map(([name, items]) => (
        <div key={name}>
          <div style={{ color: "var(--text-primary)" }}>{name}.m3u</div>
          {items.map((track) => (
            <div key={track.id} style={{ paddingLeft: 16 }}>{track.artist} - {track.title}</div>
          ))}
        </div>
      )) : <div>No custom playlists assigned.</div>}
    </div>
  );
}

export function LibraryView({ tracks, pattern, avoidOverwrite = true, locked = false, onZip, onCSV, helperConnected = false, onAudioIssues, onAudioRepair, audioIssueFilter = {}, onAudioIssueFilterChange }) {
  const doneAll = tracks.filter((t) => t.status === "complete");
  const done = filterByAudioIssues(doneAll, audioIssueFilter);
  const playableTracks = done.filter((track) => track.audioUrl);
  const bassFlagged = doneAll.filter((track) => hasAudioIssue(track, "bass_crackle"));
  const leftFlagged = doneAll.filter((track) => hasAudioIssue(track, "left_channel_disturbance"));
  const [selectedId, setSelectedId] = React.useState("");
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState("");
  const [autoplayKey, setAutoplayKey] = React.useState("");
  const audioRef = React.useRef(null);

  React.useEffect(() => {
    const playableIds = new Set(playableTracks.map((track) => track.id));
    if (selectedId && playableIds.has(selectedId)) return;
    setSelectedId(playableTracks[0]?.id || "");
    setIsPlaying(false);
    setPlaybackError("");
  }, [playableTracks, selectedId]);

  const selectedTrack = done.find((track) => track.id === selectedId) || playableTracks[0] || done[0] || null;

  React.useEffect(() => {
    if (!helperConnected) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (!selectedTrack?.audioUrl || autoplayKey !== selectedTrack.id) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        setIsPlaying(false);
        setPlaybackError("Preview could not start. The helper may be offline or the file may be missing.");
      });
    }
  }, [autoplayKey, helperConnected, selectedTrack]);

  const handleSelect = React.useCallback((track) => {
    if (!helperConnected || !track.audioUrl) return;
    setPlaybackError("");
    if (track.id === selectedId) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise?.catch) {
          playPromise.catch(() => setPlaybackError("Preview could not start. The helper may be offline or the file may be missing."));
        }
      } else {
        audio.pause();
      }
      return;
    }
    setSelectedId(track.id);
    setAutoplayKey(track.id);
  }, [helperConnected, selectedId]);

  const canPreviewSelected = helperConnected && Boolean(selectedTrack?.audioUrl);

  return (
    <div className="il-library-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--grad-chrome)" }}>
          <Icon name="note" size={18} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-h3)", letterSpacing: "-0.01em", lineHeight: "var(--leading-tight)" }}>Converted library</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{done.length} tracks</span>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--surface-recessed)" }}>
          <AudioIssueFilters value={audioIssueFilter} onChange={onAudioIssueFilterChange} compact />
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="secondary" disabled={locked || !bassFlagged.length} onClick={() => onAudioRepair?.(bassFlagged, "bass-safe-plus")}>
              Bass Safe Plus {bassFlagged.length || ""}
            </Button>
            <Button size="sm" variant="secondary" disabled={locked || !leftFlagged.length} onClick={() => onAudioRepair?.(leftFlagged, "stereo-blend-safe")}>
              Stereo Blend {leftFlagged.length || ""}
            </Button>
          </span>
        </div>
        {doneAll.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center", color: "var(--text-secondary)" }}>
            <Icon name="note" size={30} color="var(--border-strong)" style={{ margin: "0 auto 10px" }} />
            <div>No converted tracks yet.</div>
            <div style={{ fontSize: "var(--text-sm)" }}>Connect the local helper and convert a queue before this library contains audio outputs.</div>
          </div>
        ) : done.length === 0 ? (
          <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-secondary)" }}>
            <div>No tracks match the audio filters.</div>
          </div>
        ) : (
          <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 16 }}>
            {done.map((t) => (
              <CoverTile
                key={t.id}
                track={t}
                playable={helperConnected && Boolean(t.audioUrl)}
                selected={selectedTrack?.id === t.id}
                playing={selectedTrack?.id === t.id && isPlaying}
                onSelect={handleSelect}
                onAudioIssues={onAudioIssues}
                onAudioRepair={onAudioRepair}
              />
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 4, alignSelf: "start" }}>
        <Card>
          <div className="il-label" style={{ marginBottom: 10 }}>Preview player</div>
          {selectedTrack ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <ArtworkThumb
                  primarySrc={selectedTrack.coverArt}
                  fallbackSrc={selectedTrack.thumbnailUrl}
                  thumbColor={selectedTrack.thumbColor}
                  alt={`${selectedTrack.title} cover`}
                  iconSize={24}
                  style={{
                    width: 72,
                    height: 72,
                    flex: "none",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-strong)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedTrack.title}
                  </div>
                  <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedTrack.artist}
                  </div>
                  <div style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedTrack.album} · {selectedTrack.qualityLabel || selectedTrack.format.toUpperCase()}
                  </div>
                  {audioIssueLabels(selectedTrack).length > 0 && (
                    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                      {audioIssueLabels(selectedTrack).map((label) => <Badge key={label} tone="warning">{label}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button size="sm" variant="secondary" disabled={locked} onClick={() => onAudioIssues?.(selectedTrack)}>Flag issue</Button>
                {needsAudioRepair(selectedTrack) && <Button size="sm" variant="secondary" disabled={locked} onClick={() => onAudioRepair?.([selectedTrack])}>Repair</Button>}
              </div>
              {canPreviewSelected ? (
                <audio
                  key={selectedTrack.id}
                  ref={audioRef}
                  controls
                  preload="metadata"
                  src={selectedTrack.audioUrl}
                  style={{ width: "100%" }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    setIsPlaying(false);
                    setPlaybackError("Preview unavailable right now. Reconnect the helper or reconvert the track if the file moved.");
                  }}
                />
              ) : (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "var(--leading-snug)" }}>
                  {helperConnected
                    ? "This converted track does not have a playable helper output yet."
                    : "Connect the local helper to preview converted tracks in the browser."}
                </div>
              )}
              {playbackError && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--status-warning)", lineHeight: "var(--leading-snug)" }}>
                  {playbackError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>No converted track selected yet.</div>
          )}
        </Card>
        <Card>
          <div className="il-label" style={{ marginBottom: 10 }}>Folder structure</div>
          {done.length ? (
            <div className="il-scroll" style={{ maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
              <FolderTree tracks={done} pattern={pattern} avoidOverwrite={avoidOverwrite} />
            </div>
          ) : <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>No converted files yet.</div>}
        </Card>
        <Card>
          <div className="il-label" style={{ marginBottom: 10 }}>Playlists</div>
          {done.length ? (
            <div className="il-scroll" style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              <PlaylistTree tracks={done} />
            </div>
          ) : <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>No playlist exports yet.</div>}
        </Card>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="secondary" fullWidth disabled={!done.length || locked} iconLeft={<Icon name="zip" size={14} emboss={false} />} onClick={onZip}>Export M3U playlist files</Button>
            <Button variant="ghost" fullWidth iconLeft={<Icon name="csv" size={14} />} onClick={onCSV} disabled={!done.length || locked}>Export CSV report</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
