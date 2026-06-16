import React from "react";
import { Card } from "../ui/Card.jsx";
import { Checkbox } from "../ui/Checkbox.jsx";
import { Badge } from "../ui/Badge.jsx";

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The track checklist for the selected playlists. Every track starts checked;
 * unchecking excludes it from the YouTube search. Songs already in the local
 * library are flagged and start unchecked.
 */
export function TrackSelectList({ tracks = [], excludedIds, onToggle }) {
  if (!tracks.length) {
    return (
      <Card variant="recessed" padding={18}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Select a playlist to choose which songs to import.
        </div>
      </Card>
    );
  }

  const selectedCount = tracks.filter((track) => !excludedIds.has(track.id)).length;

  return (
    <Card variant="panel" padding={16} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-secondary)" }}>
          Songs
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {selectedCount} of {tracks.length} selected
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "46vh", overflowY: "auto" }}>
        {tracks.map((track) => (
          <div
            key={track.id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 8px", borderRadius: "var(--radius-sm)" }}
          >
            <Checkbox
              checked={!excludedIds.has(track.id)}
              onChange={() => onToggle(track.id)}
              label={`${track.title} — ${track.artist}`}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              {track.existing && <Badge tone="info">In library</Badge>}
              <span style={{ fontFamily: "var(--font-typewriter)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", minWidth: 34, textAlign: "right" }}>
                {fmtDuration(track.durationSec)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
